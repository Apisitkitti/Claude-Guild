# Claude Office — PLAN

> แผนสำหรับส่งต่อให้ Claude Code ลงมือทำ: เปิด Claude Code ในโฟลเดอร์ `~/Practice/claude-office` แล้วบอกว่า
> "อ่าน PLAN.md แล้วทำตาม Phase 1 → 3"

## เป้าหมาย
ออฟฟิศ pixel art ที่ Claude Code แต่ละ session คือพนักงานหนึ่งคน เปิด session ก็เดินเข้าออฟฟิศมานั่งโต๊ะ
ทำงานก็มีท่าทางตาม tool ที่ใช้ (พิมพ์ อ่าน รัน bash จนเหงื่อแตก ยกมือขอ permission) ปิด session ก็เดินออก

## Phases
> **อัปเดต 2026-11-15:** ย้ายมา Next.js 16 + TypeScript (npm, Node 22) เลยตั้งแต่ตอนนี้ แทน zero-dep server + single HTML. Server = route handlers (`app/events`, `app/events/stream`, `app/health`) + `lib/store.ts`; office = `lib/office/*` + `components/*`. ข้อกำหนดเรื่อง file:// / single file / zero npm deps ด้านล่างใช้ไม่ได้แล้ว Demo เปิดด้วย `?demo` หรือ fallback อัตโนมัติ

1. **Server**: `server/index.js` + `package.json` + `hooks/settings.example.json` ทดสอบด้วย curl
2. **Office (Demo mode)**: `web/index.html` วาด office + ตัวละคร + simulator ให้เปิดไฟล์ตรงๆ ก็เห็นพนักงานเดินไปมาได้
3. **Live mode**: ต่อ SSE จาก server ติดตั้ง hooks จริง แล้วทดสอบกับ Claude Code session จริง
4. (อนาคต) ย้ายไป NestJS + Next.js, ใช้ sprite จาก asset pack, เพิ่มสถิติ token/cost ผ่าน OpenTelemetry

## Research notes (จาก code.claude.com/docs/en/hooks.md, 2026-11-15)
- Hook มีหลาย event มาก ที่ใช้ในโปรเจกต์นี้: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop, SubagentStart, SubagentStop, SessionEnd
  (มีตัวอื่นที่น่าเอามาเล่นต่อ เช่น PermissionRequest, PostToolUseFailure, PreCompact)
- stdin JSON ทุก event มี `session_id`, `cwd`, `hook_event_name`, `transcript_path`, `permission_mode`;
  ถ้า event มาจากใน subagent จะมี `agent_id`, `agent_type`
- Tool events มี `tool_name`, `tool_input`, `tool_use_id` (PostToolUse มี `tool_response`, `duration_ms`)
- Notification มี `message`, `notification_type` (เช่น `permission_prompt`, `idle_prompt`)
- Hook handler ใส่ `"async": true` ได้ → ไม่ block Claude ถ้า server ปิดอยู่
- Settings reload live ไม่ต้อง restart Claude Code
- ✅ verified (Haiku, 2026-11-15): SessionEnd `reason` (clear|resume|logout|prompt_input_exit|other); Stop `stop_hook_active`, `last_assistant_message`;
  SubagentStart/Stop `agent_id`, `agent_type` (+ Stop: `agent_transcript_path`); PreCompact `trigger` (manual|auto)
- ⚠️ PostToolUse ยิงเฉพาะ tool สำเร็จ — fail ไปที่ `PostToolUseFailure` (`error`, `duration_ms`) ต้อง hook ด้วย ไม่งั้นพนักงานค้างท่า
- PermissionRequest (`tool_name`, `tool_input`) → ยกมือ; notification_type มี agent_needs_input, elicitation_dialog ด้วย
- tool_name ปัจจุบัน: subagent = `Agent` (เดิม Task), todo = `TaskCreate`/`TaskUpdate`, มี `Workflow`, `AskUserQuestion`, `Monitor`

---


Pixel-art office where each Claude Code session = one office employee. Zero npm dependencies. Node 22+, macOS target.

## Files (create in this folder: ~/Practice/claude-office/)
- package.json: {"name":"claude-office","private":true,"type":"commonjs","scripts":{"start":"node server/index.js","dev":"node --watch server/index.js"}} — no dependencies.
- server/index.js (~150 lines, node:http/fs/path only)
- web/index.html (ONE self-contained file, inline CSS+JS, zero external assets/fonts/CDNs)
- hooks/settings.example.json
- README.md (Thai + English OK; Thai preferred for prose, code in English)
- .gitignore (node_modules, .DS_Store)

## Server
- PORT = env PORT || 3001. CORS * on all routes; OPTIONS → 204.
- POST /events: read body (cap 1MB), JSON.parse, 400 on bad JSON. Add receivedAt=Date.now(). Push to events (keep last 200). Update sessions. Broadcast. 204.
- sessions: Map<session_id,{session_id,cwd,firstSeen,lastSeen,lastEvent,interns:Set<agent_id>}>. Delete on SessionEnd. Sweep every 30s, drop lastSeen > 10 min. interns: add agent_id on SubagentStart, delete on SubagentStop. Serialize interns as array.
- GET /events/stream: SSE headers (text/event-stream, no-cache, keep-alive). First send `event: snapshot` data {sessions:[...], events:[last 50]}. Then each event as default message `data: JSON\n\n`. `: ping` every 15s. Remove client on close.
- GET / → web/index.html read per request. GET /health → {ok, sessions, clients, uptime}. Else 404.
- Log one line per event to console: time, short session id, event, tool.

## Hooks (hooks/settings.example.json)
Events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop, SubagentStart, SubagentStop, SessionEnd.
Each handler: { "type":"command", "async": true, "timeout": 3, "command": "curl -s --max-time 1 -X POST -H 'Content-Type: application/json' -d @- http://localhost:3001/events >/dev/null 2>&1 || true" }.
Tool events (PreToolUse, PostToolUse) use "matcher": "*"; others omit matcher.
Hook stdin fields (verified): common: session_id, cwd, hook_event_name, permission_mode, transcript_path; agent_id + agent_type present when event comes from inside a subagent. Tool events: tool_name, tool_input, tool_use_id. SessionStart: source. Notification: message, notification_type (permission_prompt, idle_prompt, ...). SubagentStart/SubagentStop: agent_id, agent_type.

README: run (`npm start`, open http://localhost:3001), merge hooks into ~/.claude/settings.json (all projects) or <project>/.claude/settings.json, note settings reload live, test curl:
curl -X POST localhost:3001/events -H 'Content-Type: application/json' -d '{"session_id":"test1234","hook_event_name":"SessionStart","cwd":"/tmp/demo"}'
plus a PreToolUse Bash example and SessionEnd example. Mention demo mode works by just opening web/index.html.

## Canvas & layout (384x216 logical, y down)
- CSS integer scale = max(1, floor(min(availW/384, availH/216))), image-rendering: pixelated, imageSmoothingEnabled=false. Side panel HTML 300px right of canvas (stack below on narrow screens).
- Wall y 0–56 (cream #f4e3c1, 2px baseboard at y54). Floor y56–216, 16x16 checker in two wood tones.
- Windows 48x28 at y12, x=56,168,280. Door rect (8,18,22,38); spawn/exit (19,62).
- Coffee counter rect (336,38,40,18), machine (350,22,14,16), stand point (356,72).
- Plants (36,40),(236,40),(372,200) 10x16.
- Desks 44x16, columns x=40,124,208,292; rows y=96 (A) and y=160 (B) → 8 desks idx 0–7 (row A first).
- Per desk (dx,dy): monitor 14x11 at (dx+3,dy−9); seat foot anchor (dx+30,dy+4) — draw employee before desk so desk hides legs; intern stools (dx+50,dy+6),(dx+58,dy+6) max 2 drawn, "+n" beyond; paper/sticky slot (dx+20,dy+3).
- Aisles horizontal y=72 (A) and y=136 (B); vertical corridors x=19 (left/door) and x=356 (right/coffee).
- Manhattan waypoint routing: seat → (seatX,rowAisleY) → (corridorX,rowAisleY) → (corridorX,72) → target. Reverse for return.
- Draw order: background, then entities+desks sorted by baseline y.

## Palette
0 transparent, 1 #1a1c2c outline, 2 #3b2f3f dark wood, 3 #8b5e3c wood, 4 #c69c6d light wood, 5 #f4e3c1 cream, 6 #e8c9a0 skinA, 7 #b9805a skinB, 8 #6e4a36 skinC, 9 #4a6fa5 blue, 10 #d95763 red, 11 #5fa55a green, 12 #f2c14e yellow, 13 #8fd3ff sky/glow, 14 #2b3a67 night, 15 #ffffff, 16 #7b5ea7 purple.
Sprite arrays are string rows with placeholder chars H (hair), S (shirt), K (skin) remapped per employee; pre-render to offscreen canvases per appearance+frame (cache).

## Sprites
Character 16x24: walk x4 (side view, flip for left), sit_idle x2, type x2, read x2 (holds paper), phone x2, write x2, hand_up x2, stretch x2, drink x2. Make them look like cute chibi office workers (big head ~10px, body, legs). Seated frames can be back/3-quarter view facing monitor or front view behind desk — choose front view behind desk (desk occludes legs) so faces are visible.
Intern: same sit/type frames drawn scaled ~12x18, grey shirt.
Props: paper 6x5, sticky 4x4, mug 4x4, plant 10x16, steam x3, sweat drop x2, spark x2.
Bubble: small rounded box with emoji via fillText ~8px: 💭 ❗ 🔌 📞 📖 ☕ 📝 💻 🤖.
Monitor screens drawn in code: idle #2b3a67; typing scrolling white lines; bash #0c2b12 with green lines + blinking cursor; browser (phone/web) light with blue bar; glow rect alpha .12 when occupied.

## Appearance
h=fnv1a(session_id). hair=[#3b2f3f,#8b5e3c,#f2c14e,#d95763,#1a1c2c,#7b5ea7][h%6]; shirt=[9,10,11,12,16,13][(h>>3)%6]; skin=[6,7,8][(h>>6)%3]. tag='#'+session_id.slice(0,3). project=basename(cwd)||'unknown'.

## Employee state machine
Fields {id,tag,project,deskIdx,x,y,path[],state,act,actSince,bubble,interns:Map<agent_id,intern>,lastEventAt,queue[],facing}.
States: ENTERING → SEATED → (STRETCH 1.2s → TO_COFFEE → DRINK 3s → FROM_COFFEE → SEATED); LEAVING → removed.
Walk 40 px/s; walk anim 8fps, sit anim 4fps (typing 10fps).
act (when SEATED): thinking, reading, typing, bash, phone, mcp, sticky, handup.
Events while not SEATED are queued (max 5 keep latest); any event during coffee trip aborts it and routes back, applied on sitting. SessionEnd always priority → LEAVING.
Desk = lowest free index; if full, stand at (60+20n,200) with laptop using same acts.

IMPORTANT subagent rule: if an event has agent_id (comes from inside a subagent), it must NOT change the boss's act; instead it animates that intern (intern types/reads) and appears in the log as "#a3f › intern Explore · Read x.ts".

Event mapping in window.officeEvent(evt):
- unknown session or SessionStart → spawn at door, ENTERING (if SessionStart for already-present session, ignore).
- UserPromptSubmit → paper drops onto desk slot 0.3s, spark 0.5s, act=thinking.
- PreToolUse Read/Grep/Glob/LS → reading 📖; Edit/Write/MultiEdit/NotebookEdit → typing; Bash → bash, sweat once now−actSince>4s; WebSearch/WebFetch → phone 📞; Task/Agent → thinking with 🤖 bubble (intern itself spawns on SubagentStart); mcp__* → typing + 🔌; TodoWrite/TaskCreate/TaskUpdate → sticky 📝 (note persists on desk); other → typing.
- PostToolUse → thinking, 💭 bubble 1.5s at random 4–8s intervals.
- Notification: notification_type==='permission_prompt' or message contains 'permission' → handup ❗ blinking 2Hz until next event; idle_prompt → thinking with 💤 bubble; else small 🔔 bubble 2s.
- Stop → clear paper, coffee sequence.
- SubagentStart → add intern (key agent_id, label agent_type) fade in on stool.
- SubagentStop → remove that intern (fallback: remove one).
- SessionEnd → LEAVING.
- now−lastEventAt > 600s → LEAVING.
- Snapshot (Live) spawns sessions already seated with interns, no walk-in; also fill log with snapshot events.
Log detail: tool_name + basename(tool_input.file_path) or command truncated 24 chars or pattern or url or query.

## Simulator (Demo)
Start with 2 sessions, keep 1–5; every 8–20s add one if <5 (60%). Projects: dragon-shop, quest-qa, rune-auth, gold-split, portfolio (unused first), cwd '/Users/me/Practice/'+name. Ids random 8-hex (session ids like real UUID ok).
Per-session loop: SessionStart; wait 2–4s UserPromptSubmit; 4–10 tool steps each PreToolUse → 0.8–5s (Bash 3–8s) → PostToolUse → 0.3–1.5s gap; Stop; wait 6–15s, repeat from prompt; after 2–4 prompts SessionEnd.
Tool weights: Read 25, Grep 10, Glob 5, Edit 22, Write 6, Bash 15, WebSearch 4, Task 4, TodoWrite 5, mcp__linear__list_issues 4.
Task → SubagentStart right after (agent_id random, agent_type 'Explore' or 'general-purpose'), the intern emits 2–4 PreToolUse/PostToolUse Read/Grep events with agent_id, then SubagentStop 5–12s later.
8% steps: Notification permission_prompt, hold 3–6s.
Fake file paths per project (e.g. src/app/page.tsx, src/auth/auth.service.ts, prisma/schema.prisma...). Bash commands: npm test, pnpm build, git status, npx prisma migrate dev, etc.
All timers on scaled sim clock (accumulate dt*speed; no setTimeout for sim). Pause = speed 0.

## UI
Header: title "Claude Office", mode toggle Live/Demo, status pill green "connected" / amber "reconnecting" / grey "demo".
Default Demo if location.protocol==='file:'; else Live, fallback to Demo if no onopen within 3s (show note). Switching mode clears office.
Controls: "+ session" (Demo only), "❗ test hand" (Demo, makes a random employee raise hand), pause, speed 1x/2x/4x.
Roster: colour swatch, tag, project, status text in Thai+emoji (e.g. "กำลังพิมพ์ ⌨️", "อ่านไฟล์ 📖", "รัน bash 💦", "โทรหาข้อมูล 📞", "พักกินกาแฟ ☕", "ต้องการคุณ ❗", "กำลังคิด 💭"), intern count.
Event log newest on top, max 100 rows, monospace, "#a3f · dragon-shop · Edit page.tsx".
Hover canvas: hit-test 16x24 box → name tag "project #tag" above head (dark rounded rect, white small text) + highlight roster row. Clicking roster row highlights the employee too.
Dark cozy UI theme around canvas, pixel-ish monospace font stack (ui-monospace, Menlo).

## Polish
Window sky by local hour: 6–17 #8fd3ff with 2 drifting clouds; 17–19 gradient #f2c14e→#d95763; else #2b3a67 with 6 twinkling stars + warm lamp glow.
Coffee steam 3-frame loop. Monitor glow only when occupied. requestAnimationFrame, dt clamped 0.1s.
A wall clock showing real local time HH:MM in pixels is nice-to-have.

## Acceptance
- `node server/index.js` + test curl → employee walks in; refresh restores them seated.
- Opening web/index.html via file:// → Demo runs immediately with no console errors.
- `npm start` works with no install.
- No external network requests at all.
