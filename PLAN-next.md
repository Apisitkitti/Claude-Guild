# Plan: รอบถัดไป (Opus, 2026-11-17)

ลำดับ 10 → 8 → 1 → 4 (+ 2): git ✅ → tests → แจ้งเตือน → Mana bar → กรอง session

## Phase 1 (พร้อมกัน, ไฟล์ไม่ทับกัน)

### S1 — Engine tests (vitest)
- devDeps `vitest` (+ `jsdom` ถ้าจำเป็น), script `npm test`
- ทำ seam ให้ `Office` สร้างได้แบบ headless (ไม่มี canvas/rAF) — แก้ engine.ts ให้น้อยที่สุด, ไม่เปลี่ยน behaviour
- test ครอบ:
  - lifecycle: SessionStart → seated, SessionEnd → leave/tombstone, resume ระหว่างเดินออก, SessionEnd ซ้ำ
  - overflow > 8 + promote เมื่อช่องว่าง
  - Stop → tavern → กลับ, event ระหว่างทาง
  - squire: SubagentStart/Stop, agent_id ไม่รู้จัก
  - combat: monster HP/ตาย/เกิดใหม่, failure เสียหัวใจ, Stop เติมหัวใจ
  - boss: Pre ค้าง > 30s → boss, Post → ตาย, Esc+prompt → ไม่มีบอสผี, Agent/AskUserQuestion ไม่นับ, handup ไม่นับ
  - XP/level หลายขั้น, persistence (localStorage stub) + demo ไม่เขียน
  - snapshot reconcile ไม่นับทองซ้ำ
- ไฟล์: `lib/office/engine.ts` (seam เท่านั้น), `tests/**`, `vitest.config.ts`, `package.json`

### S2 — Context (Mana) ฝั่ง server
- เมื่อ event มี `transcript_path`: อ่านท้ายไฟล์ JSONL (≤ 256KB สุดท้าย) หา assistant message ล่าสุดที่มี `usage`
  - used = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
  - limit = 1,000,000 ถ้า model id มี `[1m]` หรือ used > 200k, ไม่งั้น 200,000
- **ความปลอดภัย:** path ต้อง resolve (realpath) แล้วอยู่ใต้ `~/.claude/projects/` และลงท้าย `.jsonl` เท่านั้น ไม่งั้นไม่อ่าน
- อ่านแบบ async, throttle ต่อ session (≤ 1 ครั้ง/2s), ไม่ block POST, error = เงียบ
- แนบ `context: { used, limit }` ลงใน event ที่ broadcast และใน session ของ snapshot
- ไฟล์: `lib/store.ts`, `lib/transcript.ts` (ใหม่), `app/events/route.ts`

### S3 — แจ้งเตือนตอนรอ permission
- ชื่อแท็บ: `❗(N) Claude Guild` เมื่อมี N session รอ (act handup), กลับเป็นปกติเมื่อหมด
- ปุ่ม 🔔 ใน header ขอ permission Notification (opt-in, จำใน localStorage) → เด้งเมื่อมี session เริ่มรอ **และแท็บไม่ได้ถูกดูอยู่** (document.hidden), คลิกแล้ว focus แท็บ; กัน spam (≤ 1 ต่อ session ต่อ 30s)
- ไฟล์: `components/OfficeApp.tsx`, `app/globals.css` (อ่านข้อมูลจาก roster ที่มีอยู่แล้ว)

## Phase 2 (หลัง Phase 1)

### S4 — Mana bar + กรอง session
- engine: เก็บ `context` ล่าสุดต่อ employee (จาก event/snapshot), RosterRow เพิ่ม `ctxUsed?, ctxLimit?`
- render: แถบ mana 12×2 สีฟ้า→เหลือง (>70%)→แดง (>90%) ใต้หลอดหัวใจ; PreCompact = วงเวทย์ฟ้า + เติมเต็ม
- panel: แถบ mana บนการ์ด + % (role=progressbar)
- กรอง: ช่องค้นหา/เลือกโปรเจกต์ใน panel + toggle "ซ่อน session ที่ไม่มี SessionStart" → engine `setFilter()` ซ่อนทั้งบน canvas และ roster (ไม่ทิ้ง state), จำใน localStorage
- รัน `npm test` ต้องผ่าน + เพิ่ม test สำหรับ context/filter

## ปิดงาน
Opus review ทั้งหมด → Sonnet แก้ → tsc/lint/test/build → ทดสอบในเบราว์เซอร์ → commit

## แก้แผนหลัง Opus แย้ง (รับทุกข้อ)
- **S1:** ไม่แก้ engine.ts เลย — fake canvas `{width,height,getContext:()=>stub}`, vitest env node, `vi.useFakeTimers()` (tombstone ใช้ Date.now, ส่วนอื่นใช้ `update(dt)`), spy `Math.random`, stub `localStorage` บน globalThis, test บอสต้อง tick จนนั่งก่อน
- **S2:**
  - transcript: field คือ `type:"assistant"`, `message.model`, `message.usage.{input_tokens,cache_read_input_tokens,cache_creation_input_tokens}`; ข้ามบรรทัด `model:"<synthetic>"` และ `isSidechain`; เริ่ม parse หลัง newline แรกของ tail window; หาไม่เจอ = คงค่าเดิม
  - limit = env `CLAUDE_OFFICE_CTX_LIMIT` (default 200000); ถ้า used > limit ขยับเป็น 1,000,000 และ mark `limitGuessed: true` — ไม่มี `[1m]` ใน id จริง
  - reset ตอน PreCompact และ `SessionStart(source=compact)`
  - trailing debounce ~500ms ต่อ session เฉพาะ Stop / PostToolUse / UserPromptSubmit / SessionStart (กัน race กับการ flush ไฟล์)
  - ส่งเป็น SSE แยก `event: context` data `{session_id, used, limit, limitGuessed}`; เก็บใน Session + snapshot; **ห้ามแตะ engine.ts / live.ts / client**
  - base dir = realpath(`CLAUDE_CONFIG_DIR` หรือ `~/.claude`) + `/projects/` (เช็ค prefix พร้อม separator), `lstat`+`isFile`, size cap; ส่งออกแค่ตัวเลข
  - unit test `lib/transcript.ts` ด้วย fixture JSONL ปลอม
- **S3:** permission เป็น denied → ซ่อนกระดิ่ง; คืนชื่อแท็บตอน unmount; test ด้วย mock `document.hidden` ถ้าทำได้
- **S4:** `live.ts` เพิ่ม `addEventListener("context")` → `Office.setContext(sid, used, limit, guessed)` + test
- ตัดวงเวทย์ PreCompact ออก
