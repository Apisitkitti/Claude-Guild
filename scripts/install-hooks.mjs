#!/usr/bin/env node
// Merge claude-office hook entries into an AI coding agent's hook config (dry-run by default).
// Agents: claude (settings.json), codex (hooks.json), copilot (hooks/claude-guild.json), cursor (hooks.json).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** highest valid TCP port */
const MAX_PORT = 65535;

const AGENTS = {
  claude: {
    example: "settings.example.json",
    layout: "groups",
    global: () => path.join(os.homedir(), ".claude", "settings.json"),
    project: (dir) => path.join(dir, ".claude", "settings.json"),
  },
  codex: {
    example: "codex.example.json",
    layout: "groups",
    global: () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "hooks.json"),
    project: (dir) => path.join(dir, ".codex", "hooks.json"),
  },
  copilot: {
    example: "copilot.example.json",
    layout: "flat",
    commandKey: "bash",
    global: () =>
      path.join(process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"), "hooks", "claude-guild.json"),
    project: (dir) => path.join(dir, ".github", "hooks", "claude-guild.json"),
  },
  cursor: {
    example: "cursor.example.json",
    layout: "flat",
    commandKey: "command",
    global: () => path.join(os.homedir(), ".cursor", "hooks.json"),
    project: (dir) => path.join(dir, ".cursor", "hooks.json"),
  },
};

const HELP = `Usage: node scripts/install-hooks.mjs [--agent claude|codex|copilot|cursor] (--global | --project <dir> | --file <path>) [options]

Agent (default claude):
  claude   ~/.claude/settings.json            | <dir>/.claude/settings.json
  codex    ~/.codex/hooks.json ($CODEX_HOME)   | <dir>/.codex/hooks.json
  copilot  ~/.copilot/hooks/claude-guild.json  | <dir>/.github/hooks/claude-guild.json
  cursor   ~/.cursor/hooks.json                | <dir>/.cursor/hooks.json

Target (one required):
  --global           the user-level file above
  --project <dir>    the project-level file above
  --file <path>      explicit file

Options:
  --apply            actually write (default is dry-run). A backup
                     <file>.bak-YYYYMMDD-HHMMSS is made first.
  --uninstall        remove only our curl hooks (exact claude-guild command for the agent;
                     with --port N only those on port N, otherwise any port)
  --port N           use port N instead of 5050 in installed commands
  --help             show this help
`;

const die = (message) => {
  console.error("error: " + message);
  process.exit(1);
};

const parseArgs = (argv) => {
  const parsed = { apply: false, uninstall: false, port: 5050, portExplicit: false, agent: "claude" };
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const val = () => {
      const value = argv[++i];
      if (!value || value.startsWith("--")) die(`${arg} needs a value`);
      return value;
    };
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    } else if (arg === "--apply") parsed.apply = true;
    else if (arg === "--uninstall") parsed.uninstall = true;
    else if (arg === "--agent") {
      parsed.agent = val();
      if (!Object.hasOwn(AGENTS, parsed.agent)) die(`unknown --agent ${parsed.agent}\n\n${HELP}`);
    } else if (arg === "--global") targets.push({ kind: "global" });
    else if (arg === "--project") targets.push({ kind: "project", dir: path.resolve(val()) });
    else if (arg === "--file") targets.push({ kind: "file", file: path.resolve(val()) });
    else if (arg === "--port") {
      const port = Number(val());
      if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) die("invalid --port");
      parsed.port = port;
      parsed.portExplicit = true;
    } else die(`unknown argument ${arg}\n\n${HELP}`);
  }
  if (targets.length !== 1) die(`exactly one of --global, --project, --file is required\n\n${HELP}`);
  const [target] = targets;
  const spec = AGENTS[parsed.agent];
  parsed.target = target;
  parsed.file =
    target.kind === "global" ? spec.global() : target.kind === "project" ? spec.project(target.dir) : target.file;
  return parsed;
};

/**
 * Our exact command signature: `curl ... --data-binary @- 'http://localhost:PORT/events[?query]'` where the query's
 * `source` is absent for Claude Code and equals the agent for the others. A user's own localhost hook never matches.
 * port null = any port.
 */
const OUR_CURL = /\bcurl\b[^\n]*--data-binary @-\s+'?http:\/\/localhost:(\d+)\/events(\?[^\s'"]*)?'?(?=\s|$)/;

const isOurs = (cmd, port, agent) => {
  if (typeof cmd !== "string") return false;
  const match = OUR_CURL.exec(cmd);
  if (!match) return false;
  if (port != null && Number(match[1]) !== port) return false;
  const source = new URLSearchParams(match[2] ?? "").get("source");
  return agent === "claude" ? source === null : source === agent;
};

/** commands of one entry: a matcher group ({hooks:[{command}]}) or a flat entry ({bash|command}) */
const entryCmds = (entry) =>
  layout === "groups"
    ? (Array.isArray(entry?.hooks) ? entry.hooks : []).map((hook) => hook?.command)
    : [entry?.[spec.commandKey]];

const stamp = () => {
  const date = new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const options = parseArgs(process.argv.slice(2));
const spec = AGENTS[options.agent];
const layout = spec.layout;
const uninstallPort = options.portExplicit ? options.port : null;

let settings = {};
let existed = fs.existsSync(options.file);
if (existed) {
  const raw = fs.readFileSync(options.file, "utf8");
  if (raw.trim() !== "") {
    try {
      settings = JSON.parse(raw);
    } catch (error) {
      die(`${options.file} is not valid JSON (${error.message}). Nothing written.`);
    }
    if (settings === null || typeof settings !== "object" || Array.isArray(settings))
      die(`${options.file} must contain a JSON object. Nothing written.`);
  }
}
if (
  settings.hooks !== undefined &&
  (settings.hooks === null || typeof settings.hooks !== "object" || Array.isArray(settings.hooks))
)
  die('"hooks" in target is not an object. Nothing written.');

const log = [];
if (!options.uninstall) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const examplePath = path.resolve(here, "..", "hooks", spec.example);
  let example;
  try {
    example = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  } catch (error) {
    die(`cannot read ${examplePath}: ${error.message}`);
  }
  for (const [event, groups] of Object.entries(example.hooks ?? {})) {
    const existing = settings.hooks?.[event];
    if (existing !== undefined && !Array.isArray(existing))
      die(`hooks.${event} in target is not an array. Nothing written.`);
    if (
      (existing ?? []).some((group) => entryCmds(group).some((command) => isOurs(command, options.port, options.agent)))
    ) {
      log.push(`  = ${event}: already installed, skipped`);
      continue;
    }
    const add = JSON.parse(JSON.stringify(groups).replace(/localhost:\d+/g, `localhost:${options.port}`));
    settings.hooks ??= {};
    settings.hooks[event] = [...(existing ?? []), ...add];
    log.push(
      `  + ${event}: add ${add.length} ${layout === "groups" ? "matcher group(s)" : "hook entr(y/ies)"}${add[0]?.matcher ? ` (matcher ${add[0].matcher})` : ""}`,
    );
  }
} else {
  for (const event of Object.keys(settings.hooks ?? {})) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) continue;
    let removed = 0;
    const kept = [];
    for (const group of groups) {
      if (layout === "flat") {
        if (entryCmds(group).some((command) => isOurs(command, uninstallPort, options.agent))) removed++;
        else kept.push(group);
        continue;
      }
      if (!Array.isArray(group?.hooks)) {
        kept.push(group);
        continue;
      }
      const hooks = group.hooks.filter((hook) => !isOurs(hook?.command, uninstallPort, options.agent));
      removed += group.hooks.length - hooks.length;
      if (hooks.length === group.hooks.length) kept.push(group);
      else if (hooks.length > 0) kept.push({ ...group, hooks });
    }
    if (!removed) continue;
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
    log.push(`  - ${event}: removed ${removed} hook command(s)${kept.length ? "" : ", event now empty (dropped)"}`);
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
}

if (!options.uninstall && layout === "flat" && settings.version === undefined) settings.version = 1;

// Copilot (project .claude/settings.json) and Cursor ("third-party hooks") can also load Claude Code hooks. With both
// installed, every event arrives twice as two sessions (one with the agent suffix, one without). Warn when the other
// format already forwards to claude-guild; the same check runs the other way round when installing Claude hooks.
const fileHasOurs = (file, agent) => {
  try {
    const found = [];
    const walk = (value) => {
      if (typeof value === "string") found.push(value);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(JSON.parse(fs.readFileSync(file, "utf8")));
    return found.some((text) => isOurs(text, null, agent));
  } catch {
    return false;
  }
};
const home = os.homedir();
const conflictCandidates = () => {
  const { agent, target } = options;
  if (target.kind === "file") return [];
  const dir = target.kind === "project" ? target.dir : null;
  const claudeFiles = [
    ...(dir ? [".claude/settings.json", ".claude/settings.local.json"].map((name) => path.join(dir, name)) : []),
    ...(agent === "cursor" ? [AGENTS.claude.global()] : []),
  ];
  if (agent === "copilot") return dir ? claudeFiles.map((file) => ({ file, agent: "claude" })) : [];
  if (agent === "cursor") return claudeFiles.map((file) => ({ file, agent: "claude" }));
  if (agent === "claude") {
    return [
      ...(dir ? [{ file: AGENTS.copilot.project(dir), agent: "copilot" }] : []),
      { file: path.join(home, ".cursor", "hooks.json"), agent: "cursor" },
      ...(dir ? [{ file: AGENTS.cursor.project(dir), agent: "cursor" }] : []),
    ];
  }
  return [];
};
if (!options.uninstall) {
  const dup = conflictCandidates().filter(
    (candidate) => candidate.file !== options.file && fileHasOurs(candidate.file, candidate.agent),
  );
  if (dup.length)
    log.push(
      `  ! WARNING: ${dup.map((candidate) => candidate.file).join(", ")} already forwards events to claude-guild; ` +
        `${options.agent === "claude" ? "Copilot / Cursor" : options.agent} may load both formats and show every event twice (two sessions). Keep only one.`,
    );
}

const changed = log.some((line) => /^  [+-]/.test(line));
console.log(
  `${options.apply ? "APPLY" : "DRY-RUN"} ${options.uninstall ? "uninstall" : "install"} -> ${options.file}${existed ? "" : " (does not exist yet)"}`,
);
console.log(log.length ? log.join("\n") : "  (no hooks to process)");
if (!changed) {
  console.log("Nothing to change.");
  process.exit(0);
}
if (!options.apply) {
  console.log("\nDry-run only. Re-run with --apply to write.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(options.file), { recursive: true });
if (existed) {
  const bak = `${options.file}.bak-${stamp()}`;
  fs.copyFileSync(options.file, bak);
  console.log(`Backup: ${bak}`);
}
fs.writeFileSync(options.file, JSON.stringify(settings, null, 2) + "\n");
console.log("Written.");
