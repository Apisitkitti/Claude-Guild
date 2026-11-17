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
};

const STORE_VERSION = 3; // bump when Store shape changes so dev HMR rebuilds it

const g = globalThis as typeof globalThis & { __claudeOffice?: Store & { version?: number } };

type Timers = { ping: ReturnType<typeof setInterval>; sweep: ReturnType<typeof setInterval> };

function createStore(): Store & { version: number; timers: Timers } {
  const store = { events: [], sessions: new Map(), ended: new Map(), clients: new Set(), startedAt: Date.now(), version: STORE_VERSION } as unknown as Store & {
    version: number;
    timers: Timers;
  };
  const ping = setInterval(() => broadcastRaw(store, ": ping\n\n"), 15_000);
  const sweep = setInterval(() => {
    const cutoff = Date.now() - STALE_MS;
    for (const [id, s] of store.sessions) if (s.lastSeen < cutoff) store.sessions.delete(id);
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

function updateSessions(evt: HookEvent) {
  const id = evt.session_id;
  if (!id) return;
  if (evt.hook_event_name === "SessionEnd") {
    store.sessions.delete(id);
    store.ended.set(id, evt.receivedAt);
    return;
  }
  if (evt.hook_event_name === "SessionStart") store.ended.delete(id);
  else if (store.ended.has(id)) return; // late event after SessionEnd: don't resurrect
  let s = store.sessions.get(id);
  if (!s) {
    s = { session_id: id, cwd: evt.cwd ?? "", firstSeen: evt.receivedAt, lastSeen: evt.receivedAt, lastEvent: null, interns: new Set() };
    store.sessions.set(id, s);
  }
  s.lastSeen = evt.receivedAt;
  s.lastEvent = evt.hook_event_name ?? null;
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
