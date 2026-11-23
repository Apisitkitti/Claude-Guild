import { isAgentSource, type AgentSource } from "@/lib/adapters/types";
import { AttentionTracker, type AttentionRow } from "@/lib/attention";
import { ChronicleTracker, CHRONICLE_THROTTLE_MS } from "@/lib/chronicle";
import { MS_PER_MINUTE, MS_PER_SECOND } from "@/lib/constants";
import { QuestBoardTracker, type QuestRow } from "@/lib/questBoard";
import { buildRateLimit, isLimitExpired, limitHoldUntil, sanitizeModel, type RateLimit } from "@/lib/rateLimit";
import { ReceiptTracker, type ReceiptRow } from "@/lib/receipts";
import { redactDeep } from "@/lib/redact";
import { TerritoryTracker } from "@/lib/territory";
import { readContext, type ContextUsage } from "@/lib/transcript";

// In-memory event + session store shared by route handlers.
// Kept on globalThis so it survives dev hot-reloads and is shared across route modules.

export type { RateLimit } from "@/lib/rateLimit";

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
  /** when `waiting` last turned true (cleared with it) */
  waitingSince: number | null;
  /** which AI tool the session belongs to (`agent_source` of its events; Claude Code events have none) */
  source: AgentSource;
  /** raw model id, e.g. "claude-opus-5-5"; null until known */
  model: string | null;
  /** set while the session is stopped by its plan usage limit */
  rateLimit: RateLimit | null;
};

type Client = (chunk: string) => void;

const MAX_EVENTS = 200;
/** SSE keep-alive comment interval */
const PING_INTERVAL_SECONDS = 15;
const PING_INTERVAL_MS = PING_INTERVAL_SECONDS * MS_PER_SECOND;
/** stale session / tombstone sweep interval */
const SWEEP_INTERVAL_SECONDS = 30;
const SWEEP_INTERVAL_MS = SWEEP_INTERVAL_SECONDS * MS_PER_SECOND;
/** console log: chars of HH:MM:SS, session id and agent id shown */
const LOG_TIME_CHARS = 8;
const LOG_ID_CHARS = 8;
const LOG_AGENT_ID_CHARS = 6;
const SNAPSHOT_EVENTS = 50;
const STALE_MINUTES = 10;
const STALE_MS = STALE_MINUTES * MS_PER_MINUTE;
const TOMBSTONE_MS = MS_PER_MINUTE;

type Store = {
  events: HookEvent[];
  sessions: Map<string, Session>;
  ended: Map<string, number>; // session_id -> endedAt; hooks are async so late events can arrive after SessionEnd
  clients: Set<Client>;
  startedAt: number;
  ctxTimers: Map<string, ReturnType<typeof setTimeout>>; // per-session debounce for transcript reads
  ctxSeq: Map<string, number>; // per-session sequence; in-flight reads with a stale seq are dropped
  ctxInflight: number;
  territory: TerritoryTracker;
  attention: AttentionTracker;
  attentionJson: string;
  receipts: ReceiptTracker;
  receiptsJson: string;
  chronicle: ChronicleTracker;
  chronicleJson: string;
  chronicleSentAt: number;
  chronicleTimer: ReturnType<typeof setTimeout> | null;
  quests: QuestBoardTracker;
  questsJson: string;
  limitClearedAt: Map<string, number>; // session_id -> when a limit was last cleared (stale transcript lines are ignored)
  metaSent: Map<string, string>; // session_id -> last session_meta JSON broadcast
};

const STORE_VERSION = 18; // bump when Store shape changes so dev HMR rebuilds it

const globalStore = globalThis as typeof globalThis & { __claudeOffice?: Store & { version?: number } };

type Timers = { ping: ReturnType<typeof setInterval>; sweep: ReturnType<typeof setInterval> };

const createStore = (): Store & { version: number; timers: Timers } => {
  const store = {
    events: [],
    sessions: new Map(),
    ended: new Map(),
    clients: new Set(),
    ctxTimers: new Map(),
    ctxSeq: new Map(),
    ctxInflight: 0,
    territory: new TerritoryTracker(),
    attention: new AttentionTracker(),
    attentionJson: "[]",
    receipts: new ReceiptTracker(),
    receiptsJson: "[]",
    chronicle: new ChronicleTracker(),
    chronicleJson: "",
    chronicleSentAt: 0,
    chronicleTimer: null,
    quests: new QuestBoardTracker(),
    questsJson: "[]",
    metaSent: new Map(),
    limitClearedAt: new Map(),
    startedAt: Date.now(),
    version: STORE_VERSION,
  } as unknown as Store & {
    version: number;
    timers: Timers;
  };
  const ping = setInterval(() => broadcastRaw(store, ": ping\n\n"), PING_INTERVAL_MS);
  const sweep = setInterval(() => {
    const cutoff = Date.now() - STALE_MS;
    for (const [id, session] of store.sessions) {
      const held = session.rateLimit !== null && limitHoldUntil(session.rateLimit) > Date.now();
      if (session.lastSeen < cutoff && !held) dropSession(id);
    }
    const tombCutoff = Date.now() - TOMBSTONE_MS;
    for (const [id, at] of store.ended) if (at < tombCutoff) store.ended.delete(id);
    if (store.territory.sweep(Date.now())) broadcastTerritory(store);
    store.attention.sweep(Date.now());
    refreshAttention(store);
    store.receipts.sweep(Date.now());
    refreshReceipts(store);
    refreshChronicle(store);
    if (store.quests.sweep(Date.now())) refreshQuests(store);
    expireLimits(store, Date.now());
  }, SWEEP_INTERVAL_MS);
  ping.unref?.();
  sweep.unref?.();
  store.timers = { ping, sweep };
  return store;
};

const getStore = (): Store => {
  const existing = globalStore.__claudeOffice as (Store & { version?: number; timers?: Timers }) | undefined;
  if (existing && existing.version === STORE_VERSION) return existing;
  if (existing?.ctxTimers) for (const timer of existing.ctxTimers.values()) clearTimeout(timer);
  if (existing?.chronicleTimer) clearTimeout(existing.chronicleTimer);
  if (existing?.timers) {
    clearInterval(existing.timers.ping);
    clearInterval(existing.timers.sweep);
  }
  const fresh = createStore();
  if (existing) fresh.clients = existing.clients; // keep connected SSE clients across shape changes
  globalStore.__claudeOffice = fresh;
  return fresh;
};

export const store: Store = getStore();

const broadcastRaw = (target: Store, chunk: string) => {
  for (const send of target.clients) {
    try {
      send(chunk);
    } catch {
      target.clients.delete(send);
    }
  }
};

const broadcastTerritory = (target: Store) => {
  broadcastRaw(target, `event: territory\ndata: ${JSON.stringify(target.territory.snapshot())}\n\n`);
};

/**
 * recompute the daily chronicle; broadcast iff it changed, at most once per CHRONICLE_THROTTLE_MS (a change inside the
 * window is sent by a trailing timer). Counts only, never persisted.
 */
const refreshChronicle = (target: Store) => {
  const now = Date.now();
  const json = JSON.stringify(target.chronicle.view(now));
  if (json === target.chronicleJson) return;
  const wait = target.chronicleSentAt + CHRONICLE_THROTTLE_MS - now;
  if (wait > 0) {
    if (!target.chronicleTimer) {
      target.chronicleTimer = setTimeout(() => {
        target.chronicleTimer = null;
        refreshChronicle(target);
      }, wait);
      target.chronicleTimer.unref?.();
    }
    return;
  }
  target.chronicleJson = json;
  target.chronicleSentAt = now;
  broadcastRaw(target, `event: chronicle\ndata: ${json}\n\n`);
};

const attentionQueue = (target: Store): AttentionRow[] => target.attention.queue(Date.now());

/** recompute the Lookout Bell queue; broadcast iff it changed. Never persisted. */
const refreshAttention = (target: Store) => {
  const rows = attentionQueue(target);
  target.chronicle.noteLoops(rows, Date.now());
  const json = JSON.stringify(rows);
  if (json === target.attentionJson) return;
  target.attentionJson = json;
  broadcastRaw(target, `event: attention\ndata: ${json}\n\n`);
};

const receiptRows = (target: Store): ReceiptRow[] => target.receipts.rows(Date.now());

/** recompute the Receipt Ledger; broadcast iff it changed. Counts only, never persisted. */
const refreshReceipts = (target: Store) => {
  const json = JSON.stringify(receiptRows(target));
  if (json === target.receiptsJson) return;
  target.receiptsJson = json;
  broadcastRaw(target, `event: receipts\ndata: ${json}\n\n`);
};

const questRows = (target: Store): QuestRow[] => target.quests.rows();

/** recompute the Quest Board (todo lists); broadcast iff it changed. Redacted text, never persisted. */
const refreshQuests = (target: Store) => {
  const json = JSON.stringify(questRows(target));
  if (json === target.questsJson) return;
  target.questsJson = json;
  broadcastRaw(target, `event: quests\ndata: ${json}\n\n`);
};

const metaOf = (session: Session) => ({
  session_id: session.session_id,
  source: session.source,
  model: session.model,
  rateLimit: session.rateLimit,
});

/** broadcast `session_meta` iff source / model / rateLimit changed since the last frame (defaults are not announced) */
const syncMeta = (target: Store, session: Session) => {
  const json = JSON.stringify(metaOf(session));
  const known = target.metaSent.get(session.session_id);
  if (known === json) return;
  const isDefault = session.source === "claude" && session.model === null && session.rateLimit === null;
  target.metaSent.set(session.session_id, json);
  if (known === undefined && isDefault) return;
  broadcastRaw(target, `event: session_meta\ndata: ${json}\n\n`);
};

const setRateLimit = (target: Store, session: Session, limit: RateLimit | null) => {
  session.rateLimit = limit;
  target.attention.setLimit(session.session_id, limit ? { since: limit.since, detail: limit.resetText } : null);
};

/** lazily clear limits whose reset time has passed; true iff any was cleared */
const expireLimits = (target: Store, now: number): boolean => {
  let changed = false;
  for (const session of target.sessions.values()) {
    if (!isLimitExpired(session.rateLimit, now)) continue;
    setRateLimit(target, session, null);
    syncMeta(target, session);
    changed = true;
  }
  if (changed) refreshAttention(target);
  return changed;
};

const dropSession = (id: string) => {
  store.metaSent.delete(id);
  store.limitClearedAt.delete(id);
  store.quests.dropSession(id, Date.now()); // the board stays a few minutes (grace), then sweep drops it
  refreshQuests(store);
  store.attention.dropSession(id);
  refreshAttention(store);
  store.receipts.dropSession(id, Date.now()); // closed receipts outlive the session
  refreshReceipts(store);
  if (store.territory.dropSession(id, Date.now())) broadcastTerritory(store);
  store.sessions.delete(id);
  const timer = store.ctxTimers.get(id);
  if (timer) clearTimeout(timer);
  store.ctxTimers.delete(id);
  store.ctxSeq.delete(id);
};

const bumpSeq = (id: string): number => {
  const next = (store.ctxSeq.get(id) ?? 0) + 1;
  store.ctxSeq.set(id, next);
  return next;
};

const broadcastContext = (id: string, usage: ContextUsage | null) => {
  const data = {
    session_id: id,
    used: usage ? usage.used : null,
    limit: usage ? usage.limit : null,
    limitGuessed: usage ? usage.limitGuessed : false,
  };
  broadcastRaw(store, `event: context\ndata: ${JSON.stringify(data)}\n\n`);
};

const CTX_DEBOUNCE_MS = 500;
const CTX_READ_EVENTS = new Set(["Stop", "StopFailure", "PostToolUse", "UserPromptSubmit", "SessionStart"]);

const MAX_SESSIONS = 200;
const MAX_INFLIGHT_READS = 4;

const scheduleContext = (id: string, transcriptPath: string) => {
  const old = store.ctxTimers.get(id);
  if (old) clearTimeout(old);
  const seq = bumpSeq(id);
  const timer = setTimeout(() => {
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
      .then((usage) => {
        if (store.ctxSeq.get(id) !== seq) return; // reset or newer read superseded this one
        const session = store.sessions.get(id);
        if (!usage || !session) return; // not found: keep previous value
        if (!("compacted" in usage)) {
          const model = sanitizeModel(usage.model);
          if (model) session.model = model;
          const found = usage.rateLimit;
          const messageAt = found ? (found.at ?? Date.now()) : 0;
          if (found && !session.rateLimit && messageAt >= (store.limitClearedAt.get(id) ?? 0)) {
            const limit = buildRateLimit(found.text, messageAt, Date.now());
            if (limit) setRateLimit(store, session, limit);
          }
          syncMeta(store, session);
        }
        if ("compacted" in usage) {
          session.context = null;
          broadcastContext(id, null);
          store.attention.setContext(id, null, Date.now());
          refreshAttention(store);
          return;
        }
        session.context = usage;
        broadcastContext(id, usage);
        // a guessed limit would raise a false "context nearly full": skip those
        store.attention.setContext(
          id,
          usage.limit > 0 && !usage.limitGuessed ? usage.used / usage.limit : null,
          Date.now(),
        );
        refreshAttention(store);
      })
      .catch(() => {})
      .finally(() => {
        store.ctxInflight--;
      });
  }, CTX_DEBOUNCE_MS);
  timer.unref?.();
  store.ctxTimers.set(id, timer);
};

const handleContext = (evt: HookEvent, transcriptPath: unknown) => {
  const id = evt.session_id;
  const name = evt.hook_event_name;
  if (!id || !name || !store.sessions.has(id)) return;
  if (name === "PreCompact" || (name === "SessionStart" && evt.source === "compact")) {
    const timer = store.ctxTimers.get(id);
    if (timer) clearTimeout(timer);
    store.ctxTimers.delete(id);
    bumpSeq(id);
    const session = store.sessions.get(id)!;
    session.context = null;
    broadcastContext(id, null);
    store.attention.setContext(id, null, Date.now());
    refreshAttention(store);
    if (name === "PreCompact") return;
  }
  if (CTX_READ_EVENTS.has(name) && typeof transcriptPath === "string" && transcriptPath)
    scheduleContext(id, transcriptPath);
};

const updateSessions = (evt: HookEvent) => {
  const id = evt.session_id;
  if (!id) return;
  if (evt.hook_event_name === "SessionEnd") {
    dropSession(id);
    store.ended.set(id, evt.receivedAt);
    return;
  }
  if (evt.hook_event_name === "SessionStart") store.ended.delete(id);
  else if (store.ended.has(id)) return; // late event after SessionEnd: don't resurrect
  let session = store.sessions.get(id);
  if (!session) {
    session = {
      session_id: id,
      cwd: evt.cwd ?? "",
      firstSeen: evt.receivedAt,
      lastSeen: evt.receivedAt,
      lastEvent: null,
      interns: new Set(),
      context: null,
      waiting: false,
      waitingSince: null,
      source: "claude",
      model: null,
      rateLimit: null,
    };
    store.sessions.set(id, session);
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
  session.lastSeen = evt.receivedAt;
  session.lastEvent = evt.hook_event_name ?? null;
  if (!evt.agent_id) {
    const hookName = evt.hook_event_name;
    if (
      hookName === "PermissionRequest" ||
      (hookName === "Notification" && evt.notification_type === "permission_prompt")
    ) {
      if (!session.waiting) session.waitingSince = evt.receivedAt;
      session.waiting = true;
    } else if (
      hookName === "PreToolUse" ||
      hookName === "PostToolUse" ||
      hookName === "PostToolUseFailure" ||
      hookName === "UserPromptSubmit" ||
      hookName === "Stop" ||
      hookName === "StopFailure" ||
      hookName === "SessionStart"
    ) {
      session.waiting = false;
      session.waitingSince = null;
    }
  }
  if (evt.cwd) session.cwd = evt.cwd;
  // SubagentStart/Stop carry agent_id of the subagent itself.
  if (evt.hook_event_name === "SubagentStart" && evt.agent_id) session.interns.add(evt.agent_id);
  if (evt.hook_event_name === "SubagentStop" && evt.agent_id) session.interns.delete(evt.agent_id);
};

const LIMIT_CLEARING_EVENTS = new Set(["UserPromptSubmit", "PreToolUse", "SessionStart", "Stop"]);

/** source / model / usage-limit bookkeeping of one event (`raw` is the redacted payload incl. last_assistant_message) */
const updateMeta = (evt: HookEvent, raw: Record<string, unknown>) => {
  const session = evt.session_id ? store.sessions.get(evt.session_id) : undefined;
  if (!session) return;
  if (isAgentSource(evt.agent_source)) session.source = evt.agent_source;
  const model = sanitizeModel(evt.model);
  if (model) session.model = model;
  const name = evt.hook_event_name ?? "";
  if (name === "StopFailure" && !evt.agent_id && evt.error === "rate_limit")
    setRateLimit(store, session, buildRateLimit(raw.last_assistant_message, evt.receivedAt));
  else if (LIMIT_CLEARING_EVENTS.has(name)) {
    store.limitClearedAt.set(session.session_id, evt.receivedAt);
    if (session.rateLimit) setRateLimit(store, session, null);
  } else if (isLimitExpired(session.rateLimit, evt.receivedAt)) setRateLimit(store, session, null);
};

const logEvent = (evt: HookEvent) => {
  const time = new Date(evt.receivedAt).toTimeString().slice(0, LOG_TIME_CHARS);
  const sid = String(evt.session_id ?? "-").slice(0, LOG_ID_CHARS);
  const who = evt.agent_id ? ` (intern ${evt.agent_type ?? evt.agent_id.slice(0, LOG_AGENT_ID_CHARS)})` : "";
  const tool = evt.tool_name ? ` ${evt.tool_name}` : "";
  console.log(`${time} ${sid} ${evt.hook_event_name ?? "?"}${tool}${who}`);
};

const MAX_STRING = 300;
const MAX_KEYS = 20;

// The office only needs small hints (file name, command, pattern...). Drop tool_response and shrink
// big strings so stored events / SSE snapshots stay small and file contents aren't kept in memory.
const slim = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  if (value === null || typeof value !== "object") return value;
  if (depth >= 2) return Array.isArray(value) ? `[${value.length} items]` : "{…}";
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((item) => slim(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) out[key] = slim(item, depth + 1);
  return out;
};

const DROP_KEYS = new Set(["tool_response", "last_assistant_message", "prompt", "custom_instructions"]);

const META_KEYS = ["session_id", "hook_event_name", "cwd", "agent_id", "agent_type", "tool_name", "tool_use_id"];

/**
 * Secret-redacted copy of a hook payload: every string is scrubbed (see lib/redact.ts) and tool_response (big, never
 * read) is dropped. EVERYTHING downstream (slim, trackers that keep text, SSE, logs) works from this copy only.
 */
const sanitize = (raw: Record<string, unknown>): Record<string, unknown> => {
  try {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) if (key !== "tool_response") out[key] = redactDeep(value);
    return out;
  } catch {
    const out: Record<string, unknown> = {};
    for (const key of META_KEYS) if (typeof raw[key] === "string") out[key] = raw[key];
    return out; // fail closed: keep identifiers only
  }
};

export const addEvent = (rawIn: Record<string, unknown>) => {
  const raw = sanitize(rawIn);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (DROP_KEYS.has(key)) continue;
    clean[key] = key === "tool_input" ? slim(value) : slim(value, 1);
  }
  const evt = { ...clean, receivedAt: Date.now() } as HookEvent;
  store.events.push(evt);
  if (store.events.length > MAX_EVENTS) store.events.splice(0, store.events.length - MAX_EVENTS);
  // Late events after SessionEnd must not re-claim files (checked before updateSessions touches `ended`).
  const lateAfterEnd = !!evt.session_id && store.ended.has(evt.session_id) && evt.hook_event_name !== "SessionStart";
  let questsChanged = false;
  if (!lateAfterEnd) {
    try {
      if (store.territory.onEvent(evt, evt.receivedAt)) broadcastTerritory(store);
    } catch {}
  }
  if (!lateAfterEnd) {
    try {
      store.attention.ingest(raw, evt.receivedAt); // redacted copy; keeps last_assistant_message (dropped from `evt`)
    } catch {}
    try {
      store.receipts.ingest(raw, evt.receivedAt);
    } catch {}
    try {
      store.chronicle.ingest(raw, evt.receivedAt);
    } catch {}
    try {
      // its own try: a chronicle bug must not freeze the quest board
      if (store.quests.ingest(raw, evt.receivedAt)) questsChanged = true;
    } catch {}
  }
  updateSessions(evt);
  try {
    updateMeta(evt, raw);
  } catch {}
  try {
    const sid = evt.session_id;
    const sess = sid ? store.sessions.get(sid) : undefined;
    if (sid && sess) store.attention.setWaiting(sid, sess.waiting ? sess.waitingSince : null);
    refreshAttention(store);
    refreshReceipts(store);
    refreshChronicle(store);
    if (questsChanged) refreshQuests(store); // only TodoWrite / TaskCreate / TaskUpdate change it: skip the stringify
  } catch {}
  logEvent(evt);
  broadcastRaw(store, `data: ${JSON.stringify(evt)}\n\n`);
  // after the event frame: the client must know a brand-new session before it can take its meta
  try {
    const metaSession = evt.session_id ? store.sessions.get(evt.session_id) : undefined;
    if (metaSession) syncMeta(store, metaSession);
  } catch {}
  try {
    handleContext(evt, rawIn.transcript_path);
  } catch {}
};

export const snapshot = () => {
  expireLimits(store, Date.now());
  return {
    sessions: [...store.sessions.values()].map((session) => ({ ...session, interns: [...session.interns] })),
    events: store.events.slice(-SNAPSHOT_EVENTS),
    territory: store.territory.snapshot(),
    attention: attentionQueue(store),
    receipts: receiptRows(store),
    chronicle: store.chronicle.view(Date.now()),
    quests: questRows(store),
  };
};

export const subscribe = (send: Client) => {
  store.clients.add(send);
  return () => store.clients.delete(send);
};

// No CORS: the UI is same-origin and hooks use curl. Reject browser requests from other origins
// (Origin header set by browsers; curl sends none) so random websites can't read or inject events.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostnameOf = (host: string | null): string => (host ?? "").replace(/:\d+$/, "").toLowerCase();

export const isForeignOrigin = (req: Request): boolean => {
  // Host allowlist blocks DNS-rebinding (evil.example resolving to 127.0.0.1).
  if (!LOCAL_HOSTNAMES.has(hostnameOf(req.headers.get("host")))) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
};
