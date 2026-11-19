# Claude Guild ⚔️

กิลด์นักผจญภัยสไตล์ pixel art ที่ Claude Code แต่ละ session คือนักผจญภัยหนึ่งคน — เปิด session ก็เดินเข้ากิลด์ไปรับเควส
ใช้ tool ก็มีท่าทางตาม (ร่ายเวท, อ่านคัมภีร์, ต่อสู้กับมอนสเตอร์ในป่า, ยกมือขอ permission) subagent คือลูกมือ (squire) ที่ตามไปช่วย
ปิด session ก็กลับกิลด์

Next.js 16 (App Router) + TypeScript, Node 22 (`.nvmrc`), npm

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

เอา `hooks` จาก [hooks/settings.example.json](hooks/settings.example.json) ไป merge ใส่

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
- `app/events/route.ts` — POST hook event · `app/events/stream/route.ts` — SSE · `app/health/route.ts`
- `lib/office/` — canvas engine, sprites, simulator (TS ล้วน ไม่ผูก React)
- `components/` — header, roster, event log (React)
- `hooks/settings.example.json` — hook config สำหรับ Claude Code

## Known limitations

- Claude Code sends no hook when a permission is approved, so the ❗ stays until the tool finishes (the red edge calms down after 60s).
