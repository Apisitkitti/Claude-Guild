import { readContext, type ContextUsage } from "@/lib/transcript";

// In-memory event + session store shared by route handlers.
// Kept on globalThis so it survives dev hot-reloads and is shared across route modules.

export type HookEvent = {
  session_id?: string;
  hook_event_name?: string;
  cwd?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  receivedAt: number;
  [key: string]: unknown;
};

type Session = {
  session_id: string;
  cwd: string;
  firstSeen: number;
  lastSeen: number;
  lastEvent: string | null;
  interns: Set<string>;
  context: ContextUsage | null;
  /** main agent is blocked on the user (permission prompt) — lets a reloaded page restore the ❗ */
  waiting: boolean;
};

type Client = (chunk: string) => void;

const MAX_EVENTS = 200;
const SNAPSHOT_EVENTS = 50;
const STALE_MS = 10 * 60 * 1000;
const TOMBSTONE_MS = 60 * 1000;

type Store = {
  events: HookEvent[];
  sessions: Map<string, Session>;
  ended: Map<string, number>; // session_id -> endedAt; hooks are async so late events can arrive after SessionEnd
  clients: Set<Client>;
  startedAt: number;
  ctxTimers: Map<string, ReturnType<typeof setTimeout>>; // per-session debounce for transcript reads
  ctxSeq: Map<string, number>; // per-session sequence; in-flight reads with a stale seq are dropped
  ctxInflight: number;
};

const STORE_VERSION = 6; // bump when Store shape changes so dev HMR rebuilds it

const g = globalThis as typeof globalThis & { __claudeOffice?: Store & { version?: number } };

type Timers = { ping: ReturnType<typeof setInterval>; sweep: ReturnType<typeof setInterval> };

function createStore(): Store & { version: number; timers: Timers } {
  const store = { events: [], sessions: new Map(), ended: new Map(), clients: new Set(), ctxTimers: new Map(), ctxSeq: new Map(), ctxInflight: 0, startedAt: Date.now(), version: STORE_VERSION } as unknown as Store & {
    version: number;
    timers: Timers;
  };
  const ping = setInterval(() => broadcastRaw(store, ": ping\n\n"), 15_000);
  const sweep = setInterval(() => {
    const cutoff = Date.now() - STALE_MS;
    for (const [id, s] of store.sessions) if (s.lastSeen < cutoff) dropSession(id);
    const tombCutoff = Date.now() - TOMBSTONE_MS;
    for (const [id, at] of store.ended) if (at < tombCutoff) store.ended.delete(id);
  }, 30_000);
  ping.unref?.();
  sweep.unref?.();
  store.timers = { ping, sweep };
  return store;
}

function getStore(): Store {
  const existing = g.__claudeOffice as (Store & { version?: number; timers?: Timers }) | undefined;
  if (existing && existing.version === STORE_VERSION) return existing;
  if (existing?.ctxTimers) for (const t of existing.ctxTimers.values()) clearTimeout(t);
  if (existing?.timers) {
    clearInterval(existing.timers.ping);
    clearInterval(existing.timers.sweep);
  }
  const fresh = createStore();
  if (existing) fresh.clients = existing.clients; // keep connected SSE clients across shape changes
  g.__claudeOffice = fresh;
  return fresh;
}

export const store: Store = getStore();

function broadcastRaw(s: Store, chunk: string) {
  for (const send of s.clients) {
    try {
      send(chunk);
    } catch {
      s.clients.delete(send);
    }
  }
}

function dropSession(id: string) {
  store.sessions.delete(id);
  const t = store.ctxTimers.get(id);
  if (t) clearTimeout(t);
  store.ctxTimers.delete(id);
  store.ctxSeq.delete(id);
}

function bumpSeq(id: string): number {
  const n = (store.ctxSeq.get(id) ?? 0) + 1;
  store.ctxSeq.set(id, n);
  return n;
}

function broadcastContext(id: string, c: ContextUsage | null) {
  const data = { session_id: id, used: c ? c.used : null, limit: c ? c.limit : null, limitGuessed: c ? c.limitGuessed : false };
  broadcastRaw(store, `event: context\ndata: ${JSON.stringify(data)}\n\n`);
}

const CTX_DEBOUNCE_MS = 500;
const CTX_READ_EVENTS = new Set(["Stop", "PostToolUse", "UserPromptSubmit", "SessionStart"]);

const MAX_SESSIONS = 200;
const MAX_INFLIGHT_READS = 4;

function scheduleContext(id: string, transcriptPath: string) {
  const old = store.ctxTimers.get(id);
  if (old) clearTimeout(old);
  const seq = bumpSeq(id);
  const t = setTimeout(() => {
    store.ctxTimers.delete(id);
    if (store.ctxInflight >= MAX_INFLIGHT_READS) {
      // Too many reads in flight: try again shortly (same seq, so any newer schedule still wins).
      const retry = setTimeout(() => {
        store.ctxTimers.delete(id);
        if (store.ctxSeq.get(id) === seq && store.sessions.has(id)) scheduleContext(id, transcriptPath);
      }, CTX_DEBOUNCE_MS);
      retry.unref?.();
      store.ctxTimers.set(id, retry);
      return;
    }
    store.ctxInflight++;
    readContext(transcriptPath)
      .then((c) => {
        if (store.ctxSeq.get(id) !== seq) return; // reset or newer read superseded this one
        const s = store.sessions.get(id);
        if (!c || !s) return; // not found: keep previous value
        if ("compacted" in c) {
          s.context = null;
          broadcastContext(id, null);
          return;
        }
        s.context = c;
        broadcastContext(id, c);
      })
      .catch(() => {})
      .finally(() => {
        store.ctxInflight--;
      });
  }, CTX_DEBOUNCE_MS);
  t.unref?.();
  store.ctxTimers.set(id, t);
}

function handleContext(evt: HookEvent, transcriptPath: unknown) {
  const id = evt.session_id;
  const name = evt.hook_event_name;
  if (!id || !name || !store.sessions.has(id)) return;
  if (name === "PreCompact" || (name === "SessionStart" && evt.source === "compact")) {
    const t = store.ctxTimers.get(id);
    if (t) clearTimeout(t);
    store.ctxTimers.delete(id);
    bumpSeq(id);
    const s = store.sessions.get(id)!;
    s.context = null;
    broadcastContext(id, null);
    if (name === "PreCompact") return;
  }
  if (CTX_READ_EVENTS.has(name) && typeof transcriptPath === "string" && transcriptPath) scheduleContext(id, transcriptPath);
}

function updateSessions(evt: HookEvent) {
  const id = evt.session_id;
  if (!id) return;
  if (evt.hook_event_name === "SessionEnd") {
    dropSession(id);
    store.ended.set(id, evt.receivedAt);
    return;
  }
  if (evt.hook_event_name === "SessionStart") store.ended.delete(id);
  else if (store.ended.has(id)) return; // late event after SessionEnd: don't resurrect
  let s = store.sessions.get(id);
  if (!s) {
    s = { session_id: id, cwd: evt.cwd ?? "", firstSeen: evt.receivedAt, lastSeen: evt.receivedAt, lastEvent: null, interns: new Set(), context: null, waiting: false };
    store.sessions.set(id, s);
    if (store.sessions.size > MAX_SESSIONS) {
      let oldest: string | null = null;
      let oldestSeen = Infinity;
      for (const [sid, other] of store.sessions) {
        if (sid !== id && other.lastSeen < oldestSeen) {
          oldest = sid;
          oldestSeen = other.lastSeen;
        }
      }
      if (oldest) dropSession(oldest);
    }
  }
  s.lastSeen = evt.receivedAt;
  s.lastEvent = evt.hook_event_name ?? null;
  if (!evt.agent_id) {
    const n = evt.hook_event_name;
    if (n === "PermissionRequest" || (n === "Notification" && evt.notification_type === "permission_prompt")) s.waiting = true;
    else if (n === "PreToolUse" || n === "PostToolUse" || n === "PostToolUseFailure" || n === "UserPromptSubmit" || n === "Stop" || n === "SessionStart") s.waiting = false;
  }
  if (evt.cwd) s.cwd = evt.cwd;
  // SubagentStart/Stop carry agent_id of the subagent itself.
  if (evt.hook_event_name === "SubagentStart" && evt.agent_id) s.interns.add(evt.agent_id);
  if (evt.hook_event_name === "SubagentStop" && evt.agent_id) s.interns.delete(evt.agent_id);
}

function logEvent(evt: HookEvent) {
  const t = new Date(evt.receivedAt).toTimeString().slice(0, 8);
  const sid = String(evt.session_id ?? "-").slice(0, 8);
  const who = evt.agent_id ? ` (intern ${evt.agent_type ?? evt.agent_id.slice(0, 6)})` : "";
  const tool = evt.tool_name ? ` ${evt.tool_name}` : "";
  console.log(`${t} ${sid} ${evt.hook_event_name ?? "?"}${tool}${who}`);
}

const MAX_STRING = 300;
const MAX_KEYS = 20;

// The office only needs small hints (file name, command, pattern...). Drop tool_response and shrink
// big strings so stored events / SSE snapshots stay small and file contents aren't kept in memory.
function slim(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  if (value === null || typeof value !== "object") return value;
  if (depth >= 2) return Array.isArray(value) ? `[${value.length} items]` : "{…}";
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((v) => slim(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value).slice(0, MAX_KEYS)) out[k] = slim(v, depth + 1);
  return out;
}

const DROP_KEYS = new Set(["tool_response", "last_assistant_message", "prompt", "custom_instructions"]);

export function addEvent(raw: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (DROP_KEYS.has(k)) continue;
    clean[k] = k === "tool_input" ? slim(v) : slim(v, 1);
  }
  const evt = { ...clean, receivedAt: Date.now() } as HookEvent;
  store.events.push(evt);
  if (store.events.length > MAX_EVENTS) store.events.splice(0, store.events.length - MAX_EVENTS);
  updateSessions(evt);
  logEvent(evt);
  broadcastRaw(store, `data: ${JSON.stringify(evt)}\n\n`);
  try {
    handleContext(evt, raw.transcript_path);
  } catch {}
}

export function snapshot() {
  return {
    sessions: [...store.sessions.values()].map((s) => ({ ...s, interns: [...s.interns] })),
    events: store.events.slice(-SNAPSHOT_EVENTS),
  };
}

export function subscribe(send: Client) {
  store.clients.add(send);
  return () => store.clients.delete(send);
}

// No CORS: the UI is same-origin and hooks use curl. Reject browser requests from other origins
// (Origin header set by browsers; curl sends none) so random websites can't read or inject events.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(host: string | null): string {
  return (host ?? "").replace(/:\d+$/, "").toLowerCase();
}

export function isForeignOrigin(req: Request): boolean {
  // Host allowlist blocks DNS-rebinding (evil.example resolving to 127.0.0.1).
  if (!LOCAL_HOSTNAMES.has(hostnameOf(req.headers.get("host")))) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}
