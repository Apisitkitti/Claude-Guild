---
name: guild-feature
description: End-to-end workflow for building or changing any feature in the Claude Guild repo (Next.js 16 App Router, Paraglide i18n, vitest). Use when the user says "ทำ feature", "เพิ่ม feature", "build feature", "implement", "แก้ใน guild", or asks for any code change in this repo.
---

# guild-feature

Workflow for any change in this repo. Reply to the user in Thai. Node/npm only, never bun.

## 0. Hard rules
- NEVER kill processes or the dev server unless the user explicitly says restart.
- Do not run `next build` while the dev server runs (it clobbers `.next`).
- Privacy: never put the user's email, real paths or work project names in code, demos, tests or external requests. Demo data uses fictional names.
- Commit only when asked; push to origin main only when asked.

## 1. Plan (Fable only, never spawned)
- [ ] Read `AGENTS.md`: this Next.js has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` BEFORE using any Next API.
- [ ] Read the files you will touch, plus `docs/DESIGN.md` (design tokens) for UI work. Use Haiku agents for pure research (file lookups, doc reading).
- [ ] Split the work into slices with DISJOINT file ownership (e.g. server `lib/` + `app/api`, UI `components/` + `hooks/`, sprites/render `lib/office/`, `messages/*.json` + tests).
- [ ] For each slice write: goal, files it owns, a "DO NOT touch" list (every other slice's files plus shared files like `lib/store.ts`, `messages/*.json` unless owned), and the interfaces/types shared with other slices (define them up front).

## 2. Build (Sonnet agents, parallel)
- [ ] Launch ALL Sonnet agents in ONE message so they run concurrently. Each prompt is self-contained: the rules in section 3, its owned files, its "don't touch" list, and "do not commit, do not kill processes, do not run `next build`".
- [ ] Each agent adds/updates vitest tests in `tests/` for its slice (tests are exempt from no-magic-numbers).

## 3. Code rules (give these to every builder)
- Component/hook body order, enforced by `local/component-order` (`eslint-rules/component-order.mjs`): state hooks, then variables (incl. `useMemo`), then functions (incl. `useCallback`), then `useEffect`, then pre-return conditions (`if (...) return`), then the main return.
  Example of a correctly ordered component (the same order applies inside custom hooks):
  ```tsx
  import { useCallback, useEffect, useMemo, useState } from "react";

  // (external packages would go here, in their own group)

  import { m } from "@/paraglide/messages";

  import { useRoster } from "./hooks/useRoster";

  const POLL_MS = 5_000; // no magic numbers: name constants at file top

  interface QuestBoardProps {
    guildName: string;
  }

  export const QuestBoard = ({ guildName }: QuestBoardProps) => {
    // 1. state: useState / useReducer / useRef / useContext / custom hooks (useXxx)
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const roster = useRoster();

    // 2. variables: plain consts and useMemo
    const openQuests = useMemo(() => roster.quests.filter((quest) => !quest.done), [roster.quests]);
    const hasSelection = selectedQuestId !== null;

    // 3. functions: arrow functions and useCallback (never `function` declarations)
    const selectQuest = useCallback((questId: string) => setSelectedQuestId(questId), []);
    const clearSelection = () => setSelectedQuestId(null);

    // 4. effects: useEffect / useLayoutEffect / useImperativeHandle
    useEffect(() => {
      const timer = setInterval(roster.refresh, POLL_MS);
      return () => clearInterval(timer);
    }, [roster.refresh]);

    // 5. pre-return conditions: early returns
    if (!roster.loaded) return null;
    if (openQuests.length === 0) return <p>{m.board_empty()}</p>;

    // 6. main return
    return (
      <section className={hasSelection ? "board board--active" : "board"} onDoubleClick={clearSelection}>
        <h2>{guildName}</h2>
        {openQuests.map((quest) => (
          <button key={quest.id} onClick={() => selectQuest(quest.id)}>
            {quest.title}
          </button>
        ))}
      </section>
    );
  };
  ```
  Wrong: a `useEffect` above a `useMemo`, a `useState` after a function, an early `return` above a hook (also breaks the rules of hooks). Run `npx eslint <file>` to check.
- Imports (`import/order`): react/next (and node builtins) first, then external packages, then `@/` imports, then relative imports; blank line between each group; alphabetized.
- No magic numbers (`@typescript-eslint/no-magic-numbers`, allowed: -1, 0, 1, 2): name them as constants (`lib/constants.ts` or top of file). Exempt only drawing files listed in `eslint.config.mjs`: `lib/office/sprites.ts`, `npcSprites.ts`, `bossSprites.ts`, `monsterSprites.ts`, `render.ts`, `tests/**`.
- Arrow functions only (`func-style: expression`, no function expressions). Descriptive names: `id-length` min 2 (exceptions `i j k x y _`).
- Prettier, width 120 (`npm run format`).
- Server trackers/state live on `globalThis` keyed by `STORE_VERSION` in `lib/store.ts`. BUMP `STORE_VERSION` whenever tracker code or the `Store` shape changes, or dev HMR keeps the stale instance.
- UI text: add keys to BOTH `messages/en.json` and `messages/th.json`; Thai wording follows the `guild-i18n` skill. After editing `messages/*.json` run `npm run paraglide` (the running dev server may be an old command without watch; `npm run dev` normally runs `paraglide:watch` via `scripts/dev.mjs`).
- Sprites/pixel art: follow the `pixel-sprite` skill.
- Visual rules: characters are never translucent or tinted; nothing translucent is drawn over characters; all text must be readable (contrast, size).

## 4. Review (Opus, once)
- [ ] After all builders finish, run ONE Opus review agent over the combined diff (`git diff` + new files). Brief it with the rules in sections 0 and 3 and ask for concrete findings (correctness, rule violations, stale `STORE_VERSION`, missing i18n keys, privacy leaks, translucent-over-character drawing).
- [ ] Fix pass: send findings to the relevant Sonnet agent(s) (or one Sonnet if small). Do not re-review unless the fixes were large.

## 5. Gate (all must pass before commit)
- [ ] `npm run lint` (runs paraglide first)
- [ ] `npm run typecheck`
- [ ] `npm test`
- If one fails, fix and rerun all three. Never skip or silence rules to pass.

## 6. Verify live
- [ ] Use the `guild-simulate` skill (`.claude/skills/guild-simulate`) to feed fake sessions/events, plus the built-in browser pane.
- [ ] Dev server: `.claude/launch.json` config `office-dev` (port 5050). Reuse it if running; start via `preview_start` only if not. Never kill/restart it unprompted.
- [ ] Check desktop layout, Thai and English, and the visual rules above (screenshot).

## 7. Commit (only when the user asks)
- Conventional message: `feat: ...` or `fix: ...` (see `git log --oneline`: e.g. `feat: meaner monsters and real bosses`).
- Message must end with the line:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Check `git status` first: no secrets, no real names/paths, no stray files.
- Push to origin main only when the user asks.

## Model roles
Fable plans only (never spawned) · Opus reviews · Sonnet develops (several in parallel) · Haiku researches.
