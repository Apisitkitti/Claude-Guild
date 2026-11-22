# Rebuttal ทีม 2 — Cartographer's Atlas (ตอบ R2-1..R2-6: ยอมรับ 5 · หักล้างบางส่วน 1)

**R2-1 ยอมรับ + แก้แผน.** "อ่านซ้ำ" ปนกับ "ไฟล์ hub" จริง → เปลี่ยนสัญญาณหลักเป็น **ค่าเบี่ยงจาก baseline**: คะแนนต่อไฟล์ = `reads/session` ของไฟล์นั้น เทียบ median ของ `reads/session` ทั้ง cwd; แสดงเฉพาะไฟล์ที่ ≥2× median **และ** อยู่นอก hub-list (ไฟล์ที่ ≥80% ของ session อ่าน = "hub" ติดป้ายแยก ไม่นับเป็น Confusion). `editFails` นับเฉพาะ error ที่ไม่ใช่ "file modified since read"/old_string-not-found (error ดิบอยู่ใน `PostToolUseFailure.error` — ดู `lib/office/sim.ts:96` ที่ sim ใช้ field นี้; **สมมติฐาน** ว่า payload จริงมี `error` เป็น string). Metric 1 ใหม่: สุ่ม top-5 จาก log จริง 10 session แล้วต้อง **ไม่ใช่ hub** ≥3/5 และผู้ใช้ติดป้ายแบบ blind (ไม่เห็นคะแนน). Kill เดิมคงไว้ + ถ้า top-5 เป็น hub ล้วน → ยกเลิกแถว Confusion เหลือแค่ Hot/Unexplored.

**R2-2 ยอมรับ.** ถูกต้อง — `engine.ts:466,477` และ `sim.ts:33-35` เป็นโค้ด client/ตัวจำลอง ไม่ใช่หลักฐาน payload (sim ไม่ส่ง `path` ให้ Grep/Glob). แก้: (ก) ตัดอ้างว่า Grep/Glob มี `path` ออกจาก "ข้อเท็จจริง" → เป็น **สมมติฐาน** ทั้งหมด; Read `file_path` เป็นเรื่องที่ชัดที่สุด แต่ก็ยังเป็นสมมติฐานจนกว่าจะจับ payload (ข้อเท็จจริงที่ยืนยันฝั่ง server มีเพียง Edit/Write `ti.file_path` ที่ `lib/territory.ts:81`). (ข) งานแรกของ MVP = เพิ่ม debug dump 1 ครั้งต่อ tool (Read/Grep/Glob) จาก `addEvent` ก่อน `slim` เก็บ key ของ tool_input ลง log เพื่อยืนยัน; (ค) ตัด logic `offset/limit` ออกจาก MVP — นับ Read ต่อ session ละไม่เกิน 1 ครั้งต่อ 60 วิ แทน. ถ้า Grep/Glob ไม่มี path → นับเป็นไม่ทราบ ไม่นับเข้าแผนที่ (ไม่ fallback cwd).

**R2-3 ยอมรับ.** ถอนประโยค "ไม่แตะ canvas" → MVP **ไม่ highlight ตัวละครเลย**: คลิกแถวแล้วเพียงแสดงรายชื่อ session ที่แตะ (ชื่อ+สีป้ายใน DOM ที่มีอยู่) ใน panel. ไม่แก้ `lib/office/render.ts` (0 บรรทัด) จึงไม่เสี่ยงกฎโปร่งใส/ย้อมสี.

**R2-4 ยอมรับ.** แก้: scan เฉพาะ cwd ที่ `store.sessions` มี session จริงรายงานอยู่ (`lib/store.ts:227,253`) และต้อง `path.resolve` แล้วเป็น absolute ที่ไม่ใช่ `/`, ไม่อยู่ใน `IGNORED_PREFIXES` (`lib/territory.ts:29`); ใช้ `readdir` ระดับเดียว (+ระดับ 2 เฉพาะโฟลเดอร์ที่ไม่ ignore) จำกัด ≤200 entry/cwd ด้วย `opendir` อ่านทีละ entry แล้วหยุด; ส่งเฉพาะชื่อ relative. Tests: cwd ที่ไม่มี session → ไม่ scan; cwd=`/` ถูกปฏิเสธ; ชื่อ `..`/symlink ออกนอกรูท → ข้าม; โฟลเดอร์ 5,000 entry → หยุดที่ 200.

**R2-5 ยอมรับ.** vitest include = `tests/**/*.test.ts` (`vitest.config.mts:10`) → ย้าย test ไป `tests/atlas.test.ts` และ `tests/atlas-scan.test.ts`.

**R2-6 ยอมรับ (และแก้การอ้างบรรทัดผิด).** dedupe ของ attention อยู่ที่ `lib/attention.ts:214-219` ไม่ใช่ `:207-216` (ตรวจแล้ว: `if (id) { if (st.ids.includes(id)) return; ... }`) — ขออภัย. แก้: `sessions` เป็น Set จำกัด 20 id; cap รวม **5,000 แถวทั้ง store** (evict LRU) และ 5 cwd; `dropSession` ลบ id ออกจาก Set แต่คงตัวนับ; ตัดคำว่า "24 ชม." → "ตั้งแต่ server เริ่ม (`store.startedAt`)" เพราะไม่ persist; ตัด metric 3 "เปิดแผง ≥3 ครั้ง/วัน" (ไม่มีตัวนับ) → ใช้ **นับ click "คัดลอกบรรทัดแนะนำ" ใน memory** แสดงใน panel footer เป็นสัญญาณใช้งานจริง.

## แผน MVP ฉบับแก้ (≈340 บรรทัด)
- `lib/atlas.ts` (~160): onEvent (นับต่อ tool_use_id เฉพาะ Post*), baseline/median, hub-list, caps
- `lib/atlas-scan.ts` (~50): scan จำกัดตาม R2-4
- `lib/store.ts` (+~25): hook เข้า `addEvent`, debug dump key ของ tool_input (ปิดได้ด้วย env), SSE `atlas` throttle
- `components/AtlasPanel.tsx` (~90) + `OfficeApp.tsx` (+~10); `render.ts`/canvas 0 บรรทัด
- Tests (`tests/atlas.test.ts`, `tests/atlas-scan.test.ts`): dedupe tool_use_id · Pre ไม่นับ · hub ไม่ขึ้น Confusion · ≥2× median ขึ้น · error "modified since read" ไม่นับ editFail · Grep ไม่มี path ไม่นับ · Read ซ้ำ <60 วิ นับ 1 · ignore node_modules/tmp · late event หลัง SessionEnd ไม่สร้างแถว · cap 5,000/Set 20 · ไม่ส่ง absolute path · scan: cwd ไม่รู้จัก/`/`/traversal/5,000 entry
