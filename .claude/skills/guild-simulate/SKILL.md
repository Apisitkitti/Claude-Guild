---
name: guild-simulate
description: Fire fake Claude Code hook events at the running Claude Guild dev server to see features live on the canvas (boss, loop bell, receipt card, duel, tavern break, squire, cheers, feast), then clean up. Use when the user says "จำลอง", "ลองเรียกบอส", "ดูบนจอ", "ลองดูของจริง", "ส่ง event ปลอม", "simulate", "fake event", "test live", "trigger the boss", "see it in the browser".
---

# guild-simulate

Drives `http://localhost:5050` (the `office-dev` server, already running) by POSTing fake hook payloads to `/events`. Every payload shape and threshold below was derived from `lib/store.ts`, `lib/attention.ts`, `lib/receipts.ts`, `lib/territory.ts` and `lib/office/engine.ts`. Only `bash`, `curl` and `node` are used.

## Use

```bash
.claude/skills/guild-simulate/scripts/sim.sh <scenario> [suffix]
```

- Session ids are `9401-<scenario>[-<suffix>][-a|-b|-c]`, cwd `/Users/demo/<name>` (fictional). Every id is recorded in `$TMPDIR/guild-sim/ids`.
- Use a new `suffix` to run a scenario again before its cooldown ends (duel: 60 s cooldown per pair; feast: 90 s global cooldown; both live on the page's sim clock).
- `OFFICE_URL` overrides the base URL.
- The page must already be open before the scenario starts: a fresh page load treats existing receipts as old news (no cheers/feast) and shows the first snapshot quietly.

| Scenario | What it sends | Expected result | Wait |
|---|---|---|---|
| `spawn` | SessionStart, UserPromptSubmit, Read, Grep | Adventurer walks in, sits, monster appears and gets hit | ~5 s |
| `boss` | Bash PreToolUse with no PostToolUse | Boss walks out of the dungeon gate, gate glows red, "BOSS!" banner | ~45 s (needs a tool in flight > `BOSS_AFTER` = 30 s while seated) |
| `boss-kill [suffix]` | PostToolUse for the pending boss tool | Boss defeated, coins, +25xp (a PostToolUseFailure instead makes it flee) | instant |
| `loop` | Same Bash `npm run lint` fails 3x (distinct tool_use_ids, same error after number normalisation) | Lookout Bell row "loop" (rule: same fingerprint + same normalized error, >= 3 in 5 min), hearts drop | instant |
| `receipt` | Edit, Write, failing then passing `npm test`, `git commit`, Stop | Receipt card "done": 2 files, 1 test recovered, 1 commit, project `dragon-shop`; Bell "done" row | instant |
| `duel` | A: Edit file (claim); B: PreToolUse Edit same file (overlap = glare), then B PostToolUseFailure Edit (clash) | Both 💢, then a ~9 s duel at the flag; B (the failer) loses | ~10 s script + 9 s fight |
| `compact` | PreCompact after the adventurer sits | Walks to the tavern, ~7 s beer, walks back (needs seated, no tool in flight) | ~15 s |
| `squire` | Task PreToolUse + SubagentStart (+ a subagent Read) | Squire steps out of the ally gate and walks to its master | ~8 s |
| `cheers` | A: PreCompact (sits at the feast table); B: edit + Stop (done receipt) | Mugs up and "Cheers!" pill (~2.6 s). Timing-sensitive: tune `CHEERS_DELAY` (default 6 s) | ~20 s |
| `feast` | 3 sessions; two done receipts within 60 s (cooldown 90 s) | Feast banner ~16 s: confetti, bard, plates | ~15 s |
| `status` | none | Health plus which sim/real session ids are on the server | instant |
| `cleanup` | PostToolUse for every pending tool (subagent ones keep their `agent_id`), SubagentStop for every squire, then SessionEnd for every recorded id (only `9401-` ids) | All simulated adventurers leave | ~1 s, adventurers walk out |

Not simulated: permission hand-up (send `PermissionRequest` or `Notification` with `notification_type: permission_prompt` by hand), other agents (`/events?source=codex|copilot|cursor`, `?event=Name` for payloads without a name).

## Verify in the browser pane

1. `preview_start` with name `office-dev` (reuses the running server) or navigate to `http://localhost:5050`.
2. Run the scenario, wait the time in the table, then `screenshot` or `read_page`/`get_page_text` (log lines, Lookout Bell, receipt ledger).
3. A hidden pane throttles `requestAnimationFrame`: the sim clock barely advances, so the boss never spawns and walks stall. Show the pane (or just wait longer) before judging "nothing happened".
4. Use `curl localhost:5050/health` (`sessions` count) or `sim.sh status` to check the server side independent of the canvas.

## Rules

- ALWAYS run `sim.sh cleanup` at the end, then `sim.sh status` (or `/health`) and confirm only real sessions remain. Real sessions are never prefixed `9401-`.
- Never kill or restart the dev server (no `pkill`/`kill`). Never use bun.
- Sessions that are not ended get swept after 10 min of silence; do not rely on that.
- Closed receipt cards (counts only, no names) stay in the ledger up to 2 h after `receipt`/`cheers`/`feast`; only a store rebuild clears them.
- `STORE_VERSION` (`lib/store.ts`): the store lives on `globalThis` and survives HMR. If you changed tracker code (attention/receipts/territory) and behaviour looks stale, bump `STORE_VERSION` instead of restarting the server (this also drops all state, including real sessions' trackers; SSE clients stay connected).
- Do not edit the repo to run a scenario; the skill only POSTs events.
- Building or changing the feature itself: see the `guild-feature` skill (this skill is its step 6).
