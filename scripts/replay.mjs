#!/usr/bin/env node
// Replay realistic Claude Code hook payloads to the office server's /events endpoint.
import { randomUUID } from "node:crypto";

const HELP = `replay.mjs - drive Live mode with fake Claude Code hook events

Usage:
  node scripts/replay.mjs scenario [--sessions N] [--speed X] [--url URL]
  node scripts/replay.mjs one <EventName> [--session id] [--tool Bash] [--url URL]
  node scripts/replay.mjs --help

Options:
  --url URL       server base URL (default http://localhost:5050, env OFFICE_URL)
  --sessions N    concurrent sessions in scenario (default 2)
  --speed X       divide delays by X (default 1)
  --session id    session id for 'one' (default: random)
  --tool name     tool name for 'one' tool events (default Bash)

Ctrl-C during scenario sends SessionEnd for all live sessions.`;

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--help" || a === "-h") flags.help = true;
  else if (a.startsWith("--")) flags[a.slice(2)] = argv[++i];
  else pos.push(a);
}
if (flags.help) { console.log(HELP); process.exit(0); }

const URL_BASE = (flags.url || process.env.OFFICE_URL || "http://localhost:5050").replace(/\/$/, "");
const SPEED = Math.max(0.01, Number(flags.speed) || 1);
const mode = pos[0] || "scenario";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const delay = (a = 0.5, b = 4) => sleep((rnd(a, b) * 1000) / SPEED);

const PROJECTS = ["dragon-shop", "quest-qa", "rune-auth", "gold-split"];
const FILES = ["src/app/page.tsx", "src/lib/auth.ts", "src/components/Header.tsx", "package.json", "src/server/routes.ts", "README.md"];
const PROMPTS = ["fix the login redirect bug", "add pagination to the list page", "why is this test flaky?", "refactor the auth middleware"];

const live = new Map(); // session_id -> base fields

function base(sid, cwd, name, extra = {}) {
  return {
    session_id: sid,
    transcript_path: `/Users/dev/.claude/projects/${cwd.replace(/\//g, "-")}/${sid}.jsonl`,
    cwd,
    permission_mode: "default",
    hook_event_name: name,
    ...extra,
  };
}

async function send(payload) {
  let res;
  try {
    res = await fetch(`${URL_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error(`error: cannot reach ${URL_BASE}/events (${e.cause?.code || e.message}). Is the server running?`);
    process.exit(1);
  }
  if (!res.ok) console.error(`warn: server replied ${res.status}`);
  const who = payload.agent_id ? ` [${payload.agent_type}]` : "";
  const tool = payload.tool_name ? ` ${payload.tool_name}` : "";
  console.log(`${payload.session_id.slice(0, 8)} ${payload.hook_event_name}${tool}${who}`);
}

function toolInput(tool) {
  switch (tool) {
    case "Read": return { file_path: pick(FILES) };
    case "Edit": return { file_path: pick(FILES), old_string: "foo", new_string: "bar" };
    case "Write": return { file_path: pick(FILES), content: "// generated\n" };
    case "Grep": return { pattern: pick(["TODO", "useAuth", "redirect", "handleSubmit"]), path: "src" };
    case "Glob": return { pattern: "src/**/*.ts" };
    case "Bash": return { command: pick(["npm test", "git status", "npx tsc --noEmit", "ls -la src"]), description: "Run command" };
    case "WebSearch": return { query: pick(["next.js redirect after login", "line liff init error"]) };
    case "WebFetch": return { url: "https://nextjs.org/docs/app/api-reference", prompt: "summarize" };
    case "TaskCreate": return { subject: "Implement fix", description: "Track the fix work", activeForm: "Implementing fix" };
    case "Agent": return { description: "Explore codebase", prompt: "Find where auth is handled", subagent_type: "Explore" };
    case "mcp__linear__list_issues": return { assignee: "me", limit: 10 };
    default: return { command: "echo hi" };
  }
}

async function toolStep(s, tool, agent, dur = [0.5, 3]) {
  const id = "toolu_" + randomUUID().replace(/-/g, "").slice(0, 24);
  const extra = { tool_name: tool, tool_input: toolInput(tool), tool_use_id: id, ...(agent || {}) };
  await send({ ...base(s.sid, s.cwd, "PreToolUse", extra) });
  const t0 = Date.now();
  await delay(dur[0], dur[1]);
  await send({ ...base(s.sid, s.cwd, "PostToolUse", { ...extra, tool_response: {}, duration_ms: Math.round((Date.now() - t0) * SPEED) }) });
}

async function runSession(project) {
  const s = { sid: randomUUID(), cwd: `/Users/dev/projects/${project}` };
  live.set(s.sid, s);
  await send(base(s.sid, s.cwd, "SessionStart", { source: "startup" }));
  await delay(0.5, 1.5);
  await send(base(s.sid, s.cwd, "UserPromptSubmit", { prompt: pick(PROMPTS) }));
  await delay(0.5, 2);

  const steps = ["Read", "Grep", "Edit", "Bash", "WebSearch", "TaskCreate", "mcp__linear__list_issues", "Read", "Edit"]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4 + Math.floor(rnd(0, 3)));
  steps.splice(Math.floor(rnd(1, steps.length)), 0, "Agent");
  const permAt = Math.floor(rnd(1, steps.length));

  for (let i = 0; i < steps.length; i++) {
    if (i === permAt) {
      await send(base(s.sid, s.cwd, "Notification", {
        message: "Claude needs your permission to use Bash",
        notification_type: "permission_prompt",
      }));
      await sleep(4000 / SPEED);
    }
    if (steps[i] === "Agent") {
      const agent = { agent_id: randomUUID().replace(/-/g, "").slice(0, 17), agent_type: pick(["Explore", "general-purpose"]) };
      const id = "toolu_" + randomUUID().replace(/-/g, "").slice(0, 24);
      const extra = { tool_name: "Agent", tool_input: toolInput("Agent"), tool_use_id: id };
      await send(base(s.sid, s.cwd, "PreToolUse", extra));
      await send(base(s.sid, s.cwd, "SubagentStart", agent));
      const n = 2 + Math.floor(rnd(0, 2));
      for (let k = 0; k < n; k++) await toolStep(s, pick(["Read", "Grep"]), agent, [0.5, 2]);
      await send(base(s.sid, s.cwd, "SubagentStop", { ...agent, stop_hook_active: false }));
      await send(base(s.sid, s.cwd, "PostToolUse", { ...extra, tool_response: {}, duration_ms: 3000 }));
    } else {
      await toolStep(s, steps[i], null);
    }
    await delay(0.5, 2);
  }
  await send(base(s.sid, s.cwd, "Stop", { stop_hook_active: false }));
  await delay(0.5, 1.5);
  await endSession(s);
}

async function endSession(s) {
  if (!live.has(s.sid)) return;
  live.delete(s.sid);
  await send(base(s.sid, s.cwd, "SessionEnd", { reason: "prompt_input_exit" }));
}

if (mode === "scenario") {
  const n = Math.max(1, parseInt(flags.sessions) || 2);
  let stopping = false;
  process.on("SIGINT", async () => {
    if (stopping) process.exit(130);
    stopping = true;
    console.log("\nSIGINT: ending live sessions...");
    for (const s of [...live.values()]) await endSession(s);
    process.exit(130);
  });
  const projects = [...PROJECTS].sort(() => Math.random() - 0.5);
  await Promise.all(Array.from({ length: n }, async (_, i) => {
    await sleep((i * 700) / SPEED);
    await runSession(projects[i % projects.length]);
  }));
} else if (mode === "one") {
  const name = pos[1];
  if (!name) { console.error("error: missing <EventName>\n\n" + HELP); process.exit(1); }
  const sid = flags.session || randomUUID();
  const cwd = `/Users/dev/projects/${pick(PROJECTS)}`;
  const extra = {};
  if (/ToolUse$/.test(name) || name === "PostToolUseFailure") {
    const tool = flags.tool || "Bash";
    Object.assign(extra, { tool_name: tool, tool_input: toolInput(tool), tool_use_id: "toolu_" + randomUUID().replace(/-/g, "").slice(0, 24) });
    if (name === "PostToolUse") Object.assign(extra, { tool_response: {}, duration_ms: 1200 });
  }
  if (name === "SessionStart") extra.source = "startup";
  if (name === "SessionEnd") extra.reason = "prompt_input_exit";
  if (name === "UserPromptSubmit") extra.prompt = pick(PROMPTS);
  if (name === "Notification") Object.assign(extra, { message: "Claude is waiting for your input", notification_type: "idle_prompt" });
  if (name === "SubagentStart" || name === "SubagentStop") Object.assign(extra, { agent_id: randomUUID().replace(/-/g, "").slice(0, 17), agent_type: "Explore" });
  await send(base(sid, cwd, name, extra));
} else {
  console.error(`error: unknown mode '${mode}'\n\n` + HELP);
  process.exit(1);
}
