import { m } from "@/paraglide/messages";

import type { AttentionMsgRow, Employee, HookEvt, Office, ReceiptMsgRow } from "./engine";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

const HEX_RADIX = 16;
const HEX_LEN = 8;
const HEX_SHORT_LEN = 4;
const hex8 = () =>
  Array.from({ length: HEX_LEN }, () => Math.floor(Math.random() * HEX_RADIX).toString(HEX_RADIX)).join("");

/** An inclusive-ish [min, max] range, in seconds unless stated otherwise. */
interface Range {
  min: number;
  max: number;
}
const span = (range: Range) => rand(range.min, range.max);
const spanInt = (range: Range) => randInt(range.min, range.max);

// ---- demo pacing: tool mix weights ----
const W_READ = 25;
const W_GREP = 10;
const W_GLOB = 5;
const W_EDIT = 22;
const W_WRITE = 6;
const W_BASH = 15;
const W_SMALL = 4; // WebSearch, linear MCP
const W_AGENT = 9; // Agent: calls squires out of the ally gate
const W_TODO = 5;

// ---- demo pacing: session spawning ----
const FIRST_ADD: Range = { min: 8, max: 20 };
const NEXT_ADD: Range = { min: 8, max: 20 };
const MAX_SESSIONS = 5;
const ADD_SESSION_CHANCE = 0.6;

// ---- demo pacing: territory scenario ----
const PAIR_JITTER = 0.5;
const TERR_START_DELAY: Range = { min: 25, max: 35 };
const TERR_OVERLAP_FILES: Range = { min: 1, max: 7 };
const TERR_CLASH_FILES: Range = { min: 1, max: 4 };
const TERR_TOTAL: Range = { min: 22, max: 32 };
const TERR_CLASH_CHANCE = 0.85;
const TERR_CLASH_AFTER: Range = { min: 5, max: 8 };
const TERR_COOLDOWN: Range = { min: 45, max: 65 };

// ---- demo pacing: attention scenario ----
const ATTN_START_DELAY: Range = { min: 14, max: 22 };
const LOOP_FIRST = 3;
const LOOP_LAST = 5;
const LOOP_STEP: Range = { min: 5, max: 7 };
const ATTN_GAP: Range = { min: 10, max: 16 };
const ASKED_HOLD: Range = { min: 14, max: 20 };
const ATTN_COOLDOWN: Range = { min: 40, max: 60 };

// ---- demo pacing: receipts scenario ----
const RECEIPT_NONE_CHANCE = 0.15;
const RECEIPT_RED_CHANCE = 0.3;
const RECEIPT_SQUIRE_CHANCE = 0.25;
const RECEIPT_NONE_CALLS: Range = { min: 12, max: 45 };
const RECEIPT_CALLS: Range = { min: 8, max: 60 };
const RECEIPT_FILES_EXTRA: Range = { min: 0, max: 6 };
const RECEIPT_TASKS: Range = { min: 0, max: 3 };
const RECEIPT_RECOVERED_CHANCE = 0.5;
const RECEIPT_COMMIT_CHANCE = 0.6;
const RECEIPT_START_DELAY: Range = { min: 1, max: 2 };
const RECEIPT_SEED_COUNT = 2;
const RECEIPT_SEED_BASE_MIN = 6;
const RECEIPT_SEED_STEP_MIN = 17;
const MS_PER_MIN = 60_000;
const RECEIPT_INTERVAL: Range = { min: 14, max: 24 };
const RECEIPT_KEEP = 12;

// ---- demo pacing: a session's life ----
const CONTEXT_LIMIT = 200_000;
const CONTEXT_START: Range = { min: 8000, max: 60_000 };
const CONTEXT_GROWTH: Range = { min: 1500, max: 9000 };
const CONTEXT_COMPACT_AT = 0.97;
const CONTEXT_COMPACT_CHANCE = 0.03;
/** after PreCompact the demo session idles this long (the compaction), then reports the shrunken context */
const COMPACT_PAUSE: Range = { min: 15, max: 18 };
const CONTEXT_AFTER_COMPACT: Range = { min: 10_000, max: 30_000 };
const STARTUP_DELAY: Range = { min: 2, max: 4 };
const PROMPT_COUNT: Range = { min: 2, max: 4 };
const PROMPT_PAUSE: Range = { min: 1, max: 2 };
const STEP_COUNT: Range = { min: 4, max: 10 };
const PERMISSION_CHANCE = 0.08;
const PERMISSION_WAIT: Range = { min: 3, max: 6 };
const BOSS_CHANCE = 0.16;
const BOSS_TOOL_TIME: Range = { min: 34, max: 42 };
const BASH_TIME: Range = { min: 3, max: 8 };
const TOOL_TIME: Range = { min: 0.8, max: 5 };
const BASH_FAIL_CHANCE = 0.1;
const ANY_FAIL_CHANCE = 0.05;
const FAIL_DURATION_MS = 3000;
const OK_DURATION_MS = 1200;
const STEP_PAUSE: Range = { min: 0.3, max: 1.5 };
const LONG_BREAK_CHANCE = 0.25;
const LONG_BREAK: Range = { min: 85, max: 110 };
const SHORT_BREAK: Range = { min: 6, max: 15 };

// ---- demo pacing: ally showcase (extra squires through the ally gate + tavern trips for compaction) ----
const ALLY_START_DELAY: Range = { min: 9, max: 14 };
const ALLY_GAP: Range = { min: 16, max: 26 };
const ALLY_SQUIRES: Range = { min: 2, max: 4 };
const ALLY_SQUIRE_GAP: Range = { min: 0.2, max: 0.5 };
const ALLY_RETRY_S = 2;

// ---- demo pacing: interns ----
const INTERN_START_DELAY = 0.3;
const INTERN_STEPS: Range = { min: 2, max: 4 };
const INTERN_STEP_DELAY: Range = { min: 0.6, max: 1.5 };
const INTERN_TOOL_TIME: Range = { min: 1.5, max: 4 };
const INTERN_END_DELAY: Range = { min: 0.8, max: 1.5 };

const PROJECTS = ["dragon-shop", "quest-qa", "rune-auth", "gold-split", "portfolio"];
const FILES: Record<string, string[]> = {
  "dragon-shop": ["src/app/page.tsx", "src/line/webhook.service.ts", "src/components/Flex.tsx", "package.json"],
  "quest-qa": ["tests/login.spec.ts", "src/qa/runner.ts", "playwright.config.ts", "README.md"],
  "rune-auth": ["src/auth/auth.service.ts", "src/auth/jwt.guard.ts", "prisma/schema.prisma", "src/main.ts"],
  "gold-split": ["src/utils/split.ts", "src/app/bills/page.tsx", "prisma/schema.prisma", "src/lib/db.ts"],
  portfolio: ["src/app/page.tsx", "src/components/Hero.tsx", "src/styles/globals.css", "next.config.ts"],
};
const COMMANDS = [
  "npm test",
  "pnpm build",
  "git status",
  "npx prisma migrate dev",
  "npm run lint",
  "git diff --stat",
  "ls -la src",
  "npx tsc --noEmit",
];
const QUERIES = ["next.js app router caching", "prisma migrate drift", "line messaging api flex", "react 19 use hook"];
const WEIGHTS: [string, number][] = [
  ["Read", W_READ],
  ["Grep", W_GREP],
  ["Glob", W_GLOB],
  ["Edit", W_EDIT],
  ["Write", W_WRITE],
  ["Bash", W_BASH],
  ["WebSearch", W_SMALL],
  ["Agent", W_AGENT],
  ["TodoWrite", W_TODO],
  ["mcp__linear__list_issues", W_SMALL],
];
const TOTAL = WEIGHTS.reduce((sum, entry) => sum + entry[1], 0);

const pickTool = (): string => {
  let roll = Math.random() * TOTAL;
  for (const [toolName, weight] of WEIGHTS) {
    if ((roll -= weight) <= 0) return toolName;
  }
  return "Read";
};

const toolInput = (tool: string, project: string, cwd: string): Record<string, unknown> => {
  const file = cwd + "/" + pick(FILES[project] ?? FILES.portfolio);
  switch (tool) {
    case "Read":
    case "Edit":
    case "Write":
      return { file_path: file };
    case "Grep":
      return { pattern: pick(["useEffect", "TODO", "handleSubmit", "export default"]) };
    case "Glob":
      return { pattern: pick(["**/*.ts", "src/**/*.tsx", "**/*.spec.ts"]) };
    case "Bash":
      return { command: pick(COMMANDS) };
    case "WebSearch":
      return { query: pick(QUERIES) };
    case "Agent":
      return { description: "Explore codebase", subagent_type: "Explore", prompt: "Find usages" };
    case "TodoWrite":
      return { todos: [{ content: "step", status: "pending" }] };
    default:
      return {};
  }
};

type Gen = Generator<number, void, void>;

export class Simulator {
  private runners: { gen: Gen; wake: number }[] = [];
  private active = new Map<string, string>(); // session id -> project
  private nextAdd = 0;

  constructor(private o: Office) {
    this.addSession();
    this.addSession();
    this.nextAdd = o.clock + span(FIRST_ADD);
    this.spawn(this.territory());
    this.spawn(this.attention());
    this.spawn(this.attentionSync());
    this.spawn(this.receipts());
    this.spawn(this.ally());
  }

  /** demo-only: now and then a calm adventurer calls a few squires out of the ally gate, or sends a calm one to the tavern for a beer (compact) */
  private *ally(): Gen {
    yield span(ALLY_START_DELAY);
    let compactNext = false;
    for (;;) {
      const calm = [...this.o.employees.values()].filter(
        (emp) => emp.state === "SEATED" && this.active.has(emp.id) && emp.pending.size === 0 && emp.act === "thinking",
      );
      if (!calm.length) {
        yield ALLY_RETRY_S;
        continue;
      }
      const emp = pick(calm);
      if (compactNext) {
        this.wantCompact.add(emp.id); // the session's own loop compacts at its next step, then idles for the whole trip
      } else {
        const count = spanInt(ALLY_SQUIRES);
        for (let k = 0; k < count; k++) {
          this.spawn(this.intern(emp.id, emp.cwd));
          yield span(ALLY_SQUIRE_GAP);
        }
      }
      compactNext = !compactNext;
      yield span(ALLY_GAP);
    }
  }

  /** sessions the showcase wants to see compact; their loop does it between two steps so nothing cuts the trip short */
  private wantCompact = new Set<string>();
  /** the (fake) context of each demo session, shared so a compaction from outside the session loop sticks */
  private used = new Map<string, number>();
  /** PreCompact now; the shrunken context is reported a few seconds later (the real server also clears it first) */
  private compact(id: string) {
    const project = this.active.get(id);
    if (!project) return;
    this.used.set(id, spanInt(CONTEXT_AFTER_COMPACT));
    this.emit({ session_id: id, cwd: "/Users/me/Practice/" + project, hook_event_name: "PreCompact", trigger: "auto" });
    this.o.setContext(id, null, null);
  }

  /** how often each class pairing has duelled in this demo (so cycles rotate through sword / magic / arrow matchups) */
  private pairSeen = new Map<string, number>();

  /** pick the least-seen class pairing among the seated demo adventurers */
  private pickPair(live: Employee[]): [Employee, Employee] {
    let best: [Employee, Employee] | null = null,
      bestN = Infinity;
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const dist =
          (this.pairSeen.get([live[i].look.cls, live[j].look.cls].sort().join("+")) ?? 0) + Math.random() * PAIR_JITTER;
        if (dist < bestN) {
          bestN = dist;
          best = [live[i], live[j]];
        }
      }
    }
    return best!;
  }

  /** demo-only: two adventurers touch the same fake file (overlap: glare + flag tug), then a failed edit (clash: duel); nothing is persisted */
  private *territory(): Gen {
    yield span(TERR_START_DELAY);
    for (;;) {
      const live = [...this.o.employees.values()].filter((emp) => emp.state === "SEATED" && this.active.has(emp.id));
      if (live.length >= 2) {
        const [first, second] = this.pickPair(live);
        const key = [first.look.cls, second.look.cls].sort().join("+");
        this.pairSeen.set(key, (this.pairSeen.get(key) ?? 0) + 1);
        const project = this.active.get(first.id) ?? "portfolio";
        const file = pick(FILES[project] ?? FILES.portfolio);
        const mk = (count: number) => Array.from({ length: count }, (_, i) => (i === 0 ? file : `src/fake${i}.ts`));
        const claims = [
          { sid: first.id, files: mk(spanInt(TERR_OVERLAP_FILES)) },
          { sid: second.id, files: mk(spanInt(TERR_CLASH_FILES)) },
        ];
        const msg = (level: "overlap" | "clash") => ({
          claims,
          conflicts: [{ file, sids: [first.id, second.id], level, since: Date.now() }],
        });
        this.o.setTerritory(msg("overlap"));
        const total = span(TERR_TOTAL);
        let spent = 0;
        if (Math.random() < TERR_CLASH_CHANCE) {
          const wait = span(TERR_CLASH_AFTER);
          yield wait;
          spent = wait;
          // b's edit fails on the file a holds: a keeps the land (and wins the duel)
          this.emit({
            session_id: second.id,
            cwd: second.cwd,
            hook_event_name: "PostToolUseFailure",
            tool_name: "Edit",
            tool_input: { file_path: second.cwd + "/" + file },
            error: "File has been modified since read",
          });
          this.o.setTerritory(msg("clash"));
        }
        yield Math.max(1, total - spent);
        this.o.setTerritory({ claims: [], conflicts: [] });
      }
      yield span(TERR_COOLDOWN);
    }
  }

  /** demo-only extra rows (loop / asked); permission rows are derived from whoever really has a hand up */
  private demoRows: AttentionMsgRow[] = [];
  private permSince = new Map<string, number>();
  private attnSig = "";
  private pushAttention(rows?: AttentionMsgRow[]) {
    if (rows) this.demoRows = rows;
    const out: AttentionMsgRow[] = [];
    const seen = new Set<string>();
    for (const emp of this.o.employees.values()) {
      if (emp.state !== "SEATED" || emp.act !== "handup" || !this.active.has(emp.id)) continue;
      seen.add(emp.id);
      let since = this.permSince.get(emp.id);
      if (since === undefined) {
        since = Date.now();
        this.permSince.set(emp.id, since);
      }
      out.push({
        key: `${emp.id}|permission|${since}`,
        sid: emp.id,
        kind: "permission",
        since,
      });
    }
    for (const id of [...this.permSince.keys()]) if (!seen.has(id)) this.permSince.delete(id);
    for (const row of this.demoRows) out.push(row);
    const sig = out.map((row) => `${row.key}|${row.count ?? ""}`).join("\n");
    if (sig === this.attnSig) return;
    this.attnSig = sig;
    this.o.setAttention(out);
  }
  /** keeps the demo queue in step with who is actually waiting on screen */
  private *attentionSync(): Gen {
    for (;;) {
      this.pushAttention();
      yield 1;
    }
  }

  /** demo-only: one adventurer loops on a failing command (berserk + queue row), later another leaves a question (bell + row) */
  private *attention(): Gen {
    yield span(ATTN_START_DELAY);
    for (;;) {
      const live = () =>
        [...this.o.employees.values()].filter((emp) => emp.state === "SEATED" && this.active.has(emp.id));
      let candidates = live();
      if (candidates.length) {
        const first = pick(candidates);
        const t0 = Date.now();
        const cmd = pick(["npm test", "npx tsc --noEmit", "pnpm build"]);
        for (let step = LOOP_FIRST; step <= LOOP_LAST; step++) {
          this.pushAttention([
            {
              key: `${first.id}|loop|demo`,
              sid: first.id,
              kind: "loop",
              since: t0,
              tool: "Bash",
              target: cmd,
              count: step,
              error: "Error: expected 3 but received 2",
            },
          ]);
          yield span(LOOP_STEP);
        }
        this.pushAttention([]);
      }
      yield span(ATTN_GAP);
      candidates = live();
      if (candidates.length) {
        const second = pick(candidates);
        this.pushAttention([
          {
            key: `${second.id}|asked|demo`,
            sid: second.id,
            kind: "asked",
            since: Date.now(),
            tail: m.demo_asked_tail(),
          },
        ]);
        yield span(ASKED_HOLD);
        this.pushAttention([]);
      }
      yield span(ATTN_COOLDOWN);
    }
  }

  private demoReceipts: ReceiptMsgRow[] = [];
  private receiptN = 0;
  private makeReceipt(sid: string, closedAt: number): ReceiptMsgRow {
    const roll = Math.random();
    const project = this.active.get(sid) ?? "portfolio";
    const base = {
      id: `demo-${++this.receiptN}`,
      sid,
      project,
      closedAt,
      amends: 0,
      squire: Math.random() < RECEIPT_SQUIRE_CHANCE ? 1 : 0,
    };
    if (roll < RECEIPT_NONE_CHANCE)
      return {
        ...base,
        files: 0,
        recovered: 0,
        commits: 0,
        tasks: 0,
        squire: 0,
        calls: Math.round(span(RECEIPT_NONE_CALLS)),
        verdict: "none",
      };
    const files = 1 + Math.floor(span(RECEIPT_FILES_EXTRA)),
      recovered = Math.random() < RECEIPT_RECOVERED_CHANCE ? 1 : 0,
      commits = Math.random() < RECEIPT_COMMIT_CHANCE ? 1 : 0,
      tasks = Math.floor(span(RECEIPT_TASKS));
    return {
      ...base,
      files,
      recovered,
      commits,
      tasks,
      calls: Math.round(span(RECEIPT_CALLS)),
      verdict: roll < RECEIPT_RED_CHANCE ? "red" : "done",
    };
  }
  /** demo-only: turns "finish" now and then and leave a receipt on the board (a couple are already there at start) */
  private *receipts(): Gen {
    yield span(RECEIPT_START_DELAY);
    const seed = [...this.active.keys()].slice(0, RECEIPT_SEED_COUNT);
    seed.forEach((id, i) =>
      this.demoReceipts.unshift(
        this.makeReceipt(id, Date.now() - (RECEIPT_SEED_BASE_MIN + i * RECEIPT_SEED_STEP_MIN) * MS_PER_MIN),
      ),
    );
    if (this.demoReceipts.length) this.o.setReceipts(this.demoReceipts);
    for (;;) {
      yield span(RECEIPT_INTERVAL);
      const live = [...this.o.employees.values()].filter((emp) => emp.state === "SEATED" && this.active.has(emp.id));
      if (!live.length) continue;
      this.demoReceipts = [this.makeReceipt(pick(live).id, Date.now()), ...this.demoReceipts].slice(0, RECEIPT_KEEP);
      this.o.setReceipts(this.demoReceipts);
    }
  }

  private spawn(gen: Gen) {
    this.runners.push({ gen, wake: this.o.clock });
  }

  addSession() {
    const used = new Set(this.active.values());
    const free = PROJECTS.filter((candidate) => !used.has(candidate));
    const project = free.length ? pick(free) : pick(PROJECTS);
    const id = hex8() + "-" + hex8().slice(0, HEX_SHORT_LEN);
    this.active.set(id, project);
    this.spawn(this.session(id, project));
  }

  update() {
    const clock = this.o.clock;
    for (const runner of [...this.runners]) {
      if (clock >= runner.wake) {
        const next = runner.gen.next();
        if (next.done) this.runners.splice(this.runners.indexOf(runner), 1);
        else runner.wake = clock + next.value;
      }
    }
    if (this.active.size === 0) this.addSession();
    if (clock >= this.nextAdd) {
      if (this.active.size < MAX_SESSIONS && Math.random() < ADD_SESSION_CHANCE) this.addSession();
      this.nextAdd = clock + span(NEXT_ADD);
    }
  }

  private emit(evt: HookEvt) {
    this.o.event(evt);
  }

  private *session(id: string, project: string): Gen {
    const cwd = "/Users/me/Practice/" + project;
    const base = { session_id: id, cwd };
    const send = (name: string, extra: Record<string, unknown> = {}) =>
      this.emit({ ...base, hook_event_name: name, ...extra });
    // fake context window: grows with work, occasionally "compacts" (drops back down)
    this.used.set(id, spanInt(CONTEXT_START));
    const limit = CONTEXT_LIMIT;
    const push = () => this.o.setContext(id, this.used.get(id) ?? 0, limit, false);
    push();
    yield 0;
    send("SessionStart", { source: "startup" });
    yield span(STARTUP_DELAY);
    const prompts = spanInt(PROMPT_COUNT);
    for (let promptIdx = 0; promptIdx < prompts; promptIdx++) {
      send("UserPromptSubmit", { prompt: "do the thing" });
      yield span(PROMPT_PAUSE);
      const steps = spanInt(STEP_COUNT);
      for (let stepIdx = 0; stepIdx < steps; stepIdx++) {
        this.used.set(id, (this.used.get(id) ?? 0) + spanInt(CONTEXT_GROWTH));
        if (
          this.wantCompact.delete(id) ||
          (this.used.get(id) ?? 0) > limit * CONTEXT_COMPACT_AT ||
          Math.random() < CONTEXT_COMPACT_CHANCE
        ) {
          this.compact(id);
          yield span(COMPACT_PAUSE);
        }
        push();
        const tool = pickTool();
        const tool_input = toolInput(tool, project, cwd);
        const tool_use_id = "toolu_" + hex8();
        send("PreToolUse", { tool_name: tool, tool_input, tool_use_id });
        if (tool === "Agent") this.spawn(this.intern(id, cwd));
        if (Math.random() < PERMISSION_CHANCE) {
          send("Notification", {
            notification_type: "permission_prompt",
            message: "Claude needs your permission to use " + tool,
          });
          yield span(PERMISSION_WAIT);
        }
        // occasionally a very long tool: the guild sees a boss
        if ((tool === "Bash" || tool === "Agent") && Math.random() < BOSS_CHANCE) yield span(BOSS_TOOL_TIME);
        else yield tool === "Bash" ? span(BASH_TIME) : span(TOOL_TIME);
        if ((tool === "Bash" && Math.random() < BASH_FAIL_CHANCE) || Math.random() < ANY_FAIL_CHANCE) {
          send("PostToolUseFailure", {
            tool_name: tool,
            tool_input,
            tool_use_id,
            error: "Command exited with non-zero status code 1",
            duration_ms: FAIL_DURATION_MS,
          });
        } else send("PostToolUse", { tool_name: tool, tool_input, tool_use_id, duration_ms: OK_DURATION_MS });
        yield span(STEP_PAUSE);
      }
      send("Stop");
      // now and then a long break: the adventurer rests by a campfire
      yield Math.random() < LONG_BREAK_CHANCE ? span(LONG_BREAK) : span(SHORT_BREAK);
    }
    send("SessionEnd", { reason: "prompt_input_exit" });
    this.active.delete(id);
    this.used.delete(id);
    this.wantCompact.delete(id);
  }

  private *intern(sid: string, cwd: string): Gen {
    const agent_id = "a" + hex8() + hex8().slice(0, HEX_SHORT_LEN);
    const agent_type = pick(["Explore", "general-purpose"]);
    const alive = () => this.active.has(sid);
    const send = (name: string, extra: Record<string, unknown> = {}) =>
      this.emit({ session_id: sid, cwd, hook_event_name: name, agent_id, agent_type, ...extra });
    yield INTERN_START_DELAY;
    if (!alive()) return;
    send("SubagentStart");
    const steps = spanInt(INTERN_STEPS);
    for (let k = 0; k < steps; k++) {
      yield span(INTERN_STEP_DELAY);
      if (!alive()) return;
      const tool = pick(["Read", "Grep"]);
      const tool_input = tool === "Read" ? { file_path: cwd + "/src/index.ts" } : { pattern: "TODO" };
      send("PreToolUse", { tool_name: tool, tool_input });
      yield span(INTERN_TOOL_TIME);
      if (!alive()) return;
      send("PostToolUse", { tool_name: tool, tool_input });
    }
    yield span(INTERN_END_DELAY);
    if (alive()) send("SubagentStop");
  }
}
