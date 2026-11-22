# Claude Guild ⚔️

กิลด์นักผจญภัยสไตล์ pixel art ที่ Claude Code แต่ละ session คือนักผจญภัยหนึ่งคน — เปิด session ก็เดินเข้ากิลด์ไปรับเควส
ใช้ tool ก็มีท่าทางตาม (ร่ายเวท, อ่านคัมภีร์, ต่อสู้กับมอนสเตอร์ในป่า, ยกมือขอ permission) subagent คือลูกมือ (squire) ที่ตามไปช่วย
ปิด session ก็กลับกิลด์

Next.js 16 (App Router) + TypeScript, Node 22 (`.nvmrc`), npm

## ฟีเจอร์

- **นักผจญภัยตาม session** — 5 อาชีพ (นักดาบ จอมเวท โจร นักบวช นักธนู) ตีมอนสเตอร์ตาม tool ที่ใช้, tool ที่รันนานกลายเป็นบอส, subagent เป็นลูกมือ, พักที่โรงเตี๊ยมตอนว่าง, เลเวล/XP/ทอง และแถบมานาบอก context
- **⚔️ Territory Clash** — ไฟล์ที่ session กำลังแก้คือ "ที่ดิน" ของมัน ถ้า 2 session แก้ไฟล์เดียวกันจะขึ้นแถบพิพาท และถ้า edit ล้มเพราะอีกฝ่าย ทั้งคู่เดินออกมาดวลกันกลางลาน (ฝ่ายที่ edit ไม่ล้มชนะ)
- **🔔 Lookout Bell** — คิว "ใครต้องการคุณก่อน": รอ permission › วนลูป (สั่งเดิม fail ด้วย error เดิม ≥3 ครั้งใน 5 นาที) › น่าจะรอคำตอบคุณ › context ใกล้เต็ม › เสร็จรอรีวิว · ปุ่ม 📋 Copy ข้อความเตือนไปแปะให้ Claude · กด `N` ไปตัวถัดไป · ตัวที่วนลูปขึ้น 🔁 และอาการคลั่ง
- **📜 ใบเสร็จ** — สรุปผลลัพธ์จริงของแต่ละรอบ (ไฟล์ที่แก้, test แดง→เขียว, commit, งานที่ติ๊กเสร็จ) เก็บไว้ 2 ชม. หลัง session จบ
- **🔒 ลบ secret** — token / API key / password / private key ถูกลบตั้งแต่ตอนรับ event ก่อนเก็บ, log หรือส่งออก

Hook เป็นแบบ async: กิลด์ **เตือนได้แต่ขวางไม่ได้** และทุกอย่างอยู่ใน memory บนเครื่องคุณเท่านั้น

## รัน

```bash
nvm use
```

```bash
npm install
```

```bash
npm run dev
```

เปิด http://localhost:5050 — production: `npm run build && npm start` (port 5050 เหมือนกัน)

**Demo mode:** ถ้าต่อ SSE ไม่ได้ภายใน 3 วินาทีจะสลับเป็น Demo เอง หรือเปิด http://localhost:5050/?demo เพื่อดูนักผจญภัยจำลอง

> ⚠️ store เก็บใน memory ของ process เดียว — รันแบบ `next dev` / `next start` บนเครื่องเท่านั้น ไม่เหมาะกับ serverless

## ภาษา (ไทย / English)

แอปมี 2 ภาษา: **ไทย** (ค่าเริ่มต้น / base) และ **English** — สลับได้ที่ปุ่ม `ไทย | EN` ในแถบบนสุด (เลือกแล้วโหลดหน้าใหม่ และจำไว้ใน cookie `PARAGLIDE_LOCALE`) ถ้ายังไม่เคยเลือกจะดูจากภาษาแรกของเบราว์เซอร์ (ไทยถ้าเป็นไทย ภาษาอื่นทั้งหมดใช้ English) โดย **ไม่เขียน cookie** — cookie ถูกเขียนเฉพาะตอนกดปุ่มสลับภาษา

> หน้า `/` ถูก prerender เป็นภาษาไทย ผู้ใช้ English จึงเห็นภาษาไทยแวบหนึ่งก่อน hydrate แล้วค่อยเปลี่ยน — ตั้งใจให้เป็นแบบนี้ (ไม่ต้องอ่าน cookie ใน root layout ซึ่งจะทำให้ทั้งแอปเลิก static)

ใช้ [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) 2.x คอมไพล์ข้อความเป็นฟังก์ชัน TypeScript ผ่าน CLI (Turbopack ใช้ปลั๊กอิน bundler ของ Paraglide ไม่ได้):

- ข้อความทั้งหมดอยู่ใน `messages/th.json` และ `messages/en.json` (key เดียวกัน, พารามิเตอร์เป็น `{name}`; อังกฤษใช้ plural แบบ ICU ตรงที่มีตัวเลข)
- ตั้งค่าโปรเจกต์ใน `project.inlang/settings.json` (`baseLocale: "th"`)
- โค้ดเรียกใช้ `import { m } from "@/paraglide/messages"` แล้ว `m.queue_empty()` / `m.receipt_calls({ calls: 3 })`
- แก้/เพิ่มข้อความแล้วรัน `npm run paraglide` เพื่อ generate `paraglide/` ใหม่ (ไม่ commit) — `npm run dev` รัน watch ให้เอง และ `build` / `test` / `lint` / `typecheck` รันก่อนเสมอ
- เพิ่ม key ต้องเพิ่มทั้งสองไฟล์ (มี test เช็กว่า key และ `{param}` ตรงกัน) ข้อความฝั่ง server (คิว Lookout Bell) ส่งมาเป็นข้อมูลล้วน แล้วฝั่ง client เรียบเรียงตามภาษาของผู้ดู

## ต่อกับ Claude Code จริง (Live mode)

ง่ายสุด: ใช้สคริปต์ merge hook ให้ (dry-run ก่อน ดูว่าจะเปลี่ยนอะไร แล้วค่อยใส่ `--apply`; สำรองไฟล์เดิมให้อัตโนมัติ)

```bash
node scripts/install-hooks.mjs --global
```

```bash
node scripts/install-hooks.mjs --global --apply
```

ถอดออก: `node scripts/install-hooks.mjs --global --uninstall --apply`

หรือทำเอง: เอา `hooks` จาก [hooks/settings.example.json](hooks/settings.example.json) ไป merge ใส่

- `~/.claude/settings.json` — ทุกโปรเจกต์
- หรือ `<project>/.claude/settings.json` — เฉพาะโปรเจกต์นั้น

ถ้ามี `hooks` อยู่แล้ว ให้ต่อ array ของแต่ละ event เข้าไป อย่าเขียนทับ
Settings reload live ไม่ต้อง restart Claude Code. Hook เป็น `async` + `|| true` — server ปิดอยู่ Claude ก็ไม่สะดุด

## ใช้กับ agent อื่น (Codex / Copilot CLI / Cursor)

> **ยังไม่เคยทดสอบกับเครื่องมือจริง** — ชื่อ field อ้างอิงจากเอกสารทางการ ณ 2026-11 ถ้าไม่ตรงกับของจริง รบกวนแจ้ง (issue / PR) นะ

Server แปลง payload ของ agent อื่นให้เป็นรูปแบบ Claude Code ก่อนเข้า store (`lib/adapters/`) — เลือก agent ด้วย `POST /events?source=codex|copilot|cursor` (ไม่ใส่ = Claude Code เหมือนเดิม; ถ้าไม่ใส่แต่ payload เป็นแบบ Cursor / Copilot camelCase จะเดาให้) session id จะต่อท้ายด้วย `-cx` / `-cp` / `-cu` กันชนกันโดยที่ 3 ตัวแรก (ป้ายบนโต๊ะ) ยังเป็นของ id เดิม

```bash
# dry-run ก่อน แล้วค่อยใส่ --apply (สำรองไฟล์เดิมให้; ถอดด้วย --uninstall)
node scripts/install-hooks.mjs --agent codex   --global     # ~/.codex/hooks.json  (หรือ --project <dir> → .codex/hooks.json)
node scripts/install-hooks.mjs --agent copilot --global     # ~/.copilot/hooks/claude-guild.json  (--project → .github/hooks/)
node scripts/install-hooks.mjs --agent cursor  --global     # ~/.cursor/hooks.json  (--project → .cursor/hooks.json)
```

ตัวอย่างไฟล์: [codex](hooks/codex.example.json) · [copilot](hooks/copilot.example.json) · [cursor](hooks/cursor.example.json)

- **Codex** — async command hook เหมือน Claude Code; Codex ต้อง review/trust hook ที่ไม่ใช่ managed ก่อนถึงจะทำงาน (เปิด `/hooks` ใน Codex เพื่อตรวจและอนุมัติ) และ `.codex/hooks.json` ระดับโปรเจกต์โหลดเฉพาะโปรเจกต์ที่ trust แล้ว; `apply_patch` ถูกแปลงเป็น Edit (ไฟล์แรกใน patch); Bash ที่ exit code ≠ 0 นับเป็น failure
- **Copilot CLI** — ใช้ command hook (`curl`) ไม่ใช้ `type: "http"` เพราะ http ต้องเป็น https เว้นแต่ตั้ง `COPILOT_HOOK_ALLOW_LOCALHOST=1` Copilot **อ่าน `.claude/settings.json` ของโปรเจกต์ด้วย** — ถ้าติดตั้งทั้ง Claude hook และ Copilot hook ในโปรเจกต์เดียวกัน event จะมาซ้ำ (เป็น 2 session) เลือกอย่างใดอย่างหนึ่ง (สคริปต์เตือนให้ตอน `--project`; `--global` ไม่ชน เพราะ Copilot ไม่อ่าน `~/.claude`) subagent ใช้ชื่อ agent (`agentName`) เป็น id ทั้ง start/stop
- **Cursor** — hook ของ Cursor ขวาง agent ได้ จึงติดตั้งเฉพาะ hook ที่ไม่ใช่ permission (`postToolUse`, `postToolUseFailure`, `stop`, `sessionStart/End`, `subagentStop`, `preCompact`, `beforeSubmitPrompt` ที่ตอบ `{"continue":true}`) ไม่มี `preToolUse` / `before*` จะได้ไม่เผลออนุมัติแทนคุณ ผลคือเห็นงานหลังเสร็จ (ไม่มีท่าทำงานระหว่างรัน, ไม่มีอินเทิร์นจาก `subagentStart`) `curl` ถูกรันเบื้องหลัง (`&`) แล้ว `echo` ตอบทันที → tool ไม่ต้องรอ และไม่ขวางแม้ server ปิด Cursor โหลด hook ของ Claude Code เป็น "third-party hooks" ได้ด้วย — ถ้าติดตั้งทั้งสองแบบ event จะซ้ำ (สคริปต์เตือนทั้งสองทาง) `subagentStop` ของ Cursor อาจไม่มี id ที่จับคู่กับ start ได้ (ใช้ type + generation_id) และ subagent ที่มี `conversation_id` ของตัวเองอาจโผล่เป็น session แยก (ยังไม่ยืนยัน)
- ไม่อ่าน transcript ของ agent อื่น → ไม่มีแถบ context

## ทดสอบด้วย curl

```bash
curl -X POST localhost:5050/events -H 'Content-Type: application/json' -d '{"session_id":"test1234","hook_event_name":"SessionStart","cwd":"/tmp/demo"}'
```

```bash
curl -X POST localhost:5050/events -H 'Content-Type: application/json' -d '{"session_id":"test1234","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm test"}}'
```

```bash
curl -X POST localhost:5050/events -H 'Content-Type: application/json' -d '{"session_id":"test1234","hook_event_name":"SessionEnd"}'
```

## Endpoints

| Method | Path | |
|---|---|---|
| POST | `/events` | รับ hook JSON (สูงสุด 1MB) |
| GET | `/events/stream` | SSE: `snapshot` ก่อน แล้วตามด้วย event สด |
| GET | `/health` | `{ ok, sessions, clients, uptime }` |
| GET | `/` | หน้ากิลด์ |

## Files

- `lib/store.ts` — in-memory events/sessions + SSE clients (อยู่บน `globalThis` กัน hot-reload)
- `lib/territory.ts` · `lib/attention.ts` · `lib/receipts.ts` · `lib/redact.ts` — ตัวติดตามฝั่ง server (ดินแดน, คิว Lookout Bell, ใบเสร็จ, ลบ secret)
- `app/events/route.ts` — POST hook event · `app/events/stream/route.ts` — SSE · `app/health/route.ts`
- `lib/office/` — canvas engine, sprites, simulator (TS ล้วน ไม่ผูก React)
- `components/` — header, roster, event log (React)
- `messages/` · `project.inlang/` — ข้อความไทย/อังกฤษ (Paraglide) · `lib/i18n.ts` — ล็อกภาษาฝั่ง client ให้ hydrate ได้ไม่เพี้ยน
- `hooks/settings.example.json` — hook config สำหรับ Claude Code · `hooks/{codex,copilot,cursor}.example.json` — agent อื่น · `lib/adapters/` — แปลง payload ของ agent อื่น

## Known limitations

- Claude Code sends no hook when a permission is approved, so the ❗ stays until the tool finishes (the red edge calms down after 60s).

## Privacy

- Everything stays in this process's memory on your machine; nothing is written to disk or sent anywhere.
- Secrets are redacted from every event before it is stored, logged or streamed. Receipts keep counts only (no commands, file names or commit messages).
- The server binds to `127.0.0.1` and rejects cross-origin requests. Don't expose it to a network or tunnel: it shows your file paths and commands.

## License

[MIT](LICENSE)
