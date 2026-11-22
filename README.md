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
- `hooks/settings.example.json` — hook config สำหรับ Claude Code

## Known limitations

- Claude Code sends no hook when a permission is approved, so the ❗ stays until the tool finishes (the red edge calms down after 60s).

## Privacy

- Everything stays in this process's memory on your machine; nothing is written to disk or sent anywhere.
- Secrets are redacted from every event before it is stored, logged or streamed. Receipts keep counts only (no commands, file names or commit messages).
- The server binds to `127.0.0.1` and rejects cross-origin requests. Don't expose it to a network or tunnel: it shows your file paths and commands.

## License

[MIT](LICENSE)
