import { BOSS_KINDS, lookFor, MONSTER_KINDS, type BossKind, type Look, type MonsterKind } from "./palette";
import {
  DESK_COUNT, DUEL_HALF, H, HALL_W, W, CH_H, CH_W, DOOR, HEARTH, duelMidOfDesks, monsterSpot, routeIn, routeLeave, routePromote, routeToTavern, seatPoint, type Pt,
} from "./layout";
import { drawScene } from "./render";

export interface HookEvt {
  session_id?: string;
  hook_event_name?: string;
  cwd?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_input?: unknown;
  message?: string;
  notification_type?: string;
  reason?: string;
  trigger?: string;
  receivedAt?: number;
  [k: string]: unknown;
}

export interface CtxMsg { used: number | null; limit: number | null; limitGuessed?: boolean }
export interface Ctx { used: number; limit: number; guessed: boolean }
export interface GuildFilter { query: string; hideStray: boolean }

export interface TerritoryConflict { file: string; sids: string[]; level: "overlap" | "clash"; since: number; failer?: string }
const DISMISS_TTL_MS = 10 * 60 * 1000;
export interface TerritoryMsg { claims: { sid: string; files: string[] }[]; conflicts: TerritoryConflict[] }
/** a live (non-dismissed) conflict between >= 2 sessions the client knows */
export interface ConflictRow { key: string; file: string; sids: string[]; names: string[]; level: "overlap" | "clash"; since: number }
export const conflictKey = (c: { file: string; level: string }): string => `${c.file}|${c.level}`;

export type AttentionKind = "permission" | "loop" | "asked" | "context" | "done";
/** a row of the server's Lookout Bell queue */
export interface AttentionMsgRow { key: string; sid: string; kind: AttentionKind; since: number; text: string; detail?: string; copy?: string }
/** a queue row joined with the adventurer it is about (only sessions the guild knows) */
export interface AttentionRow extends AttentionMsgRow { tag: string; project: string }
/** rows that make the bell ring (the tab title leaves permission out: the ❗ already counts it) */
export function bellCount(rows: readonly { kind: AttentionKind }[], withPermission = true): number {
  let n = 0;
  for (const r of rows) if (r.kind === "loop" || r.kind === "asked" || (withPermission && r.kind === "permission")) n++;
  return n;
}
const ATTN_KINDS: readonly string[] = ["permission", "loop", "asked", "context", "done"];
/** ids of the next queue row after the selected one (wraps); first row when nothing in the queue is selected */
export function nextAttentionId(rows: readonly { sid: string }[], selectedId: string | null): string | null {
  const ids: string[] = [];
  for (const r of rows) if (!ids.includes(r.sid)) ids.push(r.sid);
  if (!ids.length) return null;
  const i = selectedId ? ids.indexOf(selectedId) : -1;
  return ids[(i + 1) % ids.length];
}

export interface SnapshotMsg {
  attention?: AttentionMsgRow[];
  territory?: TerritoryMsg;
  sessions?: { session_id: string; cwd?: string; interns?: string[]; context?: CtxMsg | null; waiting?: boolean }[];
  events?: HookEvt[];
}

export type Act = "thinking" | "reading" | "typing" | "bash" | "phone" | "mcp" | "sticky" | "handup";
export type EState = "ENTERING" | "SEATED" | "STRETCH" | "TO_COFFEE" | "DRINK" | "FROM_COFFEE" | "LEAVING" | "DUEL";

// ---- territory duels ----
export type DuelStyle = "sword" | "magic" | "arrow";
/** which fight this is, from the two styles: sword/sword, magic/magic (orb), arrow/arrow, or one side attacking a defender */
export type DuelKind = "sword" | "orb" | "arrows" | "magic_sword" | "arrow_sword" | "arrow_magic";
export interface Duel {
  /** left / right fighter ids (left = smaller x) */
  l: string; r: string;
  kind: DuelKind;
  styleL: DuelStyle; styleR: DuelStyle;
  /** attacking side for the mixed kinds (0 = left, 1 = right) */
  agg: 0 | 1;
  /** walk to a meeting point (true) or fight from their spots (false) */
  walk: boolean;
  /** reduced motion: only a static VS badge + emotes */
  still: boolean;
  phase: "go" | "fight" | "back";
  start: number;
  /** clock when the fight began */
  t0: number;
  /** 0 = left fighter holds the file and wins, 1 = right (re-decided at the flourish) */
  winner: 0 | 1;
  /** sid whose edit failed, from the server (loser), if known */
  failer: string | null;
  /** current impact point (beam end / orb / clang) for the renderer */
  ix: number; iy: number;
  /** last exchange whose one-shot effects were handled (-1 intro .. 4 final, 5 flourish) */
  beat: number;
  /** one-shot effect bits already fired in the current exchange (1 launch, 2 impact, 4 KO) */
  fxm: number;
  /** the winner was decided (at the start of the final blow) */
  decided: boolean;
  flourished: boolean;
}
// ---- duel choreography (shared by the engine fx and the renderer) ----
/** face-off before the first exchange (VS plate) */
export const DUEL_INTRO = 0.8;
/** one regular exchange: wind-up, dash / projectile, impact (+ hit-stop), recoil, settle */
export const DUEL_EX = 1.1;
export const DUEL_EXCHANGES = 4;
/** the final blow + KO */
export const DUEL_FINAL = 1.6;
/** start of the final exchange */
export const DUEL_FINAL_AT = DUEL_INTRO + DUEL_EXCHANGES * DUEL_EX;
/** start of the flourish (winner cheers + crown, loser is KO'd) */
export const DUEL_FLOURISH = DUEL_FINAL_AT + DUEL_FINAL;
export const DUEL_FLOURISH_LEN = 2;
/** whole fight (walking duels): intro + exchanges + final + flourish ~ 8.8s */
export const DUEL_FIGHT = DUEL_FLOURISH + DUEL_FLOURISH_LEN;
/** "still" duels (camp / reduced motion): VS badge + emotes only */
export const DUEL_STILL = 4.4;
/** the loser gets up again during the last bit of the flourish */
export const DUEL_RECOVER = 0.4;
export const DUEL_PIPS = 3;
/** which regular exchange is the sword-vs-sword blade lock */
export const DUEL_CLASH_EX = 2;
/** seconds of dash / projectile flight before the impact */
export const DUEL_DASH = 0.25;
/** impact time inside a regular / the final exchange, and the hit-stop that follows it */
export const DUEL_IMPACT = 0.5;
export const DUEL_IMPACT_FINAL = 0.7;
export const DUEL_STOP = 0.08;
export const DUEL_STOP_FINAL = 0.12;
/** px: melee dash distance, blade-lock reach (each), recoil / KO knock-back, KO sink */
export const DUEL_REACH = 32;
export const DUEL_CLASH_REACH = 17;
export const DUEL_KNOCK = 7;
export const DUEL_KNOCK_KO = 12;
export const DUEL_KO_DROP = 3;

export type DuelPose = "idle" | "attack" | "cast" | "hurt" | "cheer";
/** One fighter's scripted state at fight time u (+ the exchange info both fighters share). Offsets are screen px from the walk spot. */
export interface DuelScript {
  dx: number; dy: number; pose: DuelPose; frame: number;
  /** pips left (already counting a blow that has landed) */
  hp: number;
  /** -1 face-off, 0..3 regular exchange, 4 final blow, 5 flourish */
  ex: number;
  /** seconds into the exchange */
  q: number;
  /** attacking side of this exchange (-1 = blade lock / none) */
  atk: number;
  /** 0 none, 1 melee dash, 2 ranged projectile, 3 clash */
  act: 0 | 1 | 2 | 3;
  /** 0 none, 1 wind-up, 2 dash / flight, 3 hit-stop, 4 aftermath */
  stage: 0 | 1 | 2 | 3 | 4;
  /** projectile progress 0..1 while in flight, else -1 */
  fly: number;
  big: boolean;
  /** knocked out: stars circle the head */
  ko: boolean;
  /** this fighter has been struck in this exchange */
  hit: boolean;
  stop: boolean;
}
export const newDuelScript = (): DuelScript => ({
  dx: 0, dy: 0, pose: "idle", frame: 0, hp: DUEL_PIPS, ex: -1, q: 0, atk: -1, act: 0, stage: 0, fly: -1, big: false, ko: false, hit: false, stop: false,
});
const DS_SCRATCH = newDuelScript();
const FX0 = newDuelScript(), FX1 = newDuelScript();
const sstep = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** exchange index at fight time u: -1 face-off, 0..3 regular, 4 final, 5 flourish */
export function duelExchangeAt(u: number): number {
  if (u < DUEL_INTRO) return -1;
  if (u >= DUEL_FLOURISH) return 5;
  if (u >= DUEL_FINAL_AT) return DUEL_EXCHANGES;
  return Math.min(DUEL_EXCHANGES - 1, Math.floor((u - DUEL_INTRO) / DUEL_EX));
}
/** attacking side of exchange k (-1 = clash). Mixed kinds alternate who attacks, starting with `agg`; the last blow is the winner's. */
function exAtk(d: Duel, k: number): number {
  if (k >= DUEL_EXCHANGES) return d.winner;
  if (k === DUEL_CLASH_EX && d.kind === "sword") return -1;
  return (k & 1) === 0 ? d.agg : 1 - d.agg;
}
function duelHp(d: Duel, side: number, k: number, landed: boolean): number {
  let taken = 0;
  const n = Math.min(k, DUEL_EXCHANGES);
  for (let j = 0; j < n; j++) { const a = exAtk(d, j); if (a >= 0 && a !== side) taken++; }
  if (k < DUEL_EXCHANGES && landed) { const a = exAtk(d, k); if (a >= 0 && a !== side) taken++; }
  if (k >= DUEL_EXCHANGES && (k > DUEL_EXCHANGES || landed) && side !== d.winner) return 0;
  return Math.max(0, DUEL_PIPS - taken);
}

/**
 * The fight script: a pure, allocation-free function of (duel, side, fight time u). Writes into `o` (module scratch by default)
 * and returns it. Regular exchange (1.1s): wind-up pull-back -> dash / projectile -> impact + hit-stop -> recoil (defender knocked back
 * and shaking) -> both ease home. The sword-vs-sword exchange #2 is a blade lock. The final blow is the winner's; the loser is KO'd.
 * Only the final exchange and later read d.winner, so it can be decided at the start of the final blow.
 */
export function duelScript(d: Duel, side: 0 | 1, u: number, o: DuelScript = DS_SCRATCH): DuelScript {
  const dir = side === 0 ? 1 : -1, style = side === 0 ? d.styleL : d.styleR;
  o.dx = 0; o.dy = 0; o.pose = style === "magic" ? "cast" : "attack"; o.frame = 0; o.hp = DUEL_PIPS;
  o.ex = -1; o.q = 0; o.atk = -1; o.act = 0; o.stage = 0; o.fly = -1; o.big = false; o.ko = false; o.hit = false; o.stop = false;
  if (u < DUEL_INTRO) {
    if (u < DUEL_INTRO - 0.25) { o.pose = "idle"; o.frame = Math.floor(u * 4) & 1; }
    return o;
  }
  if (u >= DUEL_FLOURISH) {
    o.ex = 5; o.q = u - DUEL_FLOURISH; o.hp = duelHp(d, side, 5, true);
    if (side === d.winner) { o.pose = "cheer"; o.frame = Math.floor(u * 5) & 1; return o; }
    const rec = sstep((u - (DUEL_FIGHT - DUEL_RECOVER)) / DUEL_RECOVER);
    o.dx = Math.round(-dir * DUEL_KNOCK_KO * (1 - rec)); o.dy = Math.round(DUEL_KO_DROP * (1 - rec));
    o.ko = rec < 0.5; o.pose = rec < 0.5 ? "hurt" : "idle"; o.frame = 1;
    return o;
  }
  const k = duelExchangeAt(u), fin = k === DUEL_EXCHANGES;
  const q = Math.max(0, fin ? u - DUEL_FINAL_AT : u - DUEL_INTRO - k * DUEL_EX);
  const imp = fin ? DUEL_IMPACT_FINAL : DUEL_IMPACT, stopLen = fin ? DUEL_STOP_FINAL : DUEL_STOP;
  const wind = imp - DUEL_DASH, rec = fin ? 0.3 : 0.22, ret = fin ? 0.4 : 0.3;
  const stopped = q >= imp && q < imp + stopLen;
  const q2 = q < imp ? q : stopped ? imp : q - stopLen; // game time: frozen during the hit-stop
  const atk = exAtk(d, k);
  o.ex = k; o.q = q; o.atk = atk; o.big = fin; o.stop = stopped;
  o.stage = q < wind ? 1 : q < imp ? 2 : stopped ? 3 : 4;
  o.hp = duelHp(d, side, k, q >= imp);
  let fw = 0; // px toward the opponent
  if (atk < 0) { // blade lock
    o.act = 3; o.pose = "attack";
    const reach = DUEL_CLASH_REACH, lockEnd = imp + 0.25, shoveEnd = lockEnd + 0.15;
    if (q2 < wind) { fw = -3 * sstep(q2 / wind); }
    else if (q2 < imp) { fw = -3 + (reach + 3) * sstep((q2 - wind) / DUEL_DASH); o.frame = 1; }
    else if (q2 < lockEnd) { fw = reach + (stopped ? 0 : ((Math.floor(q * 50) + side) & 1) * 2 - 1); o.frame = 1; }
    else if (q2 < shoveEnd) { fw = reach - (reach + 6) * sstep((q2 - lockEnd) / 0.15); o.pose = "hurt"; }
    else fw = -6 * (1 - sstep((q2 - shoveEnd) / 0.12));
  } else if (side === atk) {
    const melee = style === "sword", back = fin ? 5 : 3;
    o.act = melee ? 1 : 2;
    if (melee) {
      if (q2 < wind) fw = -back * sstep(q2 / wind);
      else if (q2 < imp) { fw = -back + (DUEL_REACH + back) * sstep((q2 - wind) / DUEL_DASH); o.frame = 1; }
      else if (q2 < imp + rec) { fw = DUEL_REACH - 2 * sstep((q2 - imp) / rec); o.frame = 1; }
      else fw = (DUEL_REACH - 2) * (1 - sstep((q2 - imp - rec) / ret));
    } else {
      fw = q2 < wind ? -back * sstep(q2 / wind) : -back * (1 - sstep((q2 - wind) / DUEL_DASH));
      if (q >= wind && q < imp) o.fly = (q - wind) / DUEL_DASH;
      o.frame = style === "magic" ? (q2 >= wind && q2 < imp + rec ? 1 : 0) : (q2 < wind ? 1 : 0);
    }
  } else { // defender
    o.act = (side === 0 ? d.styleR : d.styleL) === "sword" ? 1 : 2;
    const K = fin ? DUEL_KNOCK_KO : DUEL_KNOCK;
    if (q2 >= imp) {
      o.hit = true;
      const away = q2 < imp + rec ? K * sstep((q2 - imp) / rec) : fin ? K : K * (1 - sstep((q2 - imp - rec) / ret));
      fw = -away;
      if (!stopped && q2 < imp + rec) fw += (Math.floor(q * 60) & 1) * 2 - 1; // shake
      if (fin || q2 < imp + rec + 0.1) { o.pose = "hurt"; o.frame = fin && q2 >= imp + rec ? 1 : Math.floor(q2 * 10) & 1; }
      if (fin) { o.dy = Math.round(DUEL_KO_DROP * sstep((q2 - imp - 0.12) / 0.3)); o.ko = q2 >= imp + rec * 0.8; }
    }
  }
  o.dx = Math.round(fw * dir);
  return o;
}

const POINT_SCRATCH: Pt = { x: 0, y: 0 };
/** where this exchange's blow lands (the blade lock sits between the two; otherwise on the defender's front). Allocation-free. */
export function duelContact(L: { x: number; y: number }, R: { x: number; y: number }, s: DuelScript, out: Pt = POINT_SCRATCH): Pt {
  if (s.atk < 0) { out.x = (L.x + R.x) / 2; out.y = (L.y + R.y) / 2 - 14; return out; }
  const a = s.atk === 0 ? 1 : -1, D = s.atk === 0 ? R : L;
  out.x = D.x - a * (s.act === 1 ? 8 : 4); out.y = D.y - 13;
  return out;
}
const DUEL_COOLDOWN = 60;
/** a clash that could not duel yet (participant still walking in, etc.) keeps trying this long (sim seconds) */
const DUEL_WAIT = 30;
const GLARE_COOLDOWN = 60;
/** two adventurers closer than this share a spot: no duel */
const DUEL_MIN_DIST = 12;
const pairKey = (a: string, b: string): string => (a < b ? a + "|" + b : b + "|" + a);
const DUEL_MAX = 2;
const DUEL_WALK_MAX = 130;
const DUEL_RANGE_MAX = 200;
const SPARK_COLS = ["#ffffff", "#ffe14a", "#ffffff", "#ffb347"];
const MAGIC_COLS = ["#ffffff", "#b07bff", "#8fd3ff", "#ffffff"];
const HOLY_COLS = ["#ffffff", "#ffe27a", "#fff6c0", "#ffd24a"];
const ARROW_COLS = ["#ffffff", "#c69c6d", "#d8dde8", "#ffe14a"];
const CLASH_COLS = ["#ff4a4a", "#ffd94a", "#ffffff"];
const GOLD_COLS = ["#ffe14a", "#ffffff", "#f2c14e"];
const DUST_COLS = ["#d8c9a0", "#b59a6a", "#ffffff"];

const styleOf = (cls: string): DuelStyle => (cls === "mage" || cls === "cleric" ? "magic" : cls === "ranger" ? "arrow" : "sword");

export interface Intern {
  id: string; label: string; born: number; act: "idle" | "typing" | "reading" | "handup";
  tool?: string; detail?: string; since: number; count: number; failed?: boolean;
}
export interface InternRow {
  id: string; label: string; act: Intern["act"]; tool: string; detail: string; count: number; needsYou: boolean; failed: boolean;
}
const newIntern = (id: string, label: string, clock: number, born = clock): Intern =>
  ({ id, label: label || "squire", born, act: "idle", since: clock, count: 0 });

export interface Employee {
  id: string;
  tag: string;
  project: string;
  cwd: string;
  look: Look;
  order: number;
  deskIdx: number;
  slot: number;
  x: number;
  y: number;
  path: Pt[];
  trail: Pt[];
  state: EState;
  act: Act;
  actSince: number;
  stateSince: number;
  bubble: string | null;
  tempBubble: { e: string; until: number } | null;
  note: "idle" | "agent" | null;
  interns: Map<string, Intern>;
  lastEventAt: number;
  queue: HookEvt[];
  facing: 1 | -1;
  hasPaper: boolean;
  paperAt: number;
  sparkUntil: number;
  sticky: boolean;
  nextThought: number;
  returning: boolean;
  /** pause (clock seconds) at a waypoint with `wait` (quest board / counter). */
  holdUntil: number;
  /** timestamps used by the renderer */
  noteAt: number;
  lootAt: number;
  hurtUntil: number;
  /** monster at the battle spot */
  monKind: MonsterKind;
  monPos: Pt | null;
  monAppearAt: number;
  monDead: boolean;
  monDeadAt: number;
  monRespawnAt: number;
  monLoot: boolean;
  monN: number;
  monHp: number;
  monHpMax: number;
  /** boss currently standing in for the monster (a tool that ran > 30s) */
  boss: BossKind | null;
  bossAt: number;
  /** progression */
  lv: number;
  xp: number;
  gold: number;
  kills: number;
  hearts: number;
  /** in-flight tools (key = tool_use_id, else a synthetic key) -> clock time of their PreToolUse; capped */
  pending: Map<string, number>;
  toolCalls: number;
  qKills: number;
  qGold: number;
  resting: boolean;
  /** juice timestamps (clock seconds) */
  windupUntil: number;
  hsUntil: number;
  hsAt: number;
  lungeUntil: number;
  flashUntil: number;
  monLungeUntil: number;
  monKnockUntil: number;
  redUntil: number;
  slashUntil: number;
  lvlAt: number;
  lvlTo: number;
  dustAcc: number;
  /** active territory duel this adventurer is part of */
  duel: Duel | null;
  /** a Stop arrived mid-duel: go to the tavern once back at the spot */
  coffeeAfter: boolean;
  /** a live/snapshot SessionStart was seen for this session */
  sawStart: boolean;
  /** events observed for this session (snapshot events included) */
  evCount: number;
  /** the server listed this session in a snapshot `sessions` array (a real, tracked session) */
  known: boolean;
}

export interface Particle {
  on: boolean; x: number; y: number; vx: number; vy: number; g: number; age: number; life: number;
  col: string; size: number; spr: string | null;
  /** drawn BEFORE the entity pass (duel effects: they may fade, so they must never sit over a character) */
  under: boolean;
}
export interface Popup { x: number; y: number; text: string; col: string; big: boolean; born: number; dur: number; star: boolean }
export interface Banner { kind: "quest" | "boss"; text: string; start: number; dur: number }
export interface Butterfly { x: number; y: number; tx: number; ty: number; col: string; ph: number }
export interface Bird { x: number; y: number; vx: number; ph: number }
export interface Firefly { x: number; y: number; sx: number; sy: number; ph: number }
export interface Smoke { x: number; y: number; age: number; life: number }

export const MAX_HEARTS = 3;
export const xpNeed = (lv: number): number => Math.max(1, Math.round(10 * Math.pow(1.5, Math.max(1, lv) - 1)));
const MON_HP: Record<MonsterKind, number> = { slime: 3, bat: 3, mushroom: 4, goblin: 5, skeleton: 6 };
const HEAVY_TOOLS = new Set(["Bash", "Edit", "Write", "MultiEdit", "NotebookEdit"]);
const BOSS_AFTER = 30;
const REST_AFTER = 60;
const PROGRESS_KEY = "guild.progress.v1";
const PROGRESS_TTL = 7 * 24 * 3600 * 1000;
interface Saved { xp: number; lv: number; gold: number; kills: number; seen: number }
const BF_COLORS = ["#ff9ad5", "#ffd94a", "#8ad0ff", "#c8a0ff", "#ff9a6a"];
const MAX_PARTICLES = 150;
const MAX_POPUPS = 20;

export interface LogRow {
  id: number; color: string; text: string; bad?: boolean;
  time: number; tag: string; project: string; kind: string; detail: string; intern: boolean; internLabel: string;
  /** full session id (lets the UI hide rows of filtered sessions) */
  sid?: string;
}
/** an adventurer waiting on the user, regardless of the session filter */
export interface WaitingRow { id: string; tag: string; project: string; status: string; hidden: boolean }
export type RosterAct = Act | "enter" | "leave" | "stretch" | "coffee" | "intern_handup";
export interface RosterRow {
  id: string; tag: string; project: string; color: string; status: string; interns: number; internList: InternRow[]; desk: number;
  look: Look; act: RosterAct;
  level?: number; xp?: number; xpNext?: number; gold?: number; kills?: number; hp?: number; hpMax?: number;
  ctxUsed?: number; ctxLimit?: number; ctxGuessed?: boolean;
  /** files this session currently holds (territory claims) */
  claims?: number;
  /** strongest live, non-dismissed conflict this session is part of */
  conflict?: "overlap" | "clash";
}
export interface OfficeView {
  roster: RosterRow[];
  log: LogRow[];
  hoverId: string | null;
  selectedId: string | null;
  treasury?: number;
  /** employees hidden by the session filter */
  hiddenCount?: number;
  /** ids hidden by the session filter */
  hiddenIds?: string[];
  /** everyone waiting on the user, unfiltered */
  waiting?: WaitingRow[];
  /** live territory conflicts (non-dismissed), unfiltered like `waiting` */
  conflicts?: ConflictRow[];
  /** Lookout Bell queue (non-dismissed rows of adventurers the guild knows, already ordered) */
  attention?: AttentionRow[];
}
export const EMPTY_VIEW: OfficeView = { roster: [], log: [], hoverId: null, selectedId: null, hiddenCount: 0, hiddenIds: [], waiting: [], conflicts: [], attention: [] };

declare global {
  interface Window { officeEvent?: (evt: HookEvt) => void }
}

const SPEED = 40;
const h32 = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const base = (p: string) => { const q = p.replace(/\/+$/, ""); const i = q.lastIndexOf("/"); return i >= 0 ? q.slice(i + 1) : q; };
const trunc = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

export function toolDetail(evt: HookEvt): string {
  const ti = obj(evt.tool_input);
  const file = str(ti.file_path) || str(ti.path) || str(ti.notebook_path);
  if (file) return base(file);
  if (str(ti.command)) return trunc(str(ti.command), 24);
  if (str(ti.pattern)) return trunc(str(ti.pattern), 24);
  if (str(ti.url)) return trunc(str(ti.url).replace(/^https?:\/\//, ""), 24);
  if (str(ti.query)) return trunc(str(ti.query), 24);
  if (str(ti.description)) return trunc(str(ti.description), 24);
  if (str(ti.prompt)) return trunc(str(ti.prompt), 24);
  return "";
}

const READ_TOOLS = new Set(["Read", "Grep", "Glob", "LS"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const STICKY_TOOLS = new Set(["TodoWrite", "TaskCreate", "TaskUpdate"]);
const AGENT_TOOLS = new Set(["Agent", "Task", "Workflow"]);
const USER_WAIT_TOOLS = new Set(["AskUserQuestion", "ExitPlanMode", "EnterPlanMode"]);
const MAX_PENDING = 16;
const HANDUP_NOTIFS = new Set(["permission_prompt", "agent_needs_input", "elicitation_dialog"]);

function projectOf(cwd: string | undefined): string {
  const b = base(cwd ?? "");
  return b || "unknown";
}

function internRow(it: Intern): InternRow {
  return {
    id: it.id, label: it.label, act: it.act, tool: it.tool ?? "", detail: it.detail ?? "", count: it.count,
    needsYou: it.act === "handup", failed: !!it.failed,
  };
}

export class Office {
  readonly ctx: CanvasRenderingContext2D;
  readonly employees = new Map<string, Employee>();
  clock = 0;
  speed = 1;
  paused = false;
  hoverId: string | null = null;
  selectedId: string | null = null;
  selectedUntil = 0;
  realTime = 0;
  private log: LogRow[] = [];
  private logSeq = 0;
  private seq = 0;
  private raf = 0;
  private running = false;
  private last = 0;
  private lastEmit = 0;
  private dirty = true;
  private lastSig = "";
  private lastErrorLog = 0;
  private ended = new Map<string, number>();
  private endedAgents = new Map<string, number>();
  private listeners = new Set<(v: OfficeView) => void>();
  private sim: { update(): void; addSession(): void } | null = null;
  /** context-window usage per session id; survives leave/re-enter, dropped on reset (null) */
  private ctxMap = new Map<string, Ctx>();
  /** territory (server state, full replacement). Dismissals are per conflictKey; never persisted. */
  private claimN = new Map<string, number>();
  private conflicts: TerritoryConflict[] = [];
  /** Lookout Bell queue (server state, full replacement) and per-row-key dismissals; never persisted */
  private attn: AttentionMsgRow[] = [];
  private attnDismissed = new Set<string>();
  private attnVer = 0;
  /** sessions with a live, non-dismissed loop row (drawn as "berserk") */
  readonly loopIds = new Set<string>();
  private attnRowsCache: AttentionRow[] | null = null;
  /** key -> Infinity while the conflict is live, else the time its dismissal expires (kept briefly so clash->overlap flaps stay dismissed) */
  private dismissed = new Map<string, number>();
  /** clash conflictKeys already fought out by a finished duel: their contested strip / flag / link are no longer drawn */
  private settled = new Set<string>();
  private pendingClash = new Map<string, TerritoryConflict>();
  private rowsCache: ConflictRow[] | null = null;
  private seenClash = new Set<string>();
  private seenOverlap = new Set<string>();
  /** live duels (<= DUEL_MAX), read by the renderer */
  readonly duels: Duel[] = [];
  private duelAt = new Map<string, number>();
  /** live clashes waiting for both fighters to be free (key -> conflict + deadline) */
  private duelWait = new Map<string, { c: TerritoryConflict; until: number }>();
  /** flag-tug animations after a new overlap */
  private tugs: { a: string; b: string; until: number }[] = [];
  /** clock time of the last failed edit tool per session (the failing side loses a duel) */
  private editFailAt = new Map<string, number>();
  private glareAt = new Map<string, number>();
  private pruneAt = 0;
  private tmpPt: Pt = { x: 0, y: 0 };
  private terrFxAt = 0;
  private terrVer = 0;
  private bumpTerr() { this.terrVer++; this.rowsCache = null; this.attnRowsCache = null; }
  private filter: GuildFilter = { query: "", hideStray: false };
  /** isHidden cache; invalidated by bumping hidVer (filter/events/snapshot) or when the act changes */
  private hidVer = 0;
  private hidCache = new Map<string, { v: number; act: string; h: boolean; proj: string }>();

  // ---- effects (render reads these) ----
  readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, age: 0, life: 1, col: "#fff", size: 1, spr: null, under: false,
  }));
  private pIdx = 0;
  popups: Popup[] = [];
  banners: Banner[] = [];
  trauma = 0;
  /** full-screen flash request (render draws one frame and clears it) */
  flash = 0;
  // ---- ambient (real-time, frozen while paused) ----
  ambT = 0;
  butterflies: Butterfly[] = [];
  bird: Bird | null = null;
  private nextBird = 12;
  fireflies: Firefly[] = [];
  smoke: Smoke[] = [];
  private nextSmoke = 0;
  rain = 0;
  private rainStart = -1;
  private rainEnd = 0;
  private nextRain = 0;
  // ---- progression ----
  treasury = 0;
  private progress: Record<string, Saved> = {};
  private demo = false;
  private progDirty = false;
  private lastSave = 0;
  private onHide = () => this.saveProgress(true);
  /** prefers-reduced-motion: no screen shake / full-screen flash */
  reducedMotion = false;
  private mq: MediaQueryList | null = null;
  private onMq = () => { this.reducedMotion = !!this.mq?.matches; };
  /** another tab wrote progress: merge (higher xp/lv per session, max treasury) instead of overwriting it */
  private onStorage = (ev: StorageEvent) => {
    if (ev.key !== PROGRESS_KEY || this.demo || !ev.newValue) return;
    try {
      const j = JSON.parse(ev.newValue) as { sessions?: Record<string, Saved>; treasury?: number };
      const now = Date.now();
      for (const [id, v] of Object.entries(j.sessions ?? {})) {
        if (!v || typeof v !== "object" || !(now - Number(v.seen) < PROGRESS_TTL)) continue;
        const o = { xp: Math.max(0, Number(v.xp) || 0), lv: Math.max(1, Number(v.lv) || 1),
          gold: Math.max(0, Number(v.gold) || 0), kills: Math.max(0, Number(v.kills) || 0), seen: Number(v.seen) };
        const mine = this.progress[id];
        if (!mine || o.lv > mine.lv || (o.lv === mine.lv && o.xp > mine.xp) || (o.lv === mine.lv && o.xp === mine.xp && o.seen > mine.seen)) {
          this.progress[id] = o;
        }
      }
      this.treasury = Math.max(this.treasury, Math.max(0, Number(j.treasury) || 0));
    } catch { /* corrupt */ }
  };

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.loadProgress();
    this.initAmbient();
  }

  private initAmbient() {
    const n = 3 + Math.floor(Math.random() * 3);
    this.butterflies = Array.from({ length: n }, (_, i) => {
      const x = rand(HALL_W + 20, W - 20), y = rand(70, 200);
      return { x, y, tx: x, ty: y, col: BF_COLORS[i % BF_COLORS.length], ph: rand(0, 6) };
    });
    this.fireflies = Array.from({ length: 12 }, () => {
      const x = rand(HALL_W + 12, W - 12), y = rand(72, 204);
      return { x, y, sx: x, sy: y, ph: rand(0, 6) };
    });
    this.scheduleRain(true);
  }

  private scheduleRain(first = false) {
    const a = this.demo ? (first ? 50 : 120) : (first ? 300 : 420);
    this.nextRain = this.ambT + rand(a, a * (this.demo ? 1.6 : 1.8));
    this.rainStart = -1;
  }
  startRain() { this.nextRain = this.ambT; }

  // ---------- persistence ----------
  private loadProgress() {
    this.progress = {};
    this.treasury = 0;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PROGRESS_KEY) : null;
      if (!raw) return;
      const j = JSON.parse(raw) as { sessions?: Record<string, Saved>; treasury?: number };
      const now = Date.now();
      for (const [id, v] of Object.entries(j.sessions ?? {})) {
        if (!v || typeof v !== "object" || !(now - Number(v.seen) < PROGRESS_TTL)) continue;
        this.progress[id] = {
          xp: Math.max(0, Number(v.xp) || 0), lv: Math.max(1, Number(v.lv) || 1),
          gold: Math.max(0, Number(v.gold) || 0), kills: Math.max(0, Number(v.kills) || 0), seen: Number(v.seen),
        };
      }
      this.treasury = Math.max(0, Number(j.treasury) || 0);
    } catch { /* storage unavailable or corrupt */ }
  }

  private saveProgress(force = false) {
    if (this.demo || !this.progDirty) return;
    if (!force && this.realTime - this.lastSave < 2) return;
    this.lastSave = this.realTime;
    this.progDirty = false;
    try {
      const now = Date.now();
      for (const k of Object.keys(this.progress)) if (now - this.progress[k].seen > PROGRESS_TTL) delete this.progress[k];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ sessions: this.progress, treasury: this.treasury }));
    } catch { /* quota / private mode */ }
  }

  private touch(e: Employee) {
    if (this.demo) return;
    this.progress[e.id] = { xp: e.xp, lv: e.lv, gold: e.gold, kills: e.kills, seen: Date.now() };
    this.progDirty = true;
  }

  private pxScale = 0;
  /** Resize backing store to s device px per logical px; drawing stays in logical coords. */
  setPixelScale(s: number) {
    const k = Math.max(1, Math.round(s));
    if (k === this.pxScale) return;
    this.pxScale = k;
    this.canvas.width = W * k;
    this.canvas.height = H * k;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---------- lifecycle ----------
  start() {
    if (this.running) return;
    this.running = true;
    window.officeEvent = (e) => this.event(e);
    this.last = performance.now();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.onHide);
      window.addEventListener("pagehide", this.onHide);
      window.removeEventListener("storage", this.onStorage);
      window.addEventListener("storage", this.onStorage);
      try {
        this.mq?.removeEventListener("change", this.onMq);
        this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.reducedMotion = this.mq.matches;
        this.mq.addEventListener("change", this.onMq);
      } catch { /* no matchMedia */ }
    }
    const loop = (now: number) => {
      if (!this.running) return;
      // Schedule first: one bad frame (e.g. odd live event data) must never freeze the office.
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      try {
        this.update(dt);
        this.ctx.save();
        try {
          drawScene(this.ctx, this);
        } finally {
          this.ctx.restore(); // drops any clip/alpha left behind by a throw mid-draw
        }
        if (now - this.lastEmit > 200) { this.lastEmit = now; this.emit(); }
      } catch (err) {
        if (now - this.lastErrorLog > 5000) { this.lastErrorLog = now; console.error("[office] frame error", err); }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (typeof window !== "undefined") { delete window.officeEvent; window.removeEventListener("pagehide", this.onHide); window.removeEventListener("storage", this.onStorage); }
    this.mq?.removeEventListener("change", this.onMq);
    this.saveProgress(true);
    this.listeners.clear();
  }

  subscribe(cb: (v: OfficeView) => void): () => void {
    this.listeners.add(cb);
    cb(this.getView());
    this.lastSig = this.signature();
    return () => this.listeners.delete(cb);
  }

  attachSim(s: { update(): void; addSession(): void } | null) {
    if (s && !this.demo) this.saveProgress(true);
    this.sim = s;
    this.demo = !!s;
    if (s) this.treasury = 0; // demo has its own throw-away treasury; nothing is persisted
    else this.loadProgress();
    this.scheduleRain(true);
  }
  addSession() { this.sim?.addSession(); }
  setSpeed(n: number) { this.speed = n; }
  setPaused(b: boolean) { this.paused = b; }
  /** Replace the Lookout Bell queue. Malformed rows are skipped; dismissals of rows that vanished are forgotten. */
  setAttention(rows: AttentionMsgRow[] | null | undefined) {
    const out: AttentionMsgRow[] = [];
    if (Array.isArray(rows)) {
      for (const r of rows.slice(0, 50)) {
        if (!r || typeof r !== "object" || typeof r.sid !== "string" || !r.sid || typeof r.key !== "string" || !r.key) continue;
        if (!ATTN_KINDS.includes(r.kind) || typeof r.text !== "string") continue;
        out.push({
          key: r.key.slice(0, 200), sid: r.sid, kind: r.kind, since: Number.isFinite(Number(r.since)) ? Number(r.since) : 0, text: r.text.slice(0, 200),
          ...(typeof r.detail === "string" ? { detail: r.detail.slice(0, 200) } : {}),
          ...(typeof r.copy === "string" ? { copy: r.copy.slice(0, 600) } : {}),
        });
      }
    }
    const keys = new Set(out.map((r) => r.key));
    for (const k of this.attnDismissed) if (!keys.has(k)) this.attnDismissed.delete(k);
    this.attn = out;
    this.bumpAttn();
  }
  dismissAttention(key: string) { if (this.attn.some((r) => r.key === key)) { this.attnDismissed.add(key); this.bumpAttn(); } }
  private bumpAttn() {
    this.attnVer++; this.attnRowsCache = null;
    this.loopIds.clear();
    for (const r of this.attn) if (r.kind === "loop" && !this.attnDismissed.has(r.key)) this.loopIds.add(r.sid);
    this.dirty = true;
  }
  /** rows to show: not dismissed, session known to the guild */
  attentionRows(): AttentionRow[] {
    if (this.attnRowsCache) return this.attnRowsCache;
    const out: AttentionRow[] = [];
    for (const r of this.attn) {
      const e = this.employees.get(r.sid);
      if (!e || this.attnDismissed.has(r.key)) continue;
      out.push({ ...r, tag: e.tag, project: e.project });
    }
    return (this.attnRowsCache = out);
  }
  /** the bell rings while someone needs the user right now */
  bellRinging(): boolean {
    return bellCount(this.attentionRows()) > 0;
  }
  setHover(id: string | null) { if (this.hoverId !== id) { this.hoverId = id; this.dirty = true; } }
  select(id: string | null) { this.selectedId = id; this.selectedUntil = this.realTime + 3; this.dirty = true; }

  clear() {
    this.employees.clear();
    this.log = [];
    this.hoverId = null;
    this.selectedId = null;
    this.ended.clear();
    this.endedAgents.clear();
    this.ctxMap.clear();
    this.attn = []; this.attnDismissed.clear(); this.bumpAttn();
    this.claimN.clear(); this.conflicts = []; this.dismissed.clear(); this.seenClash.clear(); this.seenOverlap.clear(); this.pendingClash.clear(); this.bumpTerr();
    this.duels.length = 0; this.duelAt.clear(); this.duelWait.clear(); this.glareAt.clear(); this.tugs.length = 0; this.editFailAt.clear();
    for (const p of this.particles) p.on = false;
    this.popups = []; this.banners = []; this.trauma = 0; this.flash = 0;
    this.dirty = true;
    this.emit(true);
  }

  setContext(sid: string, used: number | null | undefined, limit: number | null | undefined, guessed = false) {
    if (!sid) return;
    if (typeof used !== "number" || typeof limit !== "number" || !Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0 || used < 0) {
      if (this.ctxMap.delete(sid)) this.dirty = true;
      return;
    }
    this.ctxMap.delete(sid); // re-insert = most recent
    this.ctxMap.set(sid, { used, limit, guessed: !!guessed });
    if (this.ctxMap.size > 300) this.ctxMap.delete(this.ctxMap.keys().next().value as string);
    this.dirty = true;
  }
  /** used/limit clamped to 0..1, or null when unknown */
  ctxFrac(id: string): number | null {
    const c = this.ctxMap.get(id);
    return c ? Math.max(0, Math.min(1, c.used / c.limit)) : null;
  }
  ctxOf(id: string): Ctx | null { return this.ctxMap.get(id) ?? null; }

  /**
   * Replace territory state (claims + conflicts). New clashes (key not seen before) raise a banner/log/light shake
   * unless `quiet` (snapshot on (re)connect). Malformed input is ignored field by field.
   */
  setTerritory(msg: TerritoryMsg | null | undefined, quiet = false) {
    const claims = new Map<string, number>();
    const conflicts: TerritoryConflict[] = [];
    if (msg && typeof msg === "object") {
      for (const c of (Array.isArray(msg.claims) ? msg.claims : []).slice(0, 300)) {
        if (c && typeof c.sid === "string" && Array.isArray(c.files) && c.files.length > 0) claims.set(c.sid, c.files.length);
      }
      for (const c of (Array.isArray(msg.conflicts) ? msg.conflicts : []).slice(0, 100)) {
        if (!c || typeof c.file !== "string" || !Array.isArray(c.sids) || (c.level !== "overlap" && c.level !== "clash")) continue;
        const sids = c.sids.filter((x): x is string => typeof x === "string" && !!x).slice(0, 8);
        if (sids.length < 2) continue;
        const failer = typeof c.failer === "string" && sids.includes(c.failer) ? c.failer : undefined;
        conflicts.push(failer ? { file: c.file, sids, level: c.level, since: Number(c.since) || 0, failer } : { file: c.file, sids, level: c.level, since: Number(c.since) || 0 });
      }
    }
    this.claimN = claims;
    this.conflicts = conflicts;
    const keys = new Set(conflicts.map(conflictKey));
    for (const k of this.settled) if (!keys.has(k)) this.settled.delete(k);
    const now = Date.now();
    for (const [k, exp] of [...this.dismissed]) {
      if (keys.has(k)) this.dismissed.set(k, Infinity);
      else if (exp === Infinity) this.dismissed.set(k, now + DISMISS_TTL_MS);
      else if (exp < now) this.dismissed.delete(k);
    }
    const nextSeen = new Set<string>();
    const nextOverlap = new Set<string>();
    this.pendingClash.clear();
    const fresh: TerritoryConflict[] = [];
    const freshOv: TerritoryConflict[] = [];
    for (const c of conflicts) {
      if (c.level === "overlap") {
        const k = conflictKey(c);
        nextOverlap.add(k);
        if (!quiet && !this.seenOverlap.has(k) && this.clashEligible(c)) freshOv.push(c);
        continue;
      }
      const k = conflictKey(c);
      if (this.seenClash.has(k) || quiet) { nextSeen.add(k); continue; }
      if (!this.clashEligible(c)) { this.pendingClash.set(k, c); continue; } // not eligible yet: alert when sessions arrive
      nextSeen.add(k);
      fresh.push(c);
    }
    this.seenClash = nextSeen;
    this.seenOverlap = nextOverlap;
    for (const c of fresh.slice(0, 3)) { this.alertClash(c); this.startDuel(c); }
    for (const c of freshOv.slice(0, 3)) this.glare(c);
    this.bumpTerr();
    this.hidVer++;
    this.dirty = true;
  }

  // ---------- territory duels ----------
  /** can this adventurer start/join a duel right now */
  private duelReady(e: Employee | undefined): e is Employee {
    return !!e && e.state === "SEATED" && !e.duel && !this.isHidden(e) && !this.isWaiting(e) && e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
  }

  /**
   * Who holds the file and wins (0 = left, 1 = right). The server names the session whose edit failed (`failer`) and that one loses.
   * Without it: the one whose edit failed recently loses (client-seen failures); else more claims; else a stable hash.
   */
  private duelWinner(l: Employee, r: Employee, failer: string | null): 0 | 1 {
    if (failer === l.id) return 1;
    if (failer === r.id) return 0;
    const fl = this.editFailAt.get(l.id) ?? -Infinity, fr = this.editFailAt.get(r.id) ?? -Infinity;
    const recent = (f: number) => this.clock - f < 120;
    if (recent(fl) !== recent(fr)) return recent(fl) ? 1 : 0;
    if (recent(fl) && recent(fr) && fl !== fr) return fl > fr ? 1 : 0;
    const cl = this.claimsOf(l.id), cr = this.claimsOf(r.id);
    if (cl !== cr) return cl > cr ? 0 : 1;
    return h32(l.id) <= h32(r.id) ? 0 : 1;
  }

  /**
   * a NEW clash: the two adventurers duel for ~9s (walking to the flag when both sit at battle spots).
   * When a pair is blocked only by a transient condition (someone still walking in / at the tavern / mid-duel, or both duel slots busy)
   * the clash waits in `duelWait` and is retried every frame for DUEL_WAIT seconds while it stays live.
   */
  private startDuel(c: TerritoryConflict) {
    const r = this.tryDuel(c);
    const k = conflictKey(c);
    if (r === "wait") { if (!this.duelWait.has(k)) this.duelWait.set(k, { c, until: this.clock + DUEL_WAIT }); }
    else this.duelWait.delete(k);
  }
  /** "started" | "wait" (retry later) | "none" (nothing to do for this clash) */
  private tryDuel(c: TerritoryConflict): "started" | "wait" | "none" {
    const ids = [...new Set(c.sids)];
    let wait = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.employees.get(ids[i]), b = this.employees.get(ids[j]);
        if (!a || !b || a === b || a.state === "LEAVING" || b.state === "LEAVING") continue;
        const key = pairKey(a.id, b.id);
        const last = this.duelAt.get(key);
        if (last !== undefined && this.clock - last < DUEL_COOLDOWN) continue; // per pair, not per person
        if (!this.duelReady(a) || !this.duelReady(b)) { if (!this.isHidden(a) && !this.isHidden(b) && !this.isWaiting(a) && !this.isWaiting(b)) wait = true; continue; }
        if (this.duels.length >= DUEL_MAX) { wait = true; continue; }
        if (this.beginDuel(a, b, c.failer ?? null)) { this.duelAt.set(key, this.clock); return "started"; }
      }
    }
    return wait ? "wait" : "none";
  }
  /** retry clashes that could not duel yet; drop them once expired or no longer a live clash */
  private retryDuels() {
    for (const [k, w] of this.duelWait) {
      const live = this.conflicts.find((c) => c.level === "clash" && conflictKey(c) === k);
      if (!live || this.clock > w.until) { this.duelWait.delete(k); continue; }
      if (this.duels.length >= DUEL_MAX) continue;
      const r = this.tryDuel(live);
      if (r === "started" || r === "none") this.duelWait.delete(k);
    }
  }

  private beginDuel(a: Employee, b: Employee, failer: string | null): boolean {
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (dist < DUEL_MIN_DIST) return false; // stacked on the same camp slot: nothing to draw between them
    const bothSpots = a.deskIdx >= 0 && b.deskIdx >= 0;
    let walk = !this.reducedMotion && bothSpots && dist <= DUEL_WALK_MAX;
    if (walk) { // a bystander standing in the fight's movement band would be run through: duel in place instead
      const m = duelMidOfDesks(a.deskIdx, b.deskIdx, this.tmpPt), reach = DUEL_HALF + DUEL_KNOCK_KO + CH_W; // fighters' sprite boxes + a bystander's box
      for (const o of this.employees.values()) {
        if (o === a || o === b || o.state === "LEAVING" || this.isHidden(o)) continue;
        if (Math.abs(o.x - m.x) < reach && Math.abs(o.y - m.y) < CH_H) { walk = false; break; }
      }
    }
    if (!walk && dist > DUEL_RANGE_MAX) return false;
    // in-place duels (camp / far apart / reduced motion) are "still": a VS badge + emotes, no effects between the sprites
    const still = !walk;
    const [L, R] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
    const sl = styleOf(L.look.cls), sr = styleOf(R.look.cls);
    let kind: DuelKind, agg: 0 | 1 = 0;
    if (sl === sr) kind = sl === "sword" ? "sword" : sl === "magic" ? "orb" : "arrows";
    else if (sl === "arrow" || sr === "arrow") {
      const other = sl === "arrow" ? sr : sl;
      kind = other === "sword" ? "arrow_sword" : "arrow_magic";
      agg = sl === "arrow" ? 0 : 1;
    } else { kind = "magic_sword"; agg = sl === "magic" ? 0 : 1; }
    const d: Duel = {
      l: L.id, r: R.id, kind, styleL: sl, styleR: sr, agg, walk, still, phase: walk ? "go" : "fight",
      start: this.clock, t0: walk ? -1 : this.clock, winner: this.duelWinner(L, R, failer), failer,
      ix: (L.x + R.x) / 2, iy: (L.y + R.y) / 2 - 12, beat: -1, fxm: 0, decided: false, flourished: false,
    };
    this.duels.push(d);
    L.duel = d; R.duel = d;
    if (walk) {
      const m = duelMidOfDesks(L.deskIdx, R.deskIdx, this.tmpPt);
      this.startWalk(L, m.x - DUEL_HALF, m.y);
      this.startWalk(R, m.x + DUEL_HALF, m.y);
    } else {
      if (!L.bubble) L.tempBubble = { e: "💢", until: this.clock + 2.5 };
      if (!R.bubble) R.tempBubble = { e: "💢", until: this.clock + 2.5 };
    }
    this.dirty = true;
    return true;
  }
  private startWalk(e: Employee, x: number, y: number) {
    e.state = "DUEL"; e.stateSince = this.clock; e.path = [{ x, y }]; e.trail = []; e.holdUntil = 0; e.tempBubble = null;
  }

  /** a NEW overlap: both glare (💢) and the flag between them gets tugged (at most once per pair per cooldown) */
  private glare(c: TerritoryConflict) {
    const emps = c.sids.map((x) => this.employees.get(x)).filter((e): e is Employee => !!e && e.state !== "LEAVING");
    if (emps.length < 2) return;
    const [a, b] = emps;
    const key = pairKey(a.id, b.id);
    const last = Math.max(this.glareAt.get(key) ?? -Infinity, this.duelAt.get(key) ?? -Infinity);
    if (this.clock - last < GLARE_COOLDOWN) return;
    this.glareAt.set(key, this.clock);
    if (a.state === "SEATED" && !a.bubble && a.act !== "handup") a.tempBubble = { e: "💢", until: this.clock + 2 };
    if (b.state === "SEATED" && !b.bubble && b.act !== "handup") b.tempBubble = { e: "💢", until: this.clock + 2 };
    this.tugs.push({ a: a.id, b: b.id, until: this.clock + 2.4 });
    if (this.tugs.length > 6) this.tugs.shift();
  }
  /** the duel was fought to the end: every clash between these two counts as settled */
  private settle(d: Duel) {
    for (const c of this.conflicts) if (c.level === "clash" && c.sids.includes(d.l) && c.sids.includes(d.r)) this.settled.add(conflictKey(c));
  }
  /** true once a finished duel has settled this clash (the arena between the plots is cleared) */
  isSettled(c: { file: string; level: string }): boolean { return this.settled.has(conflictKey(c)); }

  /** end time of the flag tug between two sessions (0 when none) */
  tugUntil(a: string, b: string): number {
    for (const t of this.tugs) if ((t.a === a && t.b === b) || (t.a === b && t.b === a)) return t.until;
    return 0;
  }

  /** fight over for this adventurer: back to the spot (walking duel) or just release */
  private sendHome(e: Employee | undefined, d: Duel) {
    if (!e || e.duel !== d) return;
    if (e.state === "DUEL") {
      const s = seatPoint(e.deskIdx, e.slot);
      e.path = [{ x: s.x, y: s.y }]; e.trail = []; e.holdUntil = 0;
    } else { e.duel = null; e.facing = 1; }
  }
  /** one adventurer of a duel in its "back" phase; true while still walking home */
  private backStep(e: Employee | undefined, d: Duel): boolean {
    if (!e || e.duel !== d) return false;
    if (e.state !== "DUEL") { e.duel = null; return false; }
    if (e.path.length) return true;
    e.duel = null; this.sit(e);
    return false;
  }

  private updateDuels() {
    if (this.clock - this.pruneAt > 15) this.pruneMaps();
    for (let i = this.duels.length - 1; i >= 0; i--) {
      const d = this.duels[i];
      const L = this.employees.get(d.l), R = this.employees.get(d.r);
      const lOk = !!L && L.duel === d, rOk = !!R && R.duel === d;
      const okState = (e: Employee) => e.state === (d.walk ? "DUEL" : "SEATED");
      // stand both down: someone left / drank / got hidden by the filter / needs the user (❗ must show), or reduced motion switched on mid-walk
      const stop = d.phase !== "back" && (!lOk || !rOk || !okState(L!) || !okState(R!)
        || this.isHidden(L) || this.isHidden(R) || this.isWaiting(L!) || this.isWaiting(R!) || (this.reducedMotion && !d.still));
      if (stop) {
        if (d.walk) { d.phase = "back"; this.sendHome(L, d); this.sendHome(R, d); }
        else {
          if (L && L.duel === d) { L.duel = null; L.facing = 1; }
          if (R && R.duel === d) { R.duel = null; R.facing = 1; }
          this.duels.splice(i, 1); this.dirty = true; continue;
        }
      }
      if ((d.phase as Duel["phase"]) === "go") {
        if (!L!.path.length && !R!.path.length) {
          d.phase = "fight"; d.t0 = this.clock;
          if (!this.reducedMotion) this.burst((L!.x + R!.x) / 2, L!.y - 10, 6, GOLD_COLS, 40, 40, 0.4, 1, true);
        }
      }
      if ((d.phase as Duel["phase"]) === "fight") {
        const u = this.clock - d.t0;
        L!.facing = 1; R!.facing = -1;
        if (u >= (d.still ? DUEL_STILL : DUEL_FIGHT)) {
          this.settle(d);
          if (d.walk) { d.phase = "back"; this.sendHome(L, d); this.sendHome(R, d); }
          else { L!.duel = null; R!.duel = null; L!.facing = 1; R!.facing = 1; this.duels.splice(i, 1); this.dirty = true; continue; }
        } else if (!d.still) this.duelFx(d, L!, R!, u);
      }
      if ((d.phase as Duel["phase"]) === "back") {
        let live = 0;
        if (this.backStep(L, d)) live++;
        if (this.backStep(R, d)) live++;
        if (!live) { this.duels.splice(i, 1); this.dirty = true; }
      }
    }
  }

  /**
   * One-shot effects of the choreography (see duelScript): dust / muzzle flash at the launch, impact burst + damage pop + trauma at the
   * hit, K.O. text, the winner flourish. Particles are flagged `under` (they fade, so never over a character). No per-frame allocation.
   */
  private duelFx(d: Duel, L: Employee, R: Employee, u: number) {
    if (this.reducedMotion) return;
    if (!d.decided && u >= DUEL_FINAL_AT) { d.decided = true; d.winner = this.duelWinner(L, R, d.failer); } // decided now, so a failure that arrived during the fight still counts
    const s0 = duelScript(d, 0, u, FX0), s1 = duelScript(d, 1, u, FX1);
    if (s0.ex !== d.beat) { d.beat = s0.ex; d.fxm &= 8; } // bit 8 (K.O. shown) survives the beat change
    if (s0.ex < 0) return;
    if (s0.ex === 5) {
      if (!d.flourished) {
        d.flourished = true;
        const w = d.winner === 0 ? L : R;
        this.ring(w.x, w.y - CH_H - 4, 8, GOLD_COLS, 22, 0.7, true);
        this.pop(w.x, w.y - CH_H - 12, "WIN!", "#ffe14a", false, true, 1.1);
        if (!(d.fxm & 8)) { // a long frame jumped over the final exchange: still show the K.O.
          d.fxm |= 8;
          const lo = d.winner === 0 ? R : L, so = duelScript(d, d.winner === 0 ? 1 : 0, u, FX1);
          this.ring(lo.x + so.dx, lo.y - CH_H - 6, 8, GOLD_COLS, 24, 0.6, true);
          this.pop(lo.x + so.dx, lo.y - CH_H - 12, "K.O.!", "#ffffff", true, false, 1.2);
        }
      }
      return;
    }
    const A = s0.atk === 0 ? L : s0.atk === 1 ? R : null, dirA = s0.atk === 1 ? -1 : 1;
    const aStyle = s0.atk === 0 ? d.styleL : d.styleR;
    if (!(d.fxm & 1) && s0.stage >= 2) { // launch
      d.fxm |= 1;
      if (!A) { this.burst(L.x + 6, L.y - 1, 3, DUST_COLS, 30, 40, 0.3, 1, true); this.burst(R.x - 6, R.y - 1, 3, DUST_COLS, 30, 40, 0.3, 1, true); }
      else if (s0.act === 1) this.burst(A.x - dirA * 6, A.y - 1, 4, DUST_COLS, 34, 40, 0.3, 1, true);
      else this.burst(A.x + dirA * 11, A.y - 15, 4, aStyle === "magic" ? (A.look.cls === "cleric" ? HOLY_COLS : MAGIC_COLS) : ARROW_COLS, 40, 0, 0.25, 1, true);
    }
    if (!(d.fxm & 2) && s0.stage >= 3) { // impact
      d.fxm |= 2;
      const c = duelContact(L, R, s0, POINT_SCRATCH);
      d.ix = c.x; d.iy = c.y;
      if (!A) {
        this.pop(c.x, c.y - 16, "CLANG!", "#ffe14a", true, true, 0.9);
        this.burst(c.x, c.y, 12, SPARK_COLS, 70, 60, 0.4, 1, true);
        this.ring(c.x, c.y, 8, CLASH_COLS, 30, 0.35, true);
        this.addTrauma(0.2);
      } else {
        const D = s0.atk === 0 ? R : L, big = s0.big;
        const cols = aStyle === "sword" ? SPARK_COLS : aStyle === "magic" ? (A.look.cls === "cleric" ? HOLY_COLS : MAGIC_COLS) : ARROW_COLS;
        this.burst(c.x, c.y, big ? 16 : 8, cols, big ? 85 : 60, 60, 0.4, 1, true);
        this.pop(D.x, D.y - CH_H - 12, big ? "CRIT!" : "-1", big ? "#ff4a4a" : "#ffb347", big, big, big ? 1.1 : 0.7);
        this.addTrauma(big ? 0.55 : 0.12);
      }
    }
    if (s0.big && !(d.fxm & 4) && s0.q >= DUEL_IMPACT_FINAL + DUEL_STOP_FINAL + 0.3) { // knocked out
      d.fxm |= 12;
      const lo = d.winner === 0 ? R : L, so = d.winner === 0 ? s1 : s0;
      this.ring(lo.x + so.dx, lo.y - CH_H - 6, 8, GOLD_COLS, 24, 0.6, true);
      this.pop(lo.x + so.dx, lo.y - CH_H - 12, "K.O.!", "#ffffff", true, false, 1.2);
      this.addTrauma(0.2);
    }
  }

  /** sparks on the contested flag while a clash is live (the flag is knocked over) */
  private updateTerritoryFx(dt: number) {
    for (let i = this.tugs.length - 1; i >= 0; i--) if (this.tugs[i].until < this.clock) this.tugs.splice(i, 1);
    if (this.reducedMotion || !this.conflicts.length) return;
    this.terrFxAt -= dt;
    if (this.terrFxAt > 0) return;
    this.terrFxAt = 0.8;
    let n = 0;
    for (const r of this.conflictRows()) {
      if (r.level !== "clash" || n >= 4 || this.settled.has(conflictKey(r))) continue;
      const a = this.employees.get(r.sids[0]), b = this.employees.get(r.sids[1]);
      if (!a || !b || a.deskIdx < 0 || b.deskIdx < 0 || this.isHidden(a) || this.isHidden(b)) continue;
      const m = duelMidOfDesks(a.deskIdx, b.deskIdx, this.tmpPt);
      this.burst(m.x, m.y - 4, 3, CLASH_COLS, 26, 60, 0.4, 1, true);
      n++;
    }
  }

  /** drop duel/glare/failure bookkeeping that can no longer matter */
  private pruneMaps() {
    this.pruneAt = this.clock;
    for (const [k, t] of this.duelAt) if (this.clock - t > DUEL_COOLDOWN) this.duelAt.delete(k);
    for (const [k, t] of this.glareAt) if (this.clock - t > GLARE_COOLDOWN) this.glareAt.delete(k);
    for (const [k, t] of this.editFailAt) if (this.clock - t > 120) this.editFailAt.delete(k);
  }
  private forgetFighter(id: string) {
    this.editFailAt.delete(id);
    for (const m of [this.duelAt, this.glareAt]) for (const k of m.keys()) if (k.startsWith(id + "|") || k.endsWith("|" + id)) m.delete(k);
  }

  private clashEligible(c: TerritoryConflict): boolean { return c.sids.filter((x) => this.employees.has(x)).length >= 2; }
  /** fire clash alerts that were waiting for their sessions to become known */
  private recheckPending() {
    if (!this.pendingClash.size) return;
    let n = 0;
    for (const [k, c] of [...this.pendingClash]) {
      if (!this.clashEligible(c)) continue;
      this.pendingClash.delete(k);
      this.seenClash.add(k);
      if (n++ < 3) { this.alertClash(c); this.startDuel(c); }
    }
  }

  private alertClash(c: TerritoryConflict) {
    const known = c.sids.map((x) => this.employees.get(x)).filter((e): e is Employee => !!e);
    this.addBanner("quest", `⚔️ ${trunc(c.file, 30)}`);
    if (!this.reducedMotion) this.addTrauma(0.35);
    const a = known[0];
    this.log.unshift({
      id: this.logSeq++, sid: a.id, color: a.look.shirt, bad: true,
      text: `${a.tag} · ${a.project} · ชนกัน ${c.file} vs ${known.slice(1).map((e) => e.tag).join(", ")}`,
      time: Date.now(), tag: a.tag, project: a.project, intern: false, internLabel: "", kind: "Clash",
      detail: `${c.file} vs ${known.slice(1).map((e) => e.tag).join(", ")}`,
    });
    if (this.log.length > 100) this.log.length = 100;
  }

  /** live, non-dismissed conflicts between >= 2 sessions this client knows (unfiltered by the session filter) */
  conflictRows(): ConflictRow[] {
    if (this.rowsCache) return this.rowsCache;
    const out: ConflictRow[] = [];
    for (const c of this.conflicts) {
      const key = conflictKey(c);
      if (this.dismissed.has(key)) continue;
      const emps = c.sids.map((x) => this.employees.get(x)).filter((e): e is Employee => !!e);
      if (emps.length < 2) continue;
      out.push({ key, file: c.file, sids: emps.map((e) => e.id), names: emps.map((e) => `${e.tag} ${e.project}`), level: c.level, since: c.since });
    }
    return (this.rowsCache = out);
  }
  /** non-dismissed clashes (tab title) */
  clashCount(): number { let n = 0; for (const r of this.conflictRows()) if (r.level === "clash") n++; return n; }
  claimsOf(id: string): number { return this.claimN.get(id) ?? 0; }
  dismissConflict(key: string) {
    if (this.dismissed.get(key) === Infinity) return;
    this.dismissed.set(key, Infinity);
    if (this.dismissed.size > 200) this.dismissed.delete(this.dismissed.keys().next().value as string);
    this.bumpTerr(); this.dirty = true;
  }

  setFilter(f: Partial<GuildFilter>) {
    const n = { query: (f.query ?? this.filter.query).trim(), hideStray: f.hideStray ?? this.filter.hideStray };
    if (n.query === this.filter.query && n.hideStray === this.filter.hideStray) return;
    this.filter = n;
    this.hidVer++;
    if (this.hoverId && this.isHidden(this.employees.get(this.hoverId))) this.hoverId = null;
    if (this.selectedId && this.isHidden(this.employees.get(this.selectedId))) this.selectedId = null;
    this.dirty = true;
  }
  getFilter(): GuildFilter { return { ...this.filter }; }
  /** waiting on the user (main handup, or a squire with a raised hand) */
  private isWaiting(e: Employee): boolean {
    if (e.state === "LEAVING") return false;
    if (e.act === "handup") return true;
    for (const it of e.interns.values()) if (it.act === "handup") return true;
    return false;
  }
  /** Everyone waiting on the user, regardless of the session filter (tab title, notifications). */
  waitingIds(): string[] {
    const out: string[] = [];
    for (const e of this.employees.values()) if (this.isWaiting(e)) out.push(e.id);
    return out;
  }
  /**
   * Hidden by the session filter. State keeps updating and the spot stays reserved; only drawing/roster/hit-testing skip it.
   * "Stray" = a session first seen live without SessionStart, never listed in a server snapshot's `sessions`,
   * with fewer than 3 observed events. Snapshot-listed sessions and anyone waiting on the user (handup) are never stray.
   * Result is cached per employee (see hidVer).
   */
  isHidden(e: Employee | undefined): boolean {
    if (!e) return false;
    const c = this.hidCache.get(e.id);
    if (c && c.v === this.hidVer && c.act === e.act) return c.h;
    const proj = c && c.v === this.hidVer ? c.proj : e.project.toLowerCase();
    const q = this.filter.query.toLowerCase();
    let h = false;
    if (q && !proj.includes(q)) h = true;
    else if (this.filter.hideStray && !e.sawStart && !e.known && e.evCount < 3 && !this.isWaiting(e)) h = true;
    this.hidCache.set(e.id, { v: this.hidVer, act: e.act, h, proj });
    return h;
  }

  private signature(): string {
    let s = `${this.logSeq}|${this.log.length}|${this.hoverId}|${this.selectedId}|${this.treasury}`;
    s += `|${this.filter.query}|${this.filter.hideStray ? 1 : 0}|T${this.terrVer}|A${this.attnVer}`;
    for (const e of this.employees.values()) {
      if (this.isHidden(e)) { s += `;h${e.id}${this.isWaiting(e) ? "w" + this.statusOf(e) : ""}`; continue; }
      const cf = this.ctxFrac(e.id);
      s += `;${e.id}${cf === null ? "" : "c" + Math.round(cf * 100) + (this.ctxMap.get(e.id)!.guessed ? "g" : "")},${this.statusOf(e)},${e.interns.size},${e.deskIdx},${e.lv}:${e.xp}:${e.gold}:${e.kills}:${e.hearts}`;
      for (const it of e.interns.values()) s += `,${it.id}:${it.label}:${it.act}:${it.detail ?? ""}:${it.count}:${it.failed ? 1 : 0}`;
    }
    return s;
  }

  /** push the view to subscribers if it changed (the frame loop calls this ~5x/s) */
  publish() { this.emit(); }

  private emit(force = false) {
    if (!this.listeners.size) return;
    const sig = this.signature();
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;
    const v = this.getView();
    for (const l of this.listeners) l(v);
    this.dirty = false;
  }

  getView(): OfficeView {
    let hiddenCount = 0;
    const hiddenIds: string[] = [];
    const waiting: WaitingRow[] = [];
    for (const e of this.employees.values()) {
      if (this.isWaiting(e)) waiting.push({ id: e.id, tag: e.tag, project: e.project, status: this.statusOf(e), hidden: this.isHidden(e) });
    }
    const conflicts = this.conflictRows();
    const confOf = new Map<string, "overlap" | "clash">();
    for (const c of conflicts) for (const id of c.sids) if (c.level === "clash" || !confOf.has(id)) confOf.set(id, c.level);
    const roster = [...this.employees.values()]
      .filter((e) => { if (this.isHidden(e)) { hiddenCount++; hiddenIds.push(e.id); return false; } return true; })
      .sort((a, b) => a.order - b.order)
      .map((e) => {
        const cx = this.ctxMap.get(e.id);
        const cl = this.claimN.get(e.id), cf = confOf.get(e.id);
        return {
        ...(cx ? { ctxUsed: cx.used, ctxLimit: cx.limit, ctxGuessed: cx.guessed } : {}),
        ...(cl ? { claims: cl } : {}),
        ...(cf ? { conflict: cf } : {}),
        id: e.id, tag: e.tag, project: e.project, color: e.look.shirt, status: this.statusOf(e),
        interns: e.interns.size, internList: [...e.interns.values()].map(internRow), desk: e.deskIdx, look: e.look, act: this.rosterAct(e),
        level: e.lv, xp: e.xp, xpNext: xpNeed(e.lv), gold: e.gold, kills: e.kills, hp: e.hearts, hpMax: MAX_HEARTS,
      };});
    return { roster, log: this.log.slice(), hoverId: this.hoverId, selectedId: this.selectedId, treasury: this.treasury, hiddenCount, hiddenIds, waiting, conflicts, attention: this.attentionRows() };
  }

  private rosterAct(e: Employee): RosterAct {
    switch (e.state) {
      case "ENTERING": return "enter";
      case "LEAVING": return "leave";
      case "STRETCH": return "stretch";
      case "TO_COFFEE": case "FROM_COFFEE": case "DRINK": return "coffee";
    }
    if (e.act !== "handup") for (const it of e.interns.values()) if (it.act === "handup") return "intern_handup";
    return e.act;
  }

  statusOf(e: Employee): string {
    switch (e.state) {
      case "ENTERING": return "เข้ากิลด์ รับเควส 📜";
      case "LEAVING": return "ส่งเควส กลับบ้าน 👋";
      case "STRETCH": return "พักเหนื่อย 😮‍💨";
      case "TO_COFFEE": return "กลับไปโรงเตี๊ยม 🍺";
      case "FROM_COFFEE": return "ออกไปลุยต่อ 🗡️";
      case "DRINK": return "ดื่มเอลพักเหนื่อย 🍺";
      case "DUEL": return "ดวลแย่งดินแดน ⚔️";
    }
    if (e.hurtUntil > this.clock) return "โดนโจมตี 💥";
    if (e.boss && e.act !== "handup") return "สู้บอส 👹";
    if (e.resting && e.act !== "handup") return "นั่งพักข้างกองไฟ 🔥";
    if (e.act !== "handup") for (const it of e.interns.values()) if (it.act === "handup") return "ต้องการคุณ ❗ (สไควร์)";
    switch (e.act) {
      case "typing": return "ร่ายเวท (แก้โค้ด) ✨";
      case "reading": return "อ่านคัมภีร์ 📜";
      case "bash": return "ฟันมอนสเตอร์ ⚔️";
      case "phone": return "ส่งนกฮูกหาข่าว 🦉";
      case "mcp": return "เปิดประตูมิติ 🌀";
      case "sticky": return "จดบันทึกเควส 📝";
      case "handup": return "ต้องการคุณ ❗";
      default:
        if (e.note === "agent") return "เรียกสไควร์ช่วยรบ 🛡️";
        if (e.note === "idle") return "รอคำสั่ง 💤";
        return "วางแผน 🤔";
    }
  }

  // ---------- hit testing ----------
  hit(lx: number, ly: number): string | null {
    let best: Employee | null = null;
    for (const e of this.employees.values()) {
      if (this.isHidden(e)) continue;
      if (lx >= e.x - CH_W / 2 && lx <= e.x + CH_W / 2 && ly >= e.y - CH_H && ly <= e.y) {
        if (!best || e.y >= best.y) best = e;
      }
    }
    return best ? best.id : null;
  }

  testHand() {
    const list = [...this.employees.values()].filter((e) => e.state !== "LEAVING");
    if (!list.length) return;
    const e = list[Math.floor(Math.random() * list.length)];
    this.event({
      session_id: e.id, hook_event_name: "Notification", cwd: e.cwd,
      notification_type: "permission_prompt", message: "Claude needs your permission",
    });
  }

  // ---------- update ----------
  update(rawDt: number) {
    this.realTime += rawDt;
    if (this.selectedId && this.realTime > this.selectedUntil) { this.selectedId = null; this.dirty = true; }
    if (this.banners.length && this.banners[0].start >= 0 && this.realTime - this.banners[0].start > this.banners[0].dur) this.banners.shift();
    this.saveProgress();
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - rawDt * 2.2);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - rawDt * 2);
    const dt = this.paused ? 0 : rawDt * this.speed;
    if (dt <= 0) return;
    this.clock += dt;
    this.updateFx(dt);
    this.updateAmbient(rawDt);
    this.sim?.update();
    this.promoteOverflow();
    this.retryDuels();
    this.updateDuels();
    this.updateTerritoryFx(dt);
    for (const e of [...this.employees.values()]) this.updateEmployee(e, dt);
  }

  // ---------- effects ----------
  addTrauma(v: number) { this.trauma = Math.min(1, this.trauma + v); }

  private emitP(x: number, y: number, vx: number, vy: number, g: number, life: number, col: string, size = 1, spr: string | null = null, under = false) {
    let p = this.particles[this.pIdx];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const q = this.particles[(this.pIdx + i) % MAX_PARTICLES];
      if (!q.on) { p = q; this.pIdx = (this.pIdx + i + 1) % MAX_PARTICLES; break; }
      if (i === MAX_PARTICLES - 1) this.pIdx = (this.pIdx + 1) % MAX_PARTICLES; // pool full: recycle the next slot
    }
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g; p.age = 0; p.life = life; p.col = col; p.size = size; p.spr = spr; p.under = under;
  }

  private burst(x: number, y: number, n: number, cols: string[], speed: number, g = 90, life = 0.5, size = 1, under = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * rand(0.5, 1);
      this.emitP(x, y, Math.cos(a) * v, Math.sin(a) * v - speed * 0.4, g, life * rand(0.7, 1.1), cols[i % cols.length], size, null, under);
    }
  }

  private ring(x: number, y: number, n: number, cols: string[], speed: number, life: number, under = false) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.emitP(x, y, Math.cos(a) * speed, Math.sin(a) * speed * 0.7, 0, life, cols[i % cols.length], i % 3 === 0 ? 2 : 1, null, under);
    }
  }

  private pop(x: number, y: number, text: string, col: string, big = false, star = false, dur = 0.8) {
    this.popups.push({ x, y, text, col, big, born: this.clock, dur, star });
    if (this.popups.length > MAX_POPUPS) this.popups.splice(0, this.popups.length - MAX_POPUPS);
  }

  private addBanner(kind: Banner["kind"], text: string) {
    this.banners.push({ kind, text, start: -1, dur: 2.5 });
    if (this.banners.length > 4) this.banners.splice(1, this.banners.length - 4);
  }

  private updateFx(dt: number) {
    for (const p of this.particles) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age >= p.life) { p.on = false; continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) if (this.clock - this.popups[i].born > this.popups[i].dur) this.popups.splice(i, 1);
  }

  private updateAmbient(dt: number) {
    this.ambT += dt;
    const t = this.ambT;
    for (const b of this.butterflies) {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        b.tx = Math.min(W - 8, Math.max(HALL_W + 10, b.x + rand(-50, 50)));
        b.ty = Math.min(205, Math.max(62, b.y + rand(-30, 30)));
      } else { const v = 15 * dt; b.x += (dx / d) * v; b.y += (dy / d) * v; }
    }
    for (const f of this.fireflies) {
      f.x = f.sx + Math.sin(t * 0.5 + f.ph * 3) * 12;
      f.y = f.sy + Math.sin(t * 0.7 + f.ph * 5) * 8;
    }
    if (this.bird) {
      const b = this.bird;
      b.x += b.vx * dt;
      b.ph += dt;
      if (b.x < HALL_W - 12 || b.x > W + 12) { this.bird = null; this.nextBird = t + rand(20, 40); }
    } else if (t >= this.nextBird) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.bird = { x: dir > 0 ? HALL_W - 8 : W + 8, y: rand(10, 26), vx: dir * rand(26, 38), ph: 0 };
    }
    // chimney / hearth smoke
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.age += dt; s.y -= 6 * dt; s.x += Math.sin(s.age * 2 + i) * 3 * dt;
      if (s.age > s.life) this.smoke.splice(i, 1);
    }
    if (t >= this.nextSmoke && this.smoke.length < 8) {
      this.smoke.push({ x: HEARTH.x + 11 + rand(-2, 2), y: HEARTH.y - 1, age: 0, life: 2.4 });
      this.nextSmoke = t + 0.7;
    }
    // rain
    if (this.rainStart < 0) {
      if (t >= this.nextRain) { this.rainStart = t; this.rainEnd = t + 60; }
      this.rain = 0;
    } else {
      if (t > this.rainEnd + 3) { this.rain = 0; this.scheduleRain(); }
      else this.rain = Math.max(0, Math.min(1, (t - this.rainStart) / 3, (this.rainEnd + 3 - t) / 3));
    }
  }

  private move(e: Employee, dt: number): boolean {
    if (e.holdUntil > this.clock) return false;
    let rem = SPEED * dt;
    while (rem > 0 && e.path.length) {
      const t = e.path[0];
      const dx = t.x - e.x, dy = t.y - e.y;
      const d = Math.hypot(dx, dy);
      if (dx !== 0) e.facing = dx > 0 ? 1 : -1;
      e.dustAcc += Math.min(d, rem) / SPEED;
      if (e.dustAcc > 0.16) {
        e.dustAcc = 0;
        this.emitP(e.x - e.facing * 3 + rand(-1, 1), e.y - 1, -e.facing * rand(2, 6), rand(-8, -3), 0, 0.35, "#d8c8a0", 1, Math.random() < 0.5 ? "dust0" : "dust1");
      }
      if (d <= rem) {
        e.x = t.x; e.y = t.y; rem -= d;
        e.path.shift();
        if (e.state === "TO_COFFEE") e.trail.push(t);
        if (t.wait && e.path.length) {
          e.holdUntil = this.clock + t.wait;
          if (e.state === "LEAVING") e.lootAt = this.clock;
          else e.noteAt = this.clock;
          break;
        }
      } else {
        e.x += (dx / d) * rem; e.y += (dy / d) * rem; rem = 0;
      }
    }
    return e.path.length === 0;
  }

  private updateEmployee(e: Employee, dt: number) {
    // a duel is not a stall: in-flight tools must not age into a boss while the adventurer is busy dueling
    if (e.duel && e.pending.size) for (const [k, t0] of e.pending) e.pending.set(k, t0 + dt);
    // idle timeout is ~10 real minutes: the sim clock is speed-scaled, and waiting on a permission prompt is not idle.
    if (e.state !== "LEAVING" && e.act !== "handup" && e.pending.size === 0 && this.clock - e.lastEventAt > 600 * Math.max(1, this.speed)) this.leave(e);
    switch (e.state) {
      case "ENTERING":
        if (this.move(e, dt)) this.sit(e);
        break;
      case "FROM_COFFEE":
        if (this.move(e, dt)) this.sit(e);
        break;
      case "DUEL":
        if (e.path.length) this.move(e, dt); // updateDuels() owns the phase changes
        break;
      case "TO_COFFEE":
        if (this.move(e, dt)) {
          e.state = "DRINK"; e.stateSince = this.clock; e.facing = 1;
          e.hearts = MAX_HEARTS;
          for (let k = 0; k < 3; k++) this.emitP(e.x - 6 + k * 6, e.y - 22, rand(-4, 4), rand(-16, -10), 0, 0.9, "#ff5a6a", 1, "heart");
        }
        break;
      case "LEAVING":
        if (this.move(e, dt)) {
          if (e.returning) this.reenter(e);
          else { this.employees.delete(e.id); this.forgetFighter(e.id); this.bumpTerr(); this.dirty = true; }
        }
        break;
      case "STRETCH":
        if (this.clock - e.stateSince >= 1.2) {
          e.state = "TO_COFFEE";
          e.stateSince = this.clock;
          const r = routeToTavern(e.deskIdx, e.slot, e.order);
          e.trail = [r[0]];
          e.path = r.slice(1);
        }
        break;
      case "DRINK":
        if (this.clock - e.stateSince >= 3) {
          e.state = "FROM_COFFEE";
          e.path = [...e.trail].reverse();
          e.trail = [];
        }
        break;
      case "SEATED":
        if (e.tempBubble && this.clock > e.tempBubble.until) e.tempBubble = null;
        if (e.act === "thinking" && !e.bubble && !e.tempBubble && this.clock >= e.nextThought) {
          e.tempBubble = { e: "…", until: this.clock + 1.5 };
          e.nextThought = this.clock + rand(4, 8);
        }
        if (e.act === "handup") { for (const k of e.pending.keys()) e.pending.set(k, this.clock); } // waiting on the user is not a boss fight
        if (e.pending.size > 0 && !e.boss && e.deskIdx >= 0 && e.monPos) {
          let oldest = Infinity;
          for (const t0 of e.pending.values()) if (t0 < oldest) oldest = t0;
          if (this.clock - oldest > BOSS_AFTER) this.spawnBoss(e);
        }
        break;
    }
    e.resting = e.state === "SEATED" && e.deskIdx >= 0 && e.act === "thinking" && e.pending.size === 0 && !e.boss
      && this.clock - e.lastEventAt > REST_AFTER;
    if (e.state !== "LEAVING" && e.deskIdx >= 0 && e.monDead && e.monRespawnAt <= this.clock) this.spawnMonster(e);
    if (e.state !== "SEATED" && e.tempBubble && this.clock > e.tempBubble.until) e.tempBubble = null;
  }

  private sit(e: Employee) {
    const s = seatPoint(e.deskIdx, e.slot);
    e.x = s.x; e.y = s.y;
    e.facing = 1;
    e.trail = [];
    if (e.deskIdx >= 0 && !e.monPos) this.spawnMonster(e);
    e.state = "SEATED";
    e.stateSince = this.clock;
    const q = e.queue;
    e.queue = [];
    for (let i = 0; i < q.length; i++) {
      if (e.state !== "SEATED") { e.queue = q.slice(i); break; }
      this.applyEvent(e, q[i], i === q.length - 1);
    }
    if (e.coffeeAfter) { // a Stop arrived while dueling: take the break now
      e.coffeeAfter = false;
      if (e.state === "SEATED") { e.state = "STRETCH"; e.stateSince = this.clock; }
    }
  }

  private leave(e: Employee) {
    if (e.state === "LEAVING") return;
    e.duel = null; e.coffeeAfter = false; // updateDuels() sends the opponent home
    const path: Pt[] = routeLeave(e.x, e.y);
    e.state = "LEAVING";
    e.returning = false;
    e.path = path;
    e.trail = [];
    e.holdUntil = 0;
    if (e.monPos && !e.monDead) {
      e.monDead = true; e.monDeadAt = this.clock; e.monLoot = false; e.monRespawnAt = Infinity;
    }
    e.bubble = null; e.tempBubble = null;
    e.queue = []; e.act = "thinking"; e.actSince = this.clock; e.note = null;
    e.hasPaper = false; e.sticky = false; e.hurtUntil = 0;
    e.boss = null; e.pending.clear(); e.resting = false; e.toolCalls = 0; e.qKills = 0; e.qGold = 0;
    e.interns.clear();
    e.deskIdx = -1; e.slot = -1;
    this.dirty = true;
  }

  /** A battle spot is free and someone is waiting at camp: send the longest-waiting seated one to it. */
  private promoteOverflow() {
    let waiting: Employee | null = null;
    for (const o of this.employees.values()) {
      if (o.deskIdx < 0 && o.slot >= 0 && o.state === "SEATED" && (!waiting || o.order < waiting.order)) waiting = o;
    }
    if (!waiting) return;
    const { desk } = this.pickSeat(waiting.id);
    if (desk < 0) return;
    const e = waiting;
    e.path = routePromote(e.x, e.y, desk);
    e.deskIdx = desk; e.slot = -1;
    e.state = "FROM_COFFEE";
    e.stateSince = this.clock;
    e.trail = []; e.holdUntil = 0;
    e.monAppearAt = -1; e.monPos = null; e.monDead = false; e.monRespawnAt = Infinity;
    e.boss = null; e.pending.clear();
    this.dirty = true;
  }

  // ---------- spawning ----------
  private pickSeat(exclude?: string): { desk: number; slot: number } {
    const used = new Set<number>(), slots = new Set<number>();
    for (const o of this.employees.values()) {
      if (o.id === exclude) continue;
      if (o.deskIdx >= 0) used.add(o.deskIdx);
      else if (o.slot >= 0) slots.add(o.slot);
    }
    let desk = -1, slot = -1;
    for (let i = 0; i < DESK_COUNT; i++) if (!used.has(i)) { desk = i; break; }
    if (desk < 0) { slot = 0; while (slots.has(slot)) slot++; }
    return { desk, slot };
  }

  private reenter(e: Employee) {
    const { desk, slot } = this.pickSeat(e.id);
    e.deskIdx = desk; e.slot = slot;
    e.returning = false;
    e.state = "ENTERING";
    e.stateSince = this.clock;
    e.trail = [];
    e.holdUntil = 0;
    e.monAppearAt = -1; e.monPos = null; e.monDead = false; e.monRespawnAt = Infinity;
    e.boss = null; e.pending.clear(); e.resting = false;
    e.path = routeIn(desk, slot).slice(1);
    this.dirty = true;
  }

  private spawnMonster(e: Employee, instant = false) {
    const kinds = MONSTER_KINDS as readonly MonsterKind[];
    e.monKind = kinds[(h32(e.id) + e.monN * 3) % kinds.length];
    e.monN++;
    e.monHp = e.monHpMax = MON_HP[e.monKind];
    e.boss = null;
    e.monPos = e.deskIdx >= 0 ? monsterSpot(e.deskIdx) : null;
    e.monAppearAt = instant ? this.clock - 10 : this.clock;
    e.monDead = false; e.monDeadAt = -99; e.monRespawnAt = Infinity; e.monLoot = false;
  }

  private defeatMonster(e: Employee) {
    e.monDead = true; e.monDeadAt = this.clock; e.monLoot = true;
    e.monRespawnAt = this.clock + 1.5 + Math.random();
  }

  private spawn(id: string, cwd: string | undefined, seated: boolean): Employee {
    const { desk, slot } = this.pickSeat();
    const seat = seatPoint(desk, slot);
    const e: Employee = {
      id, tag: "#" + id.slice(0, 3), project: projectOf(cwd), cwd: cwd ?? "", look: lookFor(id), order: this.seq++,
      deskIdx: desk, slot, x: seated ? seat.x : DOOR.x, y: seated ? seat.y : DOOR.y, path: [], trail: [],
      state: seated ? "SEATED" : "ENTERING", act: "thinking", actSince: this.clock, stateSince: this.clock,
      bubble: null, tempBubble: null, note: null, interns: new Map(), lastEventAt: this.clock, queue: [],
      facing: 1, returning: false, hasPaper: false, paperAt: -9, sparkUntil: 0, sticky: false, nextThought: this.clock + rand(4, 8),
      holdUntil: 0, noteAt: -9, lootAt: -9, hurtUntil: 0,
      monKind: "slime", monPos: null, monAppearAt: -1, monDead: false, monDeadAt: -99, monRespawnAt: Infinity, monLoot: false, monN: 0,
      monHp: 3, monHpMax: 3, boss: null, bossAt: -1, lv: 1, xp: 0, gold: 0, kills: 0, hearts: MAX_HEARTS,
      pending: new Map(), toolCalls: 0, qKills: 0, qGold: 0, resting: false,
      windupUntil: 0, hsUntil: 0, hsAt: 0, lungeUntil: 0, flashUntil: 0, monLungeUntil: 0, monKnockUntil: 0, redUntil: 0, slashUntil: 0,
      lvlAt: -99, lvlTo: 1, dustAcc: 0, duel: null, coffeeAfter: false, sawStart: false, evCount: 0, known: false,
    };
    const sv = this.demo ? undefined : this.progress[id];
    if (sv) { e.lv = sv.lv; e.xp = sv.xp; e.gold = sv.gold; e.kills = sv.kills; }
    if (!seated) e.path = routeIn(desk, slot).slice(1);
    else if (desk >= 0) this.spawnMonster(e, true);
    this.employees.set(id, e);
    this.bumpTerr(); // conflict rows depend on who is present
    this.recheckPending();
    this.dirty = true;
    return e;
  }

  loadSnapshot(snap: SnapshotMsg) {
    const ids = new Set<string>();
    const seen = new Map<string, { n: number; start: boolean }>();
    for (const ev of snap.events ?? []) {
      const k = str(ev?.session_id);
      if (!k) continue;
      const r = seen.get(k) ?? { n: 0, start: false };
      r.n++; if (ev.hook_event_name === "SessionStart") r.start = true;
      seen.set(k, r);
    }
    for (const s of snap.sessions ?? []) {
      if (!s.session_id) continue;
      ids.add(s.session_id);
      if (s.context === null) this.setContext(s.session_id, null, null);
      else if (s.context) this.setContext(s.session_id, s.context.used, s.context.limit, !!s.context.limitGuessed);
      this.ended.delete(s.session_id);
      let e = this.employees.get(s.session_id);
      if (!e) e = this.spawn(s.session_id, s.cwd, true);
      e.known = true;
      const sn = seen.get(s.session_id);
      if (sn) { e.evCount = Math.max(e.evCount, sn.n); if (sn.start) e.sawStart = true; }
      if (e.state === "LEAVING") { e.returning = true; e.lastEventAt = this.clock; continue; }
      if (s.waiting && e.act !== "handup") this.setAct(e, "handup", "❗");
      const want = new Set(s.interns ?? []);
      for (const k of [...e.interns.keys()]) if (!want.has(k)) e.interns.delete(k);
      for (const a of want) if (!e.interns.has(a)) e.interns.set(a, newIntern(a, "squire", this.clock, this.clock - 1));
    }
    for (const e of [...this.employees.values()]) if (!ids.has(e.id)) { e.returning = false; this.leave(e); }
    if (!this.log.length) for (const ev of [...(snap.events ?? [])]) this.pushLog(ev);
    if (snap.territory !== undefined) this.setTerritory(snap.territory, true);
    if (snap.attention !== undefined) this.setAttention(snap.attention);
    this.hidVer++;
    this.dirty = true;
  }

  // ---------- events ----------
  private pushLog(evt: HookEvt) {
    const name = str(evt.hook_event_name);
    if (name === "PostToolUse") return;
    const sid = str(evt.session_id);
    if (!sid) return;
    const emp = this.employees.get(sid);
    const tag = "#" + sid.slice(0, 3);
    const project = emp ? emp.project : projectOf(evt.cwd);
    let what: string;
    const tool = str(evt.tool_name);
    const detail = toolDetail(evt);
    let bad = false;
    if (name === "PreToolUse") what = `${tool} ${detail}`.trim();
    else if (name === "PostToolUseFailure") { what = `✗ ${tool} ${detail}`.trim(); bad = true; }
    else if (name === "Notification") what = `Notification ${str(evt.notification_type)}`.trim();
    else if (name === "PermissionRequest") what = `PermissionRequest ${tool}`.trim();
    else if (name === "SessionEnd") what = `SessionEnd${str(evt.reason) ? " (" + str(evt.reason) + ")" : ""}`;
    else if (name === "PreCompact") what = `PreCompact ${str(evt.trigger)}`.trim();
    else what = name || "event";
    const who = evt.agent_id && name !== "SubagentStart" && name !== "SubagentStop"
      ? `${tag} › squire ${str(evt.agent_type) || "agent"}`
      : tag;
    const detailTxt = name === "SubagentStart" || name === "SubagentStop"
      ? `${name} ${str(evt.agent_type)}`.trim()
      : what;
    this.log.unshift({
      id: this.logSeq++, sid, color: lookFor(sid).shirt, bad,
      text: `${who} · ${project} · ${detailTxt}`,
      time: Date.now(), tag, project, intern: !!evt.agent_id && name !== "SubagentStart" && name !== "SubagentStop",
      internLabel: str(evt.agent_type) || "agent",
      kind: name === "PreToolUse" || name === "PostToolUseFailure" ? tool || name : name || "event",
      detail: name === "PreToolUse" || name === "PostToolUseFailure" ? detail
        : name === "Notification" ? str(evt.notification_type)
        : name === "SubagentStart" || name === "SubagentStop" ? str(evt.agent_type)
        : name === "PermissionRequest" ? tool : "",
    });
    if (this.log.length > 100) this.log.length = 100;
    this.dirty = true;
  }

  event(evt: HookEvt) {
    if (!evt || typeof evt !== "object") return;
    const sid = str(evt.session_id);
    const name = str(evt.hook_event_name);
    if (!sid) return;
    const nowMs = Date.now();
    for (const m of [this.ended, this.endedAgents]) for (const [k, t] of m) if (nowMs - t > 30000) m.delete(k);
    if (name === "SessionStart") this.ended.delete(sid);
    else if (this.ended.has(sid)) return;
    const aid = str(evt.agent_id);
    if (aid) {
      if (name === "SubagentStart") this.endedAgents.delete(aid);
      else if (this.endedAgents.has(aid)) return;
    }
    let e = this.employees.get(sid);

    if (name === "SessionEnd") {
      this.ended.set(sid, nowMs);
      this.pushLog(evt);
      if (e) { e.returning = false; this.leave(e); }
      return;
    }
    if (name === "SessionStart" && e) {
      e.sawStart = true;
      if (e.state === "LEAVING") { e.returning = true; e.lastEventAt = this.clock; this.pushLog(evt); }
      return;
    }
    const fresh = !e;
    if (!e) e = this.spawn(sid, evt.cwd, false);
    if (name === "SessionStart") e.sawStart = true;
    e.evCount++;
    this.hidVer++;
    if (evt.cwd && (fresh || e.project === "unknown")) { e.cwd = evt.cwd; e.project = projectOf(evt.cwd); }
    this.pushLog(evt);
    e.lastEventAt = this.clock;
    if (name === "PostToolUseFailure" && EDIT_TOOLS.has(str(evt.tool_name))) this.editFailAt.set(sid, this.clock);
    if (e.state === "LEAVING") { e.returning = true; return; }

    const agentId = str(evt.agent_id);
    if (name === "SubagentStart" || name === "SubagentStop") { this.internLifecycle(e, evt); return; }
    if (agentId) { this.internEvent(e, evt); return; }

    switch (e.state) {
      case "SEATED": this.applyEvent(e, evt); break;
      case "STRETCH": e.state = "SEATED"; this.applyEvent(e, evt); break;
      case "DUEL": // never queued: apply state-only (no coffee walk), the adventurer keeps dueling; updateDuels() aborts on a ❗
        this.applyEvent(e, evt, false);
        e.coffeeAfter = name === "Stop";
        break;
      case "TO_COFFEE":
      case "DRINK":
        e.state = "FROM_COFFEE";
        e.path = [...e.trail].reverse();
        e.trail = [];
        e.tempBubble = null;
        this.enqueue(e, evt);
        break;
      default: this.enqueue(e, evt);
    }
  }

  private enqueue(e: Employee, evt: HookEvt) {
    e.queue.push(evt);
    if (e.queue.length > 5) e.queue.splice(0, e.queue.length - 5);
  }

  private setAct(e: Employee, act: Act, bubble: string | null = null, note: Employee["note"] = null) {
    if (e.act !== act) e.actSince = this.clock;
    e.act = act;
    e.bubble = bubble;
    e.note = note;
    e.tempBubble = null;
  }

  private applyEvent(e: Employee, evt: HookEvt, coffee = true) {
    const name = str(evt.hook_event_name);
    const clock = this.clock;
    switch (name) {
      case "UserPromptSubmit":
        e.hasPaper = true; e.paperAt = clock; e.sparkUntil = clock + 0.5;
        e.toolCalls = 0; e.qKills = 0; e.qGold = 0;
        this.clearPending(e);
        this.setAct(e, "thinking");
        e.nextThought = clock + rand(4, 8);
        break;
      case "PreToolUse": {
        const t = str(evt.tool_name);
        if (!AGENT_TOOLS.has(t) && !USER_WAIT_TOOLS.has(t)) {
          const id = str(evt.tool_use_id) || `#${this.pendSeq++}`;
          if (!e.pending.has(id) && e.pending.size >= MAX_PENDING) e.pending.delete(e.pending.keys().next().value as string);
          e.pending.set(id, clock);
        }
        e.windupUntil = clock + 0.15;
        if (READ_TOOLS.has(t)) this.setAct(e, "reading", "📜");
        else if (EDIT_TOOLS.has(t)) this.setAct(e, "typing");
        else if (t === "Bash") this.setAct(e, "bash", "⚔️");
        else if (t === "WebSearch" || t === "WebFetch") this.setAct(e, "phone", "🦉");
        else if (AGENT_TOOLS.has(t)) this.setAct(e, "thinking", "🛡️", "agent");
        else if (t.startsWith("mcp__")) this.setAct(e, "mcp", "🌀");
        else if (STICKY_TOOLS.has(t)) { this.setAct(e, "sticky", "📝"); e.sticky = true; }
        else this.setAct(e, "typing");
        break;
      }
      case "PostToolUse": {
        this.setAct(e, "thinking");
        e.nextThought = clock + rand(4, 8);
        this.donePending(e, evt);
        e.toolCalls++;
        this.onHit(e, str(evt.tool_name));
        break;
      }
      case "PostToolUseFailure":
        this.setAct(e, "thinking");
        e.nextThought = clock + rand(4, 8);
        this.donePending(e, evt);
        e.toolCalls++;
        this.onFail(e);
        break;
      case "PermissionRequest":
        this.setAct(e, "handup", "❗");
        break;
      case "PreCompact":
        this.setAct(e, "thinking");
        e.tempBubble = { e: "🗜️", until: clock + 2 };
        break;
      case "Notification": {
        const nt = str(evt.notification_type);
        const msg = str(evt.message).toLowerCase();
        if (HANDUP_NOTIFS.has(nt) || msg.includes("permission")) this.setAct(e, "handup", "❗");
        else if (nt === "idle_prompt") { this.clearPending(e); this.setAct(e, "thinking", "💤", "idle"); }
        else e.tempBubble = { e: "🔔", until: clock + 2 };
        break;
      }
      case "Stop":
        e.hasPaper = false;
        this.setAct(e, "thinking");
        this.clearPending(e);
        if (e.boss) this.bossLeaves(e);
        if (e.toolCalls >= 3) {
          this.addBanner("quest", `เควสสำเร็จ! ⚔️${e.toolCalls} 💰+${e.qGold}`);
        }
        e.toolCalls = 0; e.qKills = 0; e.qGold = 0;
        if (e.hearts < MAX_HEARTS) {
          e.hearts = MAX_HEARTS;
          for (let k = 0; k < 3; k++) this.emitP(e.x - 6 + k * 6, e.y - 22, rand(-4, 4), rand(-16, -10), 0, 0.9, "#ff5a6a", 1, "heart");
        }
        if (coffee) { e.state = "STRETCH"; e.stateSince = clock; }
        break;
      default:
        break;
    }
  }

  private pendSeq = 0;
  private clearPending(e: Employee) {
    e.pending.clear();
    if (e.boss) this.bossLeaves(e);
  }
  /** a tool finished: drop it from the in-flight set (by id, else the oldest keyless one) */
  private donePending(e: Employee, evt: HookEvt) {
    const t = str(evt.tool_name);
    if (AGENT_TOOLS.has(t) || USER_WAIT_TOOLS.has(t)) return;
    const id = str(evt.tool_use_id);
    if (id && e.pending.delete(id)) return;
    for (const k of e.pending.keys()) if (k.startsWith("#") || !id) { e.pending.delete(k); return; }
  }

  // ---------- combat / progression ----------
  private onHit(e: Employee, tool: string) {
    const clock = this.clock;
    if (e.boss) { this.bossDown(e); return; }
    const mp = e.monPos;
    const xp = 1 + Math.floor(Math.random() * 3);
    if (mp && e.deskIdx >= 0 && !e.monDead && clock - e.monAppearAt > 0.3) {
      const crit = Math.random() < 0.1;
      let dmg = HEAVY_TOOLS.has(tool) ? 2 : 1;
      if (crit) dmg *= 2;
      e.monHp -= dmg;
      e.flashUntil = clock + 0.07;
      e.hsUntil = clock + 0.06; e.hsAt = clock;
      e.lungeUntil = clock + 0.18; e.monKnockUntil = clock + 0.15; e.slashUntil = clock + 0.2;
      const hx = mp.x, hy = mp.y - 8;
      this.pop(hx + rand(-3, 3), hy - 6, crit ? `${dmg}!` : `${dmg}`, crit ? "#ffe14a" : "#ffffff", crit, crit);
      this.burst(hx, hy, 8, crit ? ["#ffe14a", "#ffffff", "#ff9a3a"] : ["#ffffff", "#f2c14e", "#ffb870"], crit ? 46 : 34);
      if (crit) this.addTrauma(0.75);
      if (e.monHp <= 0) this.killMonster(e);
    }
    this.gainXp(e, xp);
  }

  private killMonster(e: Employee) {
    const mp = e.monPos!;
    const g = 1 + Math.floor(Math.random() * 3);
    e.kills++; e.gold += g; e.qKills++; e.qGold += g; this.treasury += g;
    this.defeatMonster(e);
    this.pop(mp.x - 4, mp.y - 22, "+5xp", "#8ee8ff", false, false, 1.1);
    this.pop(mp.x + 6, mp.y - 14, `+${g}g`, "#f2c14e", false, false, 1.1);
    for (let k = 0; k < 5; k++) this.emitP(mp.x + rand(-4, 4), mp.y - 8, rand(-20, 20), rand(-60, -35), 160, 0.7, "#f2c14e", 1, "coin");
    this.addTrauma(0.6);
    this.gainXp(e, 5);
  }

  private gainXp(e: Employee, n: number) {
    e.xp += n;
    let up = false;
    while (e.xp >= xpNeed(e.lv)) { e.xp -= xpNeed(e.lv); e.lv++; up = true; }
    if (up) {
      e.lvlAt = this.clock; e.lvlTo = e.lv;
      this.ring(e.x, e.y - 12, 24, ["#f2c14e", "#ffffff", "#8ee8ff"], 34, 0.8);
      this.flash = 0.3;
    }
    this.touch(e);
  }

  private loseHeart(e: Employee) {
    e.hearts = Math.max(0, e.hearts - 1);
    e.hurtUntil = this.clock + 0.8;
    e.redUntil = this.clock + 0.5;
    this.pop(e.x - 4, e.y - 30, "-1", "#ff5a5a", false, false, 0.9);
    this.burst(e.x, e.y - 12, 6, ["#ff5a5a", "#ff9a9a"], 30);
    this.addTrauma(0.6);
  }

  private onFail(e: Employee) {
    const clock = this.clock;
    e.tempBubble = { e: "💥", until: clock + 1.5 };
    if (e.boss) { this.bossLeaves(e); this.loseHeart(e); return; }
    if (e.monPos && e.deskIdx >= 0 && !e.monDead) e.monLungeUntil = clock + 0.4;
    this.loseHeart(e);
  }

  private spawnBoss(e: Employee) {
    const kinds = BOSS_KINDS as readonly BossKind[];
    e.boss = kinds[(h32(e.id) + e.monN) % kinds.length];
    e.bossAt = this.clock;
    e.monDead = false; e.monAppearAt = this.clock; e.monRespawnAt = Infinity; e.monLoot = false;
    const p = e.monPos!;
    this.burst(p.x + 4, p.y - 12, 14, ["#ff5a5a", "#ffb870", "#6a2a7a"], 50, 60, 0.7);
    this.addBanner("boss", `BOSS! ${e.boss.toUpperCase()}`);
    this.addTrauma(1);
  }

  private bossDown(e: Employee) {
    const p = e.monPos!;
    e.kills++; e.gold += 10; e.qKills++; e.qGold += 10; this.treasury += 10;
    e.boss = null;
    e.monDead = true; e.monDeadAt = this.clock; e.monLoot = true; e.monRespawnAt = this.clock + 2.5;
    this.pop(p.x, p.y - 30, "BOSS DOWN!", "#ffe14a", true, true, 1.4);
    this.pop(p.x - 8, p.y - 20, "+25xp", "#8ee8ff", false, false, 1.4);
    this.pop(p.x + 10, p.y - 14, "+10g", "#f2c14e", false, false, 1.4);
    for (let k = 0; k < 14; k++) this.emitP(p.x + 4 + rand(-8, 8), p.y - 12, rand(-34, 34), rand(-90, -40), 170, 1.0, "#f2c14e", 1, "coin");
    this.burst(p.x + 4, p.y - 12, 16, ["#ffe14a", "#ffffff", "#ff9a3a"], 56);
    this.addTrauma(1);
    this.gainXp(e, 25);
  }

  /** boss runs away (tool failed / interrupted): no loot */
  private bossLeaves(e: Employee) {
    e.boss = null;
    e.monDead = true; e.monDeadAt = this.clock; e.monLoot = false; e.monRespawnAt = this.clock + 2;
    if (e.monPos) this.burst(e.monPos.x + 4, e.monPos.y - 12, 10, ["#cfd2de", "#6a2a7a"], 36);
  }

  // ---------- interns ----------
  private internLifecycle(e: Employee, evt: HookEvt) {
    const id = str(evt.agent_id);
    if (str(evt.hook_event_name) === "SubagentStart") {
      if (id) e.interns.set(id, newIntern(id, str(evt.agent_type), this.clock));
    } else {
      if (id) this.endedAgents.set(id, Date.now());
      if (id && e.interns.has(id)) e.interns.delete(id);
      else if (!id) { const k = e.interns.keys().next(); if (!k.done) e.interns.delete(k.value); }
    }
    this.dirty = true;
  }

  private internEvent(e: Employee, evt: HookEvt) {
    const id = str(evt.agent_id);
    const name = str(evt.hook_event_name);
    let it = e.interns.get(id);
    if (name === "PreToolUse") {
      if (!it) {
        it = newIntern(id, str(evt.agent_type), this.clock);
        e.interns.set(id, it);
      }
      const tn = str(evt.tool_name);
      it.act = READ_TOOLS.has(tn) ? "reading" : "typing";
      it.tool = tn; it.detail = toolDetail(evt); it.since = this.clock; it.count++; it.failed = false;
      this.dirty = true;
      return;
    }
    if (!it) return;
    if (name === "PostToolUse" || name === "PostToolUseFailure") {
      it.act = "idle"; it.since = this.clock; it.failed = name === "PostToolUseFailure";
    }
    else if (name === "PermissionRequest") it.act = "handup";
    else if (name === "Notification") {
      if (HANDUP_NOTIFS.has(str(evt.notification_type)) || str(evt.message).toLowerCase().includes("permission")) it.act = "handup";
    }
  }
}
