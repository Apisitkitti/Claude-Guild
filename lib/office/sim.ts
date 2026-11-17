import type { HookEvt, Office } from "./engine";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const hex8 = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const PROJECTS = ["dragon-shop", "quest-qa", "rune-auth", "gold-split", "portfolio"];
const FILES: Record<string, string[]> = {
  "dragon-shop": ["src/app/page.tsx", "src/line/webhook.service.ts", "src/components/Flex.tsx", "package.json"],
  "quest-qa": ["tests/login.spec.ts", "src/qa/runner.ts", "playwright.config.ts", "README.md"],
  "rune-auth": ["src/auth/auth.service.ts", "src/auth/jwt.guard.ts", "prisma/schema.prisma", "src/main.ts"],
  "gold-split": ["src/utils/split.ts", "src/app/bills/page.tsx", "prisma/schema.prisma", "src/lib/db.ts"],
  portfolio: ["src/app/page.tsx", "src/components/Hero.tsx", "src/styles/globals.css", "next.config.ts"],
};
const COMMANDS = ["npm test", "pnpm build", "git status", "npx prisma migrate dev", "npm run lint", "git diff --stat", "ls -la src", "npx tsc --noEmit"];
const QUERIES = ["next.js app router caching", "prisma migrate drift", "line messaging api flex", "react 19 use hook"];
const WEIGHTS: [string, number][] = [
  ["Read", 25], ["Grep", 10], ["Glob", 5], ["Edit", 22], ["Write", 6], ["Bash", 15], ["WebSearch", 4],
  ["Agent", 4], ["TodoWrite", 5], ["mcp__linear__list_issues", 4],
];
const TOTAL = WEIGHTS.reduce((s, w) => s + w[1], 0);

function pickTool(): string {
  let r = Math.random() * TOTAL;
  for (const [n, w] of WEIGHTS) { if ((r -= w) <= 0) return n; }
  return "Read";
}

function toolInput(tool: string, project: string, cwd: string): Record<string, unknown> {
  const f = cwd + "/" + pick(FILES[project] ?? FILES.portfolio);
  switch (tool) {
    case "Read": case "Edit": case "Write": return { file_path: f };
    case "Grep": return { pattern: pick(["useEffect", "TODO", "handleSubmit", "export default"]) };
    case "Glob": return { pattern: pick(["**/*.ts", "src/**/*.tsx", "**/*.spec.ts"]) };
    case "Bash": return { command: pick(COMMANDS) };
    case "WebSearch": return { query: pick(QUERIES) };
    case "Agent": return { description: "Explore codebase", subagent_type: "Explore", prompt: "Find usages" };
    case "TodoWrite": return { todos: [{ content: "step", status: "pending" }] };
    default: return {};
  }
}

type Gen = Generator<number, void, void>;

export class Simulator {
  private runners: { gen: Gen; wake: number }[] = [];
  private active = new Map<string, string>(); // session id -> project
  private nextAdd = 0;

  constructor(private o: Office) {
    this.addSession();
    this.addSession();
    this.nextAdd = o.clock + rand(8, 20);
  }

  private spawn(gen: Gen) { this.runners.push({ gen, wake: this.o.clock }); }

  addSession() {
    const used = new Set(this.active.values());
    const free = PROJECTS.filter((p) => !used.has(p));
    const project = free.length ? pick(free) : pick(PROJECTS);
    const id = hex8() + "-" + hex8().slice(0, 4);
    this.active.set(id, project);
    this.spawn(this.session(id, project));
  }

  update() {
    const clock = this.o.clock;
    for (const r of [...this.runners]) {
      if (clock >= r.wake) {
        const n = r.gen.next();
        if (n.done) this.runners.splice(this.runners.indexOf(r), 1);
        else r.wake = clock + n.value;
      }
    }
    if (this.active.size === 0) this.addSession();
    if (clock >= this.nextAdd) {
      if (this.active.size < 5 && Math.random() < 0.6) this.addSession();
      this.nextAdd = clock + rand(8, 20);
    }
  }

  private emit(evt: HookEvt) { this.o.event(evt); }

  private *session(id: string, project: string): Gen {
    const cwd = "/Users/me/Practice/" + project;
    const base = { session_id: id, cwd };
    const send = (name: string, extra: Record<string, unknown> = {}) =>
      this.emit({ ...base, hook_event_name: name, ...extra });
    yield 0;
    send("SessionStart", { source: "startup" });
    yield rand(2, 4);
    const prompts = randInt(2, 4);
    for (let p = 0; p < prompts; p++) {
      send("UserPromptSubmit", { prompt: "do the thing" });
      yield rand(1, 2);
      const steps = randInt(4, 10);
      for (let s = 0; s < steps; s++) {
        const tool = pickTool();
        const tool_input = toolInput(tool, project, cwd);
        const tool_use_id = "toolu_" + hex8();
        send("PreToolUse", { tool_name: tool, tool_input, tool_use_id });
        if (tool === "Agent") this.spawn(this.intern(id, cwd));
        if (Math.random() < 0.08) {
          send("Notification", { notification_type: "permission_prompt", message: "Claude needs your permission to use " + tool });
          yield rand(3, 6);
        }
        // occasionally a very long tool: the guild sees a boss
        if ((tool === "Bash" || tool === "Agent") && Math.random() < 0.08) yield rand(34, 42);
        else yield tool === "Bash" ? rand(3, 8) : rand(0.8, 5);
        if ((tool === "Bash" && Math.random() < 0.1) || Math.random() < 0.05) {
          send("PostToolUseFailure", { tool_name: tool, tool_input, tool_use_id, error: "Command exited with non-zero status code 1", duration_ms: 3000 });
        } else send("PostToolUse", { tool_name: tool, tool_input, tool_use_id, duration_ms: 1200 });
        yield rand(0.3, 1.5);
      }
      send("Stop");
      // now and then a long break: the adventurer rests by a campfire
      yield Math.random() < 0.25 ? rand(85, 110) : rand(6, 15);
    }
    send("SessionEnd", { reason: "prompt_input_exit" });
    this.active.delete(id);
  }

  private *intern(sid: string, cwd: string): Gen {
    const agent_id = "a" + hex8() + hex8().slice(0, 4);
    const agent_type = pick(["Explore", "general-purpose"]);
    const alive = () => this.active.has(sid);
    const send = (name: string, extra: Record<string, unknown> = {}) =>
      this.emit({ session_id: sid, cwd, hook_event_name: name, agent_id, agent_type, ...extra });
    yield 0.3;
    if (!alive()) return;
    send("SubagentStart");
    const n = randInt(2, 4);
    for (let k = 0; k < n; k++) {
      yield rand(0.6, 1.5);
      if (!alive()) return;
      const tool = pick(["Read", "Grep"]);
      const tool_input = tool === "Read" ? { file_path: cwd + "/src/index.ts" } : { pattern: "TODO" };
      send("PreToolUse", { tool_name: tool, tool_input });
      yield rand(1.5, 4);
      if (!alive()) return;
      send("PostToolUse", { tool_name: tool, tool_input });
    }
    yield rand(0.8, 1.5);
    if (alive()) send("SubagentStop");
  }
}
