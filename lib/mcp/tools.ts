import path from "node:path";
import { z } from "zod";
import { addEvent, MCP_PREFIX, releaseClaims, store, touchSession } from "@/lib/store";
import { displayPath, resolveTarget } from "@/lib/territory";

// Guild MCP tools as plain functions over the store (the route only adapts them to the MCP SDK).

export const MAX_FILES = 20;
/** The store shrinks event strings to 300 chars, so longer paths cannot be tracked faithfully. */
export const MAX_PATH = 300;
export const MAX_MESSAGE = 140;
export const MAX_MEMBERS = 50;
const SHOUT_HISTORY = 10;

const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]", "g");
const clean = (s: string, max: number) => s.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);

const nameSchema = z.string().regex(/^[a-z0-9-]{1,24}$/, "name must match [a-z0-9-], 1-24 chars (e.g. 'alice-api')");
const cwdSchema = z.string().max(512).optional().describe("Absolute path of your project directory; relative file paths resolve against it");
const fileSchema = z.string().min(1).max(512);

export const schemas = {
  guild_join: { name: nameSchema.describe("Your unique handle, [a-z0-9-] max 24"), project: z.string().max(60).optional(), cwd: cwdSchema },
  guild_status: {},
  who_holds: { file: fileSchema.describe("File path to check"), cwd: cwdSchema },
  claim: { name: nameSchema, files: z.array(fileSchema).min(1).max(MAX_FILES), cwd: cwdSchema },
  release: { name: nameSchema, files: z.array(fileSchema).max(MAX_FILES).optional(), cwd: cwdSchema },
  shout: { name: nameSchema, message: z.string().min(1).max(MAX_MESSAGE) },
  guild_leave: { name: nameSchema },
} as const;

export type ToolResult = { ok: boolean; text: string };
const ok = (v: unknown): ToolResult => ({ ok: true, text: typeof v === "string" ? v : JSON.stringify(v) });
const fail = (m: string): ToolResult => ({ ok: false, text: m });

function parse<K extends keyof typeof schemas>(tool: K, input: unknown): { data: z.infer<z.ZodObject<(typeof schemas)[K]>> } | { error: ToolResult } {
  const r = z.object(schemas[tool]).safeParse(input ?? {});
  if (!r.success) return { error: fail("invalid input: " + r.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")) };
  return { data: r.data as never };
}

const sidOf = (name: string) => MCP_PREFIX + name;
const nameOf = (sid: string) => (sid.startsWith(MCP_PREFIX) ? sid.slice(MCP_PREFIX.length) : sid.slice(0, 8));
let seq = 0;
const toolUseId = (name: string) => `mcp-${name}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

// Real cwd given at join (the session's own cwd may be a fake "/project" placeholder), kept across HMR like the store.
const gg = globalThis as typeof globalThis & { __guildCwd?: Map<string, string>; __guildShouts?: { name: string; text: string; at: number }[] };
const memberCwd = (gg.__guildCwd ??= new Map<string, string>());
const shouts = (gg.__guildShouts ??= []);

const FULL = `the guild is full (max ${MAX_MEMBERS} MCP members); try again later`;
const mcpCount = () => {
  let n = 0;
  for (const id of store.sessions.keys()) if (id.startsWith(MCP_PREFIX)) n++;
  return n;
};

/** "full" when a NEW member would exceed the cap. */
function ensureMember(name: string, cwd?: string, project?: string): "created" | "exists" | "full" {
  const sid = sidOf(name);
  const realCwd = cwd ? clean(cwd, 300) : "";
  if (store.sessions.has(sid)) {
    touchSession(sid);
    if (realCwd) memberCwd.set(sid, realCwd);
    return "exists";
  }
  if (mcpCount() >= MAX_MEMBERS) return "full";
  if (memberCwd.size > 200) for (const k of memberCwd.keys()) if (!store.sessions.has(k)) memberCwd.delete(k);
  if (realCwd) memberCwd.set(sid, realCwd);
  else memberCwd.delete(sid);
  const dir = realCwd || (project ? "/" + clean(project, 40).replace(/[^\w.-]+/g, "-") : "");
  addEvent({ session_id: sid, hook_event_name: "SessionStart", cwd: dir, source: "mcp" });
  return "created";
}

/** explicit cwd, else the cwd the member gave at join, else undefined */
function effectiveCwd(name: string, cwd?: string): string | undefined {
  if (cwd) return clean(cwd, 300) || undefined;
  return memberCwd.get(sidOf(name));
}

const NEED_CWD = "relative path needs a cwd: pass cwd, or give cwd in guild_join, or use absolute paths";
const needsCwd = (files: string[], cwd: string | undefined) => !cwd && files.some((f) => !path.isAbsolute(f));

function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return s < 90 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

export function guildJoin(input: unknown): ToolResult {
  const p = parse("guild_join", input);
  if ("error" in p) return p.error;
  const { name, project, cwd } = p.data;
  const r = ensureMember(name, cwd, project);
  if (r === "full") return fail(FULL);
  return ok({
    member: sidOf(name),
    status: r === "created" ? "joined" : "already in the guild (refreshed)",
    expires: "after 30 min without any guild tool call",
    tips: [
      "Before editing a shared file call who_holds({file, cwd}).",
      "Call claim({name, files, cwd}) for files you will edit, and release({name}) when done.",
      "Use guild_status to see who is working on what; shout for short team messages.",
    ],
  });
}

export function guildStatus(): ToolResult {
  const now = Date.now();
  const t = store.territory.snapshot();
  const claimsBySid = new Map(t.claims.map((c) => [c.sid, c.files]));
  const members = [...store.sessions.values()].map((s) => ({
    id: s.session_id.startsWith(MCP_PREFIX) ? nameOf(s.session_id) : s.session_id.slice(0, 8),
    via: s.session_id.startsWith(MCP_PREFIX) ? "mcp" : "hooks",
    project: s.cwd ? path.basename(s.cwd) : "",
    activity: s.waiting ? "waiting for user" : `${s.lastEvent ?? "?"} ${ago(s.lastSeen)}`,
    squires: s.interns.size,
    claims: claimsBySid.get(s.session_id) ?? [],
  }));
  return ok({
    members,
    shouts: shouts.slice(-SHOUT_HISTORY).map((h) => ({ who: h.name, message: h.text, at: ago(h.at) })),
    conflicts: t.conflicts.map((c) => ({ file: c.file, level: c.level, who: c.sids.map(nameOf), since: ago(c.since), ...(c.failer ? { failed: nameOf(c.failer) } : {}) })),
    at: new Date(now).toISOString(),
  });
}

export function whoHolds(input: unknown): ToolResult {
  const p = parse("who_holds", input);
  if ("error" in p) return p.error;
  const { file } = p.data;
  const cwd = p.data.cwd ? clean(p.data.cwd, 300) || undefined : undefined;
  if (needsCwd([file], cwd)) return fail(NEED_CWD);
  if (file.length > MAX_PATH) return fail(`path longer than ${MAX_PATH} chars cannot be tracked`);
  const abs = resolveTarget(cwd, file);
  if (!abs) return ok({ file, tracked: false, note: "path is ignored (node_modules, .git, .next, tmp); nobody can claim it" });
  const holders = store.territory.holdersOf(abs, Date.now()).map((h) => ({ who: nameOf(h.sid), kind: h.kind === "claim" ? "claims (editing)" : "touched recently", since: ago(h.at) }));
  return ok({
    file: displayPath(abs, cwd),
    holders,
    free: holders.length === 0,
  });
}

export function claim(input: unknown): ToolResult {
  const p = parse("claim", input);
  if ("error" in p) return p.error;
  const { name, files } = p.data;
  if (ensureMember(name, p.data.cwd) === "full") return fail(FULL);
  const cleanCwd = effectiveCwd(name, p.data.cwd);
  if (needsCwd(files, cleanCwd)) return fail(NEED_CWD);
  const sid = sidOf(name);
  const claimed: string[] = [];
  const skipped: string[] = [];
  const conflicts: { file: string; heldBy: string[] }[] = [];
  for (const f of [...new Set(files)]) {
    const abs = f.length <= MAX_PATH ? resolveTarget(cleanCwd, f) : null;
    if (!abs || abs.length > MAX_PATH) {
      skipped.push(f);
      continue;
    }
    addEvent({ session_id: sid, hook_event_name: "PreToolUse", tool_name: "Write", tool_use_id: toolUseId(name), cwd: cleanCwd, tool_input: { file_path: abs } });
    claimed.push(displayPath(abs, cleanCwd));
    const others = store.territory.holdersOf(abs, Date.now()).filter((h) => h.sid !== sid);
    if (others.length) conflicts.push({ file: displayPath(abs, cleanCwd), heldBy: others.map((h) => `${nameOf(h.sid)} (${h.kind === "claim" ? "claim" : "recent"}, ${ago(h.at)})`) });
  }
  return ok({
    claimed,
    skipped: skipped.length ? { files: skipped, reason: "ignored path (node_modules/.git/.next/tmp) or too long" } : undefined,
    conflicts,
    advice: conflicts.length ? "Others hold some files. Coordinate (shout) or pick other files before editing." : "No conflicts. Call release when done.",
  });
}

export function release(input: unknown): ToolResult {
  const p = parse("release", input);
  if ("error" in p) return p.error;
  const { name, files } = p.data;
  const sid = sidOf(name);
  if (!store.sessions.has(sid)) return fail(`no member '${name}' (join first, or it expired)`);
  touchSession(sid);
  const cleanCwd = effectiveCwd(name, p.data.cwd);
  if (files && needsCwd(files, cleanCwd)) return fail(NEED_CWD);
  let abs: string[] | undefined;
  if (files && files.length) abs = files.map((f) => (f.length <= MAX_PATH ? resolveTarget(cleanCwd, f) : null)).filter((x): x is string => !!x);
  const changed = releaseClaims(sid, abs);
  return ok({ released: abs ? abs.map((a) => displayPath(a, cleanCwd)) : "all", changed });
}

export function shout(input: unknown): ToolResult {
  const p = parse("shout", input);
  if ("error" in p) return p.error;
  const { name, message } = p.data;
  const msg = clean(message, MAX_MESSAGE);
  if (!msg) return fail("empty message");
  if (ensureMember(name) === "full") return fail(FULL);
  shouts.push({ name, text: msg, at: Date.now() });
  if (shouts.length > SHOUT_HISTORY) shouts.splice(0, shouts.length - SHOUT_HISTORY);
  addEvent({ session_id: sidOf(name), hook_event_name: "Notification", notification_type: "guild_shout", message: msg });
  return ok({ shouted: msg });
}

export function guildLeave(input: unknown): ToolResult {
  const p = parse("guild_leave", input);
  if ("error" in p) return p.error;
  const sid = sidOf(p.data.name);
  if (!store.sessions.has(sid)) return ok({ left: false, note: "not in the guild" });
  addEvent({ session_id: sid, hook_event_name: "SessionEnd" });
  memberCwd.delete(sid);
  return ok({ left: true });
}
