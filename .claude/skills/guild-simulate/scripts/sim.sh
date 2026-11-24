#!/usr/bin/env bash
# sim.sh <scenario> [session-suffix] — fire fake Claude Code hook events at the Claude Guild dev server.
# Payloads are derived from lib/store.ts, lib/attention.ts, lib/receipts.ts, lib/territory.ts, lib/office/engine.ts.
# Only bash + curl + node (node just to parse the snapshot in `status`). Never kills anything.
#
# Scenarios: spawn boss boss-kill loop receipt duel compact squire cheers feast lord void limit ais status cleanup help
# Session ids: 9401-<scenario>[-<suffix>][-a|-b|-c]   cwd: /Users/demo/<name> (fictional)
# Created ids are recorded in $TMPDIR/guild-sim/ids so `cleanup` removes every one of them.
set -u

URL="${OFFICE_URL:-http://localhost:5050}"
PREFIX="9401"
STATE_DIR="${TMPDIR:-/tmp}/guild-sim"
IDS_FILE="$STATE_DIR/ids"          # "<sid> <cwd> [source]" per line (source = codex|copilot|cursor for adapter sessions)
PENDING_FILE="$STATE_DIR/pending"  # "<sid> <tool_use_id> <tool_name> [agent json fragment]" per line (PreToolUse without a matching Post)
AGENTS_FILE="$STATE_DIR/agents"    # "<sid> <agent_id> <agent_type>" per line (SubagentStart without a SubagentStop)
mkdir -p "$STATE_DIR"
touch "$IDS_FILE" "$PENDING_FILE" "$AGENTS_FILE"

SCN="${1:-help}"
SFX="${2:-}"
TID=""
SEQ=0

die() { echo "sim.sh: $*" >&2; exit 1; }

health() { curl -sf -m 3 "$URL/health"; }

need_server() {
  health >/dev/null || die "no server at $URL (start it with preview_start name=office-dev; do NOT kill/restart it)"
}

# sid <role> -> 9401-<scenario>[-<suffix>][-<role>]
sid() { echo "$PREFIX-$SCN${SFX:+-$SFX}${1:+-$1}"; }

cwd_of() { awk -v s="$1" '$1==s {print $2; exit}' "$IDS_FILE"; }
src_of() { awk -v s="$1" '$1==s {print $3; exit}' "$IDS_FILE"; }

# Cursor names its events in camelCase; the other adapters accept the Claude names as they are.
cursor_event() {
  case "$1" in
    SessionStart) echo sessionStart ;; SessionEnd) echo sessionEnd ;; UserPromptSubmit) echo beforeSubmitPrompt ;;
    PreToolUse) echo preToolUse ;; PostToolUse) echo postToolUse ;; Stop) echo stop ;; *) echo "$1" ;;
  esac
}

# send <EventName> <sid> [extra json fragment, e.g. "tool_name":"Bash"]
send() {
  local name="$1" id="$2" extra="${3:-}" cwd code src query=""
  cwd="$(cwd_of "$id")"; src="$(src_of "$id")"
  if [ -n "$src" ]; then query="?source=$src"; [ "$src" = cursor ] && name="$(cursor_event "$name")"; fi
  local body="{\"session_id\":\"$id\",\"hook_event_name\":\"$name\",\"cwd\":\"${cwd:-/Users/demo/sim}\"${extra:+,$extra}}"
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data-binary "$body" "$URL/events$query")"
  [ "$code" = "204" ] || echo "warn: $name -> HTTP $code" >&2
}

# start <sid> <project> [model] [source]: register for cleanup, SessionStart (also lifts the 60 s tombstone of a recently ended id)
# source = codex|copilot|cursor sends through that adapter (?source=); the server stores the id with a -cx/-cp/-cu suffix.
start() {
  local id="$1" project="$2" model="${3:-claude-sim}" source="${4:-}"
  grep -q "^$id " "$IDS_FILE" || echo "$id /Users/demo/$project${source:+ $source}" >> "$IDS_FILE"
  send SessionStart "$id" "\"source\":\"startup\",\"model\":\"$model\""
}

prompt() { send UserPromptSubmit "$1" '"prompt":"simulated task"'; }

# pre <sid> <tool> <tool_input json> [agent extra]  -> sets $TID
pre() {
  SEQ=$((SEQ + 1)); TID="toolu_sim_$(date +%s)_$$_$SEQ"
  echo "$1 $TID $2${4:+ $4}" >> "$PENDING_FILE"
  send PreToolUse "$1" "\"tool_name\":\"$2\",\"tool_input\":$3,\"tool_use_id\":\"$TID\"${4:+,$4}"
}
unpend() { grep -v " $1 " "$PENDING_FILE" > "$PENDING_FILE.tmp"; mv "$PENDING_FILE.tmp" "$PENDING_FILE"; }
# post <sid> <tool> <tool_input json> <tool_use_id> [agent extra]
post() {
  unpend "$4"
  send PostToolUse "$1" "\"tool_name\":\"$2\",\"tool_input\":$3,\"tool_use_id\":\"$4\",\"tool_response\":{}${5:+,$5}"
}
# fail <sid> <tool> <tool_input json> <tool_use_id> <error text, no quotes> [agent extra]
fail() {
  unpend "$4"
  send PostToolUseFailure "$1" "\"tool_name\":\"$2\",\"tool_input\":$3,\"tool_use_id\":\"$4\",\"error\":\"$5\",\"is_interrupt\":false${6:+,$6}"
}
# tool <sid> <tool> <input> : pre + post
tool() { pre "$1" "$2" "$3"; post "$1" "$2" "$3" "$TID"; }
stop() { send Stop "$1" "\"last_assistant_message\":\"${2:-All done.}\""; }

note() { echo "$*"; }

case "$SCN" in
spawn)
  need_server
  S="$(sid)"; start "$S" spawn-demo; prompt "$S"
  tool "$S" Read '{"file_path":"/Users/demo/spawn-demo/README.md"}'
  tool "$S" Grep '{"pattern":"TODO"}'
  note "spawned $S. Wait ~5s: adventurer walks in and sits, a monster appears and takes hits."
  ;;

boss)
  # engine.ts: BOSS_AFTER = 30 sim seconds with a tool in flight while SEATED and the monster present (speed 1 = real time).
  need_server
  S="$(sid)"; start "$S" boss-demo; prompt "$S"
  pre "$S" Bash '{"command":"npm run build:everything"}'
  note "spawned $S with a Bash tool that never finishes. Wait ~45s (walk-in + 30s): a boss walks out of the dungeon gate."
  note "then: sim.sh boss-kill ${SFX:-} (tool finishes -> boss defeated, loot) or run cleanup."
  ;;

boss-kill)
  need_server
  SCN=boss
  S="$(sid)"; grep -q "^$S " "$PENDING_FILE" || die "no pending tool for $S (run boss first, same suffix)"
  while read -r id tid tname _agent; do
    [ "$id" = "$S" ] && post "$S" "$tname" '{"command":"npm run build:everything"}' "$tid"
  done < <(cat "$PENDING_FILE")
  note "PostToolUse sent for $S: the boss is defeated (coins, +25xp)."
  ;;

loop)
  # attention.ts: PostToolUseFailure, same tool+input fingerprint, same normalized error, >=3 within 5 min -> kind "loop".
  # (numbers in the error are normalized, tool_use_ids must differ, a success of the same attempt resets it.)
  need_server
  S="$(sid)"; start "$S" loop-demo; prompt "$S"
  for n in 1 2 3; do
    pre "$S" Bash '{"command":"npm run lint"}'
    fail "$S" Bash '{"command":"npm run lint"}' "$TID" "Error: lint failed with $n problems in src/app.ts"
    sleep 0.4
  done
  note "spawned $S with 3 identical failures. Lookout Bell shows a 'loop' row immediately (and the adventurer loses hearts)."
  ;;

receipt)
  # receipts.ts: one receipt per turn (UserPromptSubmit -> Stop). files + recovered test + commit => verdict "done".
  need_server
  S="$(sid)"; start "$S" dragon-shop; prompt "$S"
  tool "$S" Edit '{"file_path":"/Users/demo/dragon-shop/src/auth.ts","old_string":"a","new_string":"b"}'
  tool "$S" Write '{"file_path":"/Users/demo/dragon-shop/src/auth.test.ts","content":"x"}'
  pre "$S" Bash '{"command":"npm test"}'
  fail "$S" Bash '{"command":"npm test"}' "$TID" "Exit code 1"
  tool "$S" Edit '{"file_path":"/Users/demo/dragon-shop/src/auth.ts","old_string":"b","new_string":"c"}'
  tool "$S" Bash '{"command":"npm test"}'
  tool "$S" Bash '{"command":"git commit -m \"fix auth\""}'
  sleep 0.5
  stop "$S" "Fixed the auth bug and committed."
  note "turn closed for $S: receipt 2 files, 1 test recovered, 1 commit (verdict done). Open the Receipt Ledger; the page must already be open (a fresh page load does not replay old receipts as news)."
  ;;

duel)
  # territory.ts: two sessions hold the same file (PreToolUse Edit) = overlap (glare); then one edit FAILS = clash -> duel.
  # engine.ts: both must be SEATED (hence the wait); 60 sim-second cooldown per pair -> use a new suffix to repeat quickly.
  need_server
  A="$(sid a)"; B="$(sid b)"
  start "$A" shared-repo; start "$B" shared-repo
  prompt "$A"; prompt "$B"
  F='{"file_path":"/Users/demo/shared-repo/src/shared.ts","old_string":"a","new_string":"b"}'
  note "waiting 6s for both adventurers to sit down..."; sleep 6
  tool "$A" Edit "$F"
  pre "$B" Edit "$F"
  sleep 2
  fail "$B" Edit "$F" "$TID" "File has been modified since read"
  note "clash sent. $B (the failer) loses. Duel plays ~9s at the flag between their desks; the clash flag stays up to ~10 min."
  ;;

compact)
  # engine.ts onCompact: seated, nothing in flight -> walks to the tavern, 7s beer, walks back. Any later event cuts it short.
  need_server
  S="$(sid)"; start "$S" compact-demo; prompt "$S"
  note "waiting 5s for the adventurer to sit..."; sleep 5
  send PreCompact "$S" '"trigger":"auto"'
  note "PreCompact sent for $S: walks to the tavern for a beer (~7s at the table), then back. Do not send more events for it meanwhile."
  ;;

squire)
  # engine.ts: SubagentStart creates the squire (agent_id) at the ally gate, walks out (staggered), then follows its master.
  need_server
  S="$(sid)"; start "$S" squire-demo; prompt "$S"
  note "waiting 5s for the adventurer to sit..."; sleep 5
  pre "$S" Task '{"subagent_type":"Explore","description":"look around"}'
  send SubagentStart "$S" '"agent_id":"sim-squire-1","agent_type":"Explore"'
  echo "$S sim-squire-1 Explore" >> "$AGENTS_FILE"
  sleep 1
  pre "$S" Read '{"file_path":"/Users/demo/squire-demo/README.md"}' '"agent_id":"sim-squire-1","agent_type":"Explore"'
  note "squire sim-squire-1 spawned for $S: walks out of the ally gate to its master. Cleanup ends it with the session."
  ;;

cheers)
  # engine.ts cheers(): a 'done' receipt (or commit) arrives while someone sits at the feast table (tavern/coffee break).
  need_server
  A="$(sid a)"; B="$(sid b)"
  start "$A" tavern-regular; start "$B" quest-hero
  prompt "$A"; prompt "$B"
  note "waiting 5s for both to sit..."; sleep 5
  send PreCompact "$A" '"trigger":"manual"'
  note "A is walking to the tavern; waiting ${CHEERS_DELAY:-6}s for it to sit at the table..."; sleep "${CHEERS_DELAY:-6}"
  tool "$B" Edit '{"file_path":"/Users/demo/quest-hero/src/quest.ts","old_string":"a","new_string":"b"}'
  stop "$B" "Quest complete."
  note "B closed a done receipt while A is at the table: mugs up + 'Cheers!' pill (~2.6s). If A already left the table, rerun with CHEERS_DELAY=4 or 8."
  ;;

lord)
  # engine.ts raid rules: RAID_READY_CALLS (40) tool calls send a battle-spot adventurer into the dungeon; it descends B1 -> B3
  # (RAID_FLOOR_KILLS 3 kills per floor) and fights the shared Dungeon Lord (LORD_HP 40). One session is enough.
  # LORD_CALLS = total tool calls (default 130), LORD_PACE = seconds between calls after the walk-in (default 0.5).
  need_server
  A="$(sid a)"
  start "$A" lord-raider
  prompt "$A"
  note "waiting 4s to sit..."; sleep 4
  n=0
  while [ "$n" -lt 40 ]; do
    tool "$A" Read '{"file_path":"/Users/demo/lord-raider/src/a.ts"}'; n=$((n + 1))
  done
  note "40 calls sent: the adventurer leaves its battle spot for the dungeon gate; waiting 14s for the walk..."; sleep 14
  total="${LORD_CALLS:-130}"
  while [ "$n" -lt "$total" ]; do
    tool "$A" Bash '{"command":"npm test"}'; n=$((n + 1))
    sleep "${LORD_PACE:-0.5}"
  done
  note "sent $n calls. Watch: B1 -> B3, banner 'Raid on the Dungeon Lord', the live inset on the guild scene, the Lord rising from the throne, then 'Dungeon Lord has fallen' and the walk home. Stop sending events and it walks home after ~75 s."
  ;;

void)
  # The secret final boss. Same walk-in as `lord`, but the session keeps hitting after the Dungeon Lord falls: the Lord's
  # corpse shatters, the wipe drops the raider into the Void Sanctum (floor 4), the Veiled One (3x the Lord's hp, 3 phases:
  # <60% phase 2, <25% TRUE FORM) fights back, and falls to a victory banner + gold + a level.
  # Needs enough calls to beat BOTH bosses: 40 Reads (raid-ready), ~50 to descend, ~30 for the Lord, ~180 hp for the
  # Veiled One (less as the raider levels up; calls during the invulnerable roar / TRUE FORM do nothing).
  # VOID_CALLS = total tool calls (default 420), VOID_PACE = seconds between calls after the walk-in (default 0.4).
  need_server
  A="$(sid a)"
  start "$A" void-raider
  prompt "$A"
  note "waiting 4s to sit..."; sleep 4
  n=0
  while [ "$n" -lt 40 ]; do
    tool "$A" Read '{"file_path":"/Users/demo/void-raider/src/a.ts"}'; n=$((n + 1))
  done
  note "40 calls sent: the adventurer leaves its battle spot for the dungeon gate; waiting 14s for the walk..."; sleep 14
  total="${VOID_CALLS:-420}"
  while [ "$n" -lt "$total" ]; do
    tool "$A" Bash '{"command":"npm test"}'; n=$((n + 1))
    sleep "${VOID_PACE:-0.4}"
  done
  note "sent $n calls. Watch: B1 -> B3, the Dungeon Lord falls, 'FOOLS... HE WAS ONLY MY PUPPET.', the pixel wipe to floor 4 (the camera follows if you watch B3), 'The Veiled One' reveal + hp bar, beam / eyes / blink, phase 2 at 60% (collapse), TRUE FORM at 25% (screen shake, eclipse), the death, the victory banner, then the raider walks home. If it is still fighting, rerun with a bigger VOID_CALLS. Stop sending events and the raider walks home after ~75 s (the boss fades out laughing)."
  ;;

limit)
  # store.ts: StopFailure with error rate_limit sets session.rateLimit (text parsed from "resets <text>"), broadcasts
  # session_meta and adds a "limit" attention row. The next UserPromptSubmit / PreToolUse / Stop clears it.
  need_server
  S="$(sid)"; start "$S" limit-demo; prompt "$S"
  tool "$S" Read '{"file_path":"/Users/demo/limit-demo/README.md"}'
  tool "$S" Grep '{"pattern":"TODO"}'
  tool "$S" Edit '{"file_path":"/Users/demo/limit-demo/src/a.ts","old_string":"a","new_string":"b"}'
  sleep 0.5
  send StopFailure "$S" '"error":"rate_limit","error_details":"429","last_assistant_message":"You'"'"'ve hit your limit · resets 3pm (Asia/Bangkok)"'
  note "StopFailure rate_limit sent for $S. Watch: the adventurer shows the usage-limit state, the Lookout Bell gets a 'limit' row (reset 3pm (Asia/Bangkok))."
  note "it clears on the next UserPromptSubmit / PreToolUse / Stop (or cleanup), and by itself once the reset time (next 3pm, server local time) passes."
  ;;

ais)
  # store.ts Session.source / Session.model: agent_source (adapters) + model (SessionStart payload, or the transcript).
  need_server
  A="$(sid a)"; B="$(sid b)"; C="$(sid c)"; D="$(sid d)"
  start "$A" ais-claude claude-opus-5-5
  start "$B" ais-codex gpt-5.1-codex codex
  start "$C" ais-copilot gpt-4.1 copilot
  start "$D" ais-cursor sonnet-4.5 cursor
  for id in "$A" "$B" "$C" "$D"; do prompt "$id"; tool "$id" Read '{"file_path":"/Users/demo/ais/README.md"}'; done
  note "spawned 4 sessions: claude (claude-opus-5-5), codex (gpt-5.1-codex), copilot (gpt-4.1), cursor (sonnet-4.5)."
  note "Watch: each adventurer shows its AI tool + model. Server ids: $A, $B-cx, $C-cp, $D-cu."
  ;;

feast)
  # engine.ts noteDone(): 'done' receipts from >=2 different sessions within 60s (cooldown 90s) -> feast banner, confetti, bard.
  need_server
  A="$(sid a)"; B="$(sid b)"; C="$(sid c)"
  start "$A" feast-a; start "$B" feast-b; start "$C" feast-c
  prompt "$A"; prompt "$B"; prompt "$C"
  note "waiting 5s for everyone to sit..."; sleep 5
  send PreCompact "$C" '"trigger":"manual"'
  tool "$A" Edit '{"file_path":"/Users/demo/feast-a/src/a.ts","old_string":"a","new_string":"b"}'
  tool "$B" Edit '{"file_path":"/Users/demo/feast-b/src/b.ts","old_string":"a","new_string":"b"}'
  stop "$A" "Feature A shipped."
  sleep 1
  stop "$B" "Feature B shipped."
  note "two done receipts inside 60s: feast banner for ~16s (confetti, bard, plates). 90s cooldown before the next feast; page must already be open."
  ;;

status)
  health || die "no server at $URL"
  echo
  echo "recorded sim sessions:"; cat "$IDS_FILE"
  echo "sessions on the server with prefix $PREFIX- :"
  curl -sN -m 2 "$URL/events/stream" 2>/dev/null | node -e '
    let buf = ""; process.stdin.on("data", d => buf += d);
    process.stdin.on("end", () => {
      const m = /event: snapshot\ndata: (.*)\n/.exec(buf);
      if (!m) { console.log("(could not read snapshot)"); return; }
      const ids = JSON.parse(m[1]).sessions.map(s => s.session_id);
      console.log("  sim: " + (ids.filter(i => i.startsWith("'"$PREFIX"'-")).join(", ") || "none"));
      console.log("  real: " + (ids.filter(i => !i.startsWith("'"$PREFIX"'-")).map(i => i.slice(0, 8)).join(", ") || "none"));
    });'
  ;;

cleanup)
  need_server
  n=0
  # 1) finish every tool still in flight (a pending boss tool = boss defeated; subagent tools keep their agent_id),
  # 2) stop every squire, 3) end every session we created. Only ids with our prefix are ever touched.
  while read -r id tid tname agent; do
    case "$id" in "$PREFIX"-*) ;; *) continue ;; esac
    send PostToolUse "$id" "\"tool_name\":\"$tname\",\"tool_input\":{},\"tool_use_id\":\"$tid\",\"tool_response\":{}${agent:+,$agent}"
  done < <(cat "$PENDING_FILE")
  while read -r id aid atype; do
    case "$id" in "$PREFIX"-*) ;; *) continue ;; esac
    send SubagentStop "$id" "\"agent_id\":\"$aid\",\"agent_type\":\"$atype\""
  done < <(cat "$AGENTS_FILE")
  sleep 0.5
  while read -r id _cwd; do
    case "$id" in "$PREFIX"-*) ;; *) continue ;; esac
    send SessionEnd "$id" '"reason":"other"'
    n=$((n + 1))
  done < <(cat "$IDS_FILE")
  : > "$IDS_FILE"; : > "$PENDING_FILE"; : > "$AGENTS_FILE"
  note "ended $n simulated session(s)."
  printf 'health: '; health; echo
  note "check: sessions should equal the number of REAL sessions only (run 'status' to list ids)."
  note "note: closed receipt cards from 'receipt'/'cheers'/'feast' stay in the ledger up to 2h (by design); they hold counts only."
  ;;

help|*)
  sed -n '2,8p' "$0"
  ;;
esac
