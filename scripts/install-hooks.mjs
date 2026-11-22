#!/usr/bin/env node
// Merge claude-office hook entries into a Claude Code settings.json (dry-run by default).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** highest valid TCP port */
const MAX_PORT = 65535;

const HELP = `Usage: node scripts/install-hooks.mjs (--global | --project <dir> | --file <path>) [options]

Target (one required):
  --global           ~/.claude/settings.json
  --project <dir>    <dir>/.claude/settings.json
  --file <path>      explicit settings file

Options:
  --apply            actually write (default is dry-run). A backup
                     settings.json.bak-YYYYMMDD-HHMMSS is made first.
  --uninstall        remove only our curl hooks (localhost:<port>/events)
  --port N           use port N instead of 5050 in installed commands
  --help             show this help
`;

const die = (message) => {
  console.error("error: " + message);
  process.exit(1);
};

const parseArgs = (argv) => {
  const parsed = { apply: false, uninstall: false, port: 5050 };
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
    else if (arg === "--global") targets.push(path.join(os.homedir(), ".claude", "settings.json"));
    else if (arg === "--project") targets.push(path.join(path.resolve(val()), ".claude", "settings.json"));
    else if (arg === "--file") targets.push(path.resolve(val()));
    else if (arg === "--port") {
      const port = Number(val());
      if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) die("invalid --port");
      parsed.port = port;
    } else die(`unknown argument ${arg}\n\n${HELP}`);
  }
  if (targets.length !== 1) die(`exactly one of --global, --project, --file is required\n\n${HELP}`);
  parsed.file = targets[0];
  return parsed;
};

const isOurs = (cmd, port) =>
  typeof cmd === "string" &&
  cmd.includes("/events") &&
  (port == null ? /localhost:\d+\/events/.test(cmd) : cmd.includes(`localhost:${port}`));

const hookCmds = (group) => (Array.isArray(group?.hooks) ? group.hooks : []).map((hook) => hook?.command);

const stamp = () => {
  const date = new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const options = parseArgs(process.argv.slice(2));

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
  const examplePath = path.resolve(here, "..", "hooks", "settings.example.json");
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
    if ((existing ?? []).some((group) => hookCmds(group).some((command) => isOurs(command, options.port)))) {
      log.push(`  = ${event}: already installed, skipped`);
      continue;
    }
    const add = JSON.parse(JSON.stringify(groups).replace(/localhost:\d+/g, `localhost:${options.port}`));
    settings.hooks ??= {};
    settings.hooks[event] = [...(existing ?? []), ...add];
    log.push(
      `  + ${event}: add ${add.length} matcher group(s)${add[0]?.matcher ? ` (matcher ${add[0].matcher})` : ""}`,
    );
  }
} else {
  for (const event of Object.keys(settings.hooks ?? {})) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) continue;
    let removed = 0;
    const kept = [];
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) {
        kept.push(group);
        continue;
      }
      const hooks = group.hooks.filter((hook) => !isOurs(hook?.command, null));
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
