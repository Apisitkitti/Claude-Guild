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

## เข้าร่วมกิลด์ (MCP)

ให้เพื่อนร่วมทีมเอา Claude Code ของตัวเองมาเข้ากิลด์ เห็นกันบนแผนที่ และประสานงานไม่ให้แก้ไฟล์ชนกัน

**ฝั่งเจ้าของกิลด์**
1. รันเซิร์ฟเวอร์ production: `npm run share` (= `next build && next start -p 5050 -H 127.0.0.1`, หรือ `npm run build && npm start`) — ถ้าจะให้คนใน LAN เข้าตรง ๆ ใช้ `npm run build && npm run start:lan`
   ⛔ **ห้ามเปิด tunnel/แชร์ `npm run dev` เด็ดขาด** — dev server มี endpoint สำหรับนักพัฒนา (`/_next/mcp`, `/__nextjs_*`) ที่ไม่มีโทเค็นกัน tunnel เฉพาะ production server เท่านั้น
2. พิมพ์โทเค็นและคำสั่งพร้อมใช้: `npm run guild:token` (ใส่ `-- --url <ลิงก์สาธารณะ>` ถ้าใช้ tunnel/Tailscale)
3. ส่งให้เพื่อน: ลิงก์ดู `<url>/?token=...` และคำสั่ง `claude mcp add` (ส่งทางช่องทางส่วนตัวเท่านั้น)

**ตัวเลือกการเชื่อมต่อ**
- *เครือข่ายเดียวกัน (LAN)*: ใช้ `http://<IP เครื่อง>:5050`
- *Cloudflare quick tunnel* (ไม่อยู่เครือข่ายเดียวกัน): (เปิดหลัง `npm run share` รันอยู่) `cloudflared tunnel --url http://localhost:5050` จะได้ลิงก์ `https://xxxx.trycloudflare.com` แล้วรัน `npm run guild:token -- --url https://xxxx.trycloudflare.com`
  ⚠️ ลิงก์นี้เป็นสาธารณะ ใครรู้ URL ก็เข้าถึงเซิร์ฟเวอร์ได้ มีเพียงโทเค็นที่กันไว้ — ห้ามโพสต์โทเค็นหรือลิงก์ `?token=` ในที่สาธารณะ (ถ้ารั่ว ให้รัน `npm run guild:rotate` แล้วรีสตาร์ทเซิร์ฟเวอร์ — หรือตั้ง `GUILD_TOKEN` ใหม่)
- *Tailscale* (ส่วนตัว แนะนำ): ทุกคนอยู่ใน tailnet เดียวกัน ใช้ `http://<ชื่อเครื่อง>.ts.net:5050` โดยรันด้วย `npm run dev:lan` (bind 0.0.0.0) หรือ `tailscale serve --bg 5050` ให้ Tailscale proxy มาที่ localhost

`dev:lan` / `start:lan` bind 0.0.0.0 และตั้ง `GUILD_REQUIRE_TOKEN=1` ให้อัตโนมัติ: ปิดการเชื่อถือ "คำขอจากเครื่องตัวเอง" ทั้งหมด (คนใน LAN ปลอม `Host: localhost` ได้) ทุกคำขอต้องมีโทเค็น รวมถึงเครื่องเจ้าของเอง — เปิดหน้าเว็บด้วย `http://localhost:5050/?token=<token>` และติดตั้ง hooks ของเครื่องเจ้าของด้วย `node scripts/install-hooks.mjs --global --url http://localhost:5050 --token <token> --apply`

ไฟล์โทเค็นอยู่ที่ `.guild/token` (โฟลเดอร์โปรเจกต์; override ด้วย `GUILD_TOKEN_FILE`) — `npm run guild:token` และเซิร์ฟเวอร์ใช้ไฟล์เดียวกัน. สมาชิก MCP สูงสุด 50 คน และ body ของ `/mcp` จำกัด 256KB; `POST /events` จากภายนอกที่ใช้ session_id ขึ้นต้น `mcp-` จะถูกปฏิเสธ

คำขอที่มาทาง tunnel/proxy (มี header เช่น `x-forwarded-for`, `cf-connecting-ip`) ถือเป็นคำขอจากภายนอกเสมอ ต้องมีโทเค็น แม้ Host จะเป็น localhost

**ฝั่งเพื่อน**
1. เพิ่ม MCP: `claude mcp add --transport http guild <url>/mcp --header "Authorization: Bearer <token>"`
2. (ไม่บังคับ) ส่ง hooks ไปที่กิลด์ให้ตัวละครขยับตามงานจริง: `node scripts/install-hooks.mjs --global --url <url> --token <token> --apply`
3. เพิ่มใน CLAUDE.md: "ก่อนแก้ไฟล์ให้เรียก `who_holds` · `claim` ไฟล์ที่จะแก้ · `release` เมื่อเสร็จ" (`npm run guild:token` พิมพ์ snippet ให้)

เครื่องมือ: `guild_join`, `guild_status`, `who_holds`, `claim`, `release`, `shout`, `guild_leave` — สมาชิกที่ไม่เรียกเครื่องมือใดเลย 30 นาทีจะถูกเอาออกอัตโนมัติ

## Endpoints

| Method | Path | |
|---|---|---|
| POST | `/events` | รับ hook JSON (สูงสุด 1MB) |
| GET | `/events/stream` | SSE: `snapshot` ก่อน แล้วตามด้วย event สด |
| GET | `/health` | `{ ok, sessions, clients, uptime }` |
| GET | `/` | หน้ากิลด์ |
| POST | `/mcp` | MCP (Streamable HTTP, stateless) |

## Files

- `lib/store.ts` — in-memory events/sessions + SSE clients (อยู่บน `globalThis` กัน hot-reload)
- `app/events/route.ts` — POST hook event · `app/events/stream/route.ts` — SSE · `app/health/route.ts`
- `lib/office/` — canvas engine, sprites, simulator (TS ล้วน ไม่ผูก React)
- `components/` — header, roster, event log (React)
- `hooks/settings.example.json` — hook config สำหรับ Claude Code

## Known limitations

- Claude Code sends no hook when a permission is approved, so the ❗ stays until the tool finishes (the red edge calms down after 60s).
