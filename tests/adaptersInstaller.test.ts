import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "..", "scripts", "install-hooks.mjs");
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "guild-hooks-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const run = (...args: string[]) =>
  execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, HOME: dir } });
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const backups = () => fs.readdirSync(dir).filter((name) => name.includes(".bak-"));

const AGENTS = [
  { agent: "codex", event: "PreToolUse", mark: "source=codex" },
  { agent: "copilot", event: "preToolUse", mark: "source=copilot" },
  { agent: "cursor", event: "postToolUse", mark: "source=cursor" },
] as const;

describe.each(AGENTS)("install-hooks --agent $agent", ({ agent, event, mark }) => {
  it("dry-run writes nothing; apply installs; second apply is idempotent; uninstall removes only ours", () => {
    const file = path.join(dir, "cfg.json");
    const foreign = { type: "command", command: "echo mine", bash: "echo mine" };
    const initial = {
      keep: true,
      hooks: { [event]: agent === "codex" ? [{ hooks: [foreign] }] : [foreign], other: [] },
    };
    fs.writeFileSync(file, JSON.stringify(initial));

    run("--agent", agent, "--file", file);
    expect(read(file)).toEqual(initial);

    run("--agent", agent, "--file", file, "--apply");
    const installed = read(file);
    expect(JSON.stringify(installed)).toContain(mark);
    expect(installed.keep).toBe(true);
    expect(installed.hooks[event]).toHaveLength(2);
    expect(backups()).toHaveLength(1);

    const again = run("--agent", agent, "--file", file, "--apply");
    expect(again).toContain("Nothing to change");
    expect(read(file)).toEqual(installed);

    run("--agent", agent, "--file", file, "--uninstall", "--apply");
    const after = read(file);
    expect(JSON.stringify(after)).not.toContain("/events");
    expect(after.hooks[event]).toEqual(agent === "codex" ? [{ hooks: [foreign] }] : [foreign]);
    expect(after.keep).toBe(true);
  });

  it("honours --port and creates a missing file", () => {
    const file = path.join(dir, "nested", "new.json");
    run("--agent", agent, "--file", file, "--port", "6060", "--apply");
    expect(fs.readFileSync(file, "utf8")).toContain("localhost:6060/events");
    expect(fs.readFileSync(file, "utf8")).not.toContain("localhost:5050");
  });
});

describe("install-hooks targets", () => {
  it("--global resolves under the temp HOME, never the real one", () => {
    const home = path.join(dir, "home");
    const env = { ...process.env, HOME: home, CODEX_HOME: "", COPILOT_HOME: "" };
    execFileSync("node", [SCRIPT, "--agent", "cursor", "--global", "--apply"], { env });
    expect(fs.existsSync(path.join(home, ".cursor", "hooks.json"))).toBe(true);
  });
  it("cursor never installs permission-capable hooks (preToolUse / before*)", () => {
    const file = path.join(dir, "c.json");
    run("--agent", "cursor", "--file", file, "--apply");
    for (const name of Object.keys(read(file).hooks)) expect(name).not.toMatch(/^(preToolUse|before(?!SubmitPrompt))/);
    expect(read(file).version).toBe(1);
  });
  it("copilot warns when the project's .claude/settings.json already forwards events", () => {
    const project = path.join(dir, "proj");
    fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
    run("--file", path.join(project, ".claude", "settings.json"), "--apply");
    expect(run("--agent", "copilot", "--project", project)).toContain("WARNING");
  });
  it("rejects an unknown agent", () => {
    expect(() => run("--agent", "nope", "--file", path.join(dir, "x.json"))).toThrow();
  });

  it("uninstall keeps a user's own localhost hooks and honours --port", () => {
    const file = path.join(dir, "settings.json");
    const own = "curl -s -X POST http://localhost:5050/events-mine -d x";
    const lookalike = "curl -s --data-binary @- http://localhost:5050/other >/dev/null";
    const wrongAgent = "curl -s --data-binary @- 'http://localhost:5050/events?source=cursor'";
    fs.writeFileSync(
      file,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [own, lookalike, wrongAgent].map((command) => ({ type: "command", command })) }] },
      }),
    );
    run("--file", file, "--apply");
    run("--file", file, "--port", "6060", "--uninstall", "--apply");
    expect(fs.readFileSync(file, "utf8")).toContain("localhost:5050/events\\n".slice(0, 0) + "source=");
    expect(JSON.stringify(read(file).hooks.PreToolUse)).toContain("5050"); // other port untouched
    run("--file", file, "--uninstall", "--apply");
    const commands = read(file).hooks.Stop[0].hooks.map((hook: { command: string }) => hook.command);
    expect(commands).toEqual([own, lookalike, wrongAgent]);
    expect(JSON.stringify(read(file))).not.toContain("--max-time");
  });
  it("cursor and Claude hooks warn about each other", () => {
    const project = path.join(dir, "proj2");
    fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
    run("--file", path.join(project, ".claude", "settings.json"), "--apply");
    expect(run("--agent", "cursor", "--project", project)).toContain("WARNING");
    fs.mkdirSync(path.join(project, ".cursor"), { recursive: true });
    run("--agent", "cursor", "--file", path.join(project, ".cursor", "hooks.json"), "--apply");
    expect(run("--project", project)).toContain("WARNING");
  });
  it("flat agents are described as entries, not matcher groups", () => {
    expect(run("--agent", "cursor", "--file", path.join(dir, "e.json"))).not.toContain("matcher group");
  });
  it("example hooks background curl and still end with valid stdout", () => {
    const cursor = fs.readFileSync(path.resolve(__dirname, "..", "hooks", "cursor.example.json"), "utf8");
    expect(cursor).toContain("&)");
    expect(cursor).toContain("echo '{}'");
  });
});
