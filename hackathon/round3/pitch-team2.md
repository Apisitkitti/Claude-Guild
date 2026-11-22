# ทีม 2 "จอมเวท" — Cartographer's Atlas (แผนที่โค้ดเบสจากรอยเท้า session)
**One-liner:** แผงแผนที่โฟลเดอร์ที่ย้อมความร้อนจากสิ่งที่ session อ่าน/แก้จริง — เห็นทันทีว่างานกองอยู่ที่ไหน, ไฟล์ไหนทุก session ต้องอ่านซ้ำ (สัญญาณว่าอธิบายยาก), และโซนไหนไม่มีใครแตะ

## ปัญหา
- ผู้ใช้รัน session หลายตัวพร้อมกัน แต่ office บอกแค่ "ใครทำอะไรตอนนี้" ไม่มี "ความจำ" ว่าโค้ดส่วนไหนเป็นจุดสับสน
- Territory (`lib/territory.ts:27`) สนใจเฉพาะ edit ณ ตอนนี้ แล้วลืม (`MAX_RECENT`=2000, claim หมดอายุ) — ไม่มีใครรวม Read/Grep/Glob ซึ่งเป็นสัญญาณ "งง" ที่ชัดที่สุด
- Mana Ledger รอบ 2 โดนวิจารณ์ว่าเป็นตัวเลขตกแต่งไม่นำไปสู่การตัดสินใจ → ฟีเจอร์นี้ต้องให้ "คำตอบที่ลงมือทำได้": ควรเขียน CLAUDE.md/doc ตรงไหน

## ทำงานยังไง
**แหล่งข้อมูล (ทั้งหมดมีอยู่แล้ว ไม่ต้องเพิ่ม hook):**
- `file_path` ของ Edit/Write/MultiEdit/NotebookEdit ถูก resolve อยู่แล้ว: `lib/territory.ts:81` + `resolveTarget` `:35` (กรอง node_modules/.git/.next/tmp `:28-29`) — เรา reuse ไม่เขียนใหม่
- Read/Grep/Glob/LS: client อ่าน `ti.file_path || ti.path` ที่ `lib/office/engine.ts:466`, `READ_TOOLS` `:477`, และ sim ส่ง `{file_path}` ให้ Read `lib/office/sim.ts:33`. `tool_input` ผ่าน `slim` ครบ (ตัดแค่ string >300 ตัว `lib/store.ts:267-273`; ไม่อยู่ใน `DROP_KEYS` `:282`)
- fail ของ edit: `PostToolUseFailure` + `tool_use_id` dedupe แบบเดียวกับ `lib/attention.ts:207-216`
- ทุก event ผ่าน `addEvent` (`lib/store.ts:284`) → เสียบ `store.atlas.onEvent(evt)` ข้าง `territory.onEvent` (`:297`) ฝั่ง server (ตาม must-fix ของ judge B รอบ 1)
- **สมมติฐาน:** Grep/Glob ใน Claude Code จริงส่ง `tool_input.path` (เป็นโฟลเดอร์) ไม่ใช่ `file_path` — โค้ดเรารองรับ `path` ที่ engine.ts:466 แต่ไม่เคยพิสูจน์กับ payload จริง; ถ้าไม่มี `path` ให้ใช้ `cwd` เป็นโฟลเดอร์ (นับเป็น "ค้นทั้งโปรเจกต์" น้ำหนักต่ำ)

**เก็บอะไร (in-memory, key = path ต่อ cwd, ไม่ persist, ไม่เก็บเนื้อไฟล์):**
ต่อไฟล์: `reads`, `edits`, `editFails`, `sessions:Set`, `lastTouch`. นับ 1 ครั้งต่อ `tool_use_id` (กัน PreToolUse+PostToolUse นับซ้ำ — บทเรียนจาก Almanac รอบ 1) นับเฉพาะ PostToolUse/Failure
**ผลลัพธ์ 3 แถว (DOM panel ≥12px, เรียงตามคะแนน ไม่ใช่ treemap ใหญ่):**
1. 🔥 Hot — โฟลเดอร์ที่ edit เยอะสุดใน 24 ชม.
2. 🌀 Confusion — ไฟล์ที่ `reads ≥3 โดยไม่มี edit` หรือ `≥2 session อ่านซ้ำ` หรือ `editFails ≥2` พร้อมข้อความ "ไฟล์นี้ถูกอ่าน 5 ครั้งใน 3 session — พิจารณาใส่ใน CLAUDE.md"
3. 🌑 Unexplored — โฟลเดอร์ระดับ 1-2 ของ cwd (`fs.readdir` ครั้งเดียวต่อ cwd, cache 5 นาที, ข้าม ignore-list เดิม) ที่ session ไม่เคยแตะ
**Demo moment:** ทำงานจริง 3 session บน repo นี้ → เปิดแผง ขึ้น "lib/office/engine.ts อ่านซ้ำ 7 ครั้ง/3 session" คลิกแถว → highlight ตัวละครที่เพิ่งแตะ; กด "คัดลอกบรรทัดแนะนำ" ได้ข้อความพร้อมวางใน CLAUDE.md
**Canvas:** ไม่แตะ canvas/ตัวละครเลย (ข้อมูลทั้งหมดอยู่ใน DOM) → ไม่ชนกฎโปร่งใส/ย้อมสี; ข้อความไทย ≥12px

## ทำไมคุ้ม
- เปลี่ยน telemetry ที่ทิ้งอยู่แล้วเป็นการตัดสินใจ: จุดที่ agent งงซ้ำ = จุดที่ควรเขียน doc/refactor (ผลลัพธ์ลงมือทำได้ ต่างจาก Mana Ledger)
- ไม่ซ้ำ Territory (ปัจจุบัน vs สะสม), Lookout Bell (ต้องการคุณตอนนี้), mana bar; ไม่ใช้ MCP/ข้ามเครื่อง

## ตัวชี้วัด + Kill criterion
- **Metric 1 (precision):** รัน 10 session จริงบน repo นี้; ผู้ใช้ตัดสินแถว Confusion — ≥60% ถูกตัดสินว่า "ไฟล์นี้อธิบายยาก/ควรมี doc" จริง
- **Metric 2 (ถูกต้องการนับ):** replay event log เดียวกัน 2 ครั้ง + inject event ซ้ำ `tool_use_id` เดิม → ตัวนับเท่ากัน 100%
- **Metric 3 (ใช้จริง):** ผู้ใช้เปิดแผง ≥3 ครั้ง/วัน และเพิ่ม/แก้ CLAUDE.md อย่างน้อย 1 รายการจาก Confusion ใน 1 สัปดาห์
- **Kill:** precision <40% หรือ ไม่มีผู้ใช้นำ insight ไปใช้ใน 2 สัปดาห์ → ถอดทิ้ง (โมดูลแยกไฟล์เดียว ลบได้โดยไม่กระทบ store)

## ขอบเขต MVP (≈330 บรรทัด)
- `lib/atlas.ts` (~150): `AtlasTracker.onEvent/snapshot/sweep`, aggregate รายโฟลเดอร์, ใช้ `resolveTarget`/`displayPath` จาก territory
- `lib/store.ts` (+~20): สร้าง `atlas`, เรียกใน `addEvent`, SSE event `atlas` throttle 2 วิ, `dropSession` ไม่ลบสถิติ (สะสมข้ามจบ session)
- `lib/atlas-scan.ts` (~40): readdir 2 ระดับ + cache
- `components/AtlasPanel.tsx` (~110) + เสียบใน `OfficeApp.tsx` (+~10)
- **Tests (`lib/atlas.test.ts`):** (1) นับ 1 ครั้งต่อ tool_use_id (2) Pre ไม่นับ, Post นับ (3) ignore node_modules/tmp (4) Read ไม่มี edit ≥3 → Confusion (5) 2 session อ่านไฟล์เดียว → Confusion (6) editFail ≥2 → Confusion (7) Grep ไม่มี `path` → fallback cwd (8) agent_id นับเป็น session แม่ (9) late event หลัง SessionEnd ไม่สร้างแถวใหม่ (10) cap 2000 ไฟล์ evict เก่าสุด (11) path ไม่ส่ง absolute ออก client (ใช้ `displayPath`)

## ความเสี่ยง + วิธีกัน
- Read ซ้ำอาจปกติ (ไฟล์ใหญ่อ่านเป็นช่วงด้วย offset/limit) → นับเฉพาะ Read ที่ `offset` ต่างกันเป็น 1 กลุ่ม; **สมมติฐาน:** Read payload มี `offset/limit` ใน tool_input
- ข้อมูลใน memory หายเมื่อ restart server → ยอมรับใน MVP (ติดป้าย "ตั้งแต่ <เวลาเริ่ม>" ใช้ `store.startedAt`); persist ไฟล์ทำรอบหน้าเมื่อพิสูจน์ค่าแล้ว
- เนื้อหา: เก็บเฉพาะ path+ตัวนับ ไม่เก็บ `tool_response` (ถูก drop อยู่แล้ว `store.ts:282`)
- memory โต: cap 2000 ไฟล์/cwd, 20 cwd
- event 200 ตัวล่าสุดใน store (`:36`) ไม่พอ → ตัวนับสะสมที่ `onEvent` ไม่อ่านจาก `store.events`
