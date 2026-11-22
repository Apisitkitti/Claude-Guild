# Rebuttal ทีม 1 — Receipt Ledger
ตรวจโค้ดซ้ำแล้ว: ข้อกล่าวหาทั้ง 6 ข้อ **จริง** — ยอมรับทั้งหมด (6/6) พร้อมแก้แผน ไม่มีข้อที่หักล้าง

## R1-1 ใบเสร็จหายตอน session ถูก drop — ยอมรับ
ยืนยัน: sweep ลบเมื่อเงียบเกิน `STALE_MS = 10 นาที` (`lib/store.ts:38,69`) และ SessionEnd เรียก `dropSession` ทันที (`:218-221`)
**แก้:** `OutcomeTracker` *ไม่* ผูกกับ `dropSession` — เก็บ "ใบเสร็จที่ปิดแล้ว" แยก (`closed: Map<session_id, Receipt>`) ย้ายเข้าเมื่อ drop/SessionEnd/Stop, TTL 2 ชม. + cap 30 ใบ (ล้างใน sweep 30s เดิม `:67-73`) ใบเสร็จมี `cwd` + ชื่อ session กำกับเพราะ session หลุดจากรายการแล้ว UI แสดงเป็นหมวด "เพิ่งเสร็จ" · test: Stop → เงียบ 15 นาที (inject `now`) ใบเสร็จยังอยู่; ครบ 2 ชม. หาย; ใบที่ 31 ไล่ใบเก่าสุด

## R1-2 TodoWrite อาจไม่มี — ยอมรับ
ยืนยัน: client รู้จัก `TaskCreate`/`TaskUpdate` (`lib/office/engine.ts:479`)
**แก้:** ตัวนับ "งานเสร็จ" นับจาก `TaskUpdate` ที่ `tool_input.status === "completed"` (สมมติฐาน: ชื่อฟิลด์ `status` — ยังไม่มี fixture) *และ* TodoWrite (เดิม) ใช้ `tool_use_id` กันซ้ำ; ถ้าสองรูปแบบไม่ตรง payload จริง ตัวนับ = 0 แล้ว **MVP ลดเหลือ 3 ตัวนับ** (ไฟล์/test/commit) โดยไม่กระทบอย่างอื่น · kill: ถ้า fixture จริงไม่มีทั้งสองแบบ ตัดตัวนับนี้ทิ้งก่อน merge · test: TaskUpdate completed +1, ซ้ำ id = 0, payload แปลก = 0

## R1-3 fingerprint ต่างคำสั่ง + ซ้ำกับ Lookout Bell — ยอมรับ
ยืนยัน: fingerprint ของ Bash = hash ทั้งคำสั่ง (`lib/attention.ts:126-127`) ดังนั้น `vitest run a.test.ts` แดง → `npm test` เขียน จับไม่ได้
**แก้:** นิยาม "ฟื้น" ระดับ runner: `runnerOf(cmd)` → `vitest|jest|pytest|go test|cargo test|npm test` (จำแนก `npm|pnpm|yarn test` เป็น runner "node-test" รวมกับ `vitest/jest` ใน cwd เดียวกัน) คีย์ = `(session, cwd, runner)` สถานะ `red` เมื่อ failure ล่าสุดของ runner นั้น; พอ Success ของ runner เดียวกัน (คำสั่งใดก็ได้) → ฟื้น +1 แล้วกลับ `green` ส่วนเรื่อง "ลอจิกซ้ำ": ไม่ใช้ `ring` ของ attention เลย — tracker แยก ไม่แชร์ state และเป้าหมายต่างกัน (Bell = ปลุกคน; Ledger = นับผลลัพธ์) · test: ต่างคำสั่งแต่ runner เดียวกัน = ฟื้น, ต่าง cwd ไม่ฟื้น, ต่าง runner ไม่ฟื้น

## R1-4 commit parsing — ยอมรับ
**แก้:** นับ commit เมื่อ Bash `PostToolUse` และ command match `\bgit\s+commit\b` (ข้ามบรรทัดได้) ไม่แยก subject จาก command อีกต่อไป — drop ฟีเจอร์ "subject 80 ตัว" (heredoc ทำให้ parse เปราะ) แสดงแค่จำนวน + เวลา; `--amend` นับแยกเป็น "amend" ไม่รวมใน commit; `commit` ที่ล้ม (`PostToolUseFailure`) = 0; commit ที่ pre-commit hook ล้มได้ผลเป็น failure ตามที่ hook รายงาน (ป้าย "ตามที่ hook รายงาน" คงไว้) · test: fixture heredoc `-m "$(cat <<'EOF'`, `--amend`, failure, `git commit-tree` ไม่นับ (ขอบ `\b` + ช่องว่าง)

## R1-5 บรรทัดอ้างอิงผิด — ยอมรับ
ตรวจแล้วที่ถูก: `failed =` `lib/attention.ts:210`; `is_interrupt` `:211`; คำพูดกรรมการเรื่อง `PostToolUseFailure.error` อยู่ `hackathon/round2/RESULTS.md:22` (เป็นคำกรรมการ ไม่ใช่ payload); `snapshot()` `lib/store.ts:319`
**แก้:** ใช้เลขใหม่ทั้งหมด; fixture ของ test ใช้ shape ที่ `lib/attention.ts` อ่านจริง (`tool_name, tool_input, tool_use_id, error, is_interrupt`) — ติดป้าย "สมมติฐาน" สำหรับฟิลด์ที่ยังไม่มี payload จริง และเพิ่มขั้นแรกของงาน: จับ raw payload 1 ตัวต่อชนิดเก็บเป็น fixture ก่อนเขียน parser

## R1-6 วัดผลด้วย replay ไม่ได้ — ยอมรับ
ยืนยัน: `MAX_EVENTS = 200` (`lib/store.ts:36`) และ event ถูก slim ก่อนเก็บ (`:288`) — todos/command ยาวหาย
**แก้:** เปลี่ยนวิธีวัด: (1) เพิ่ม dev-only recorder เขียน raw body (ก่อน slim, ที่ `addEvent` ต้นฟังก์ชัน) ลง `.guild/recorded-events.jsonl` เมื่อ `LEDGER_RECORD=1` เท่านั้น (ปิดเป็นค่าเริ่มต้น, ไม่มี tool_response), (2) วัด: เล่น fixture ที่บันทึกจาก 5 session ที่ผู้พัฒนาทำจริง เทียบ `git log`/ผล test มือ ≥90% — ถ้าบันทึกไม่ครบ 5 session ภายในรอบทดลองถือว่า kill

## แผน MVP ฉบับแก้ (≈385 บรรทัด)
- `lib/outcomes.ts` (~170): tracker + closed receipts TTL + runner-level test state + commit/amend + task counters
- `lib/store.ts` (~35): สร้าง tracker, ingest raw, sweep, STORE_VERSION bump (`:55`), snapshot (`:319`), recorder ใต้ env flag
- `lib/office/live.ts` + `components/OfficeApp.tsx` (~100): แถวสรุป, แผง "เพิ่งเสร็จ", ข้อความไทย ≥12px
- `lib/office/render.ts` (~10): ไอคอนทึบ "ฟื้น test" ไม่ทับตัวละครด้วยของโปร่งใส
- tests: `tests/outcomes.test.ts` (~70) — TTL 15 นาที/2 ชม./cap, ต่างคำสั่งเดียว runner, ต่าง cwd, heredoc/amend/failed commit, TaskUpdate/TodoWrite/payload แปลก, dedupe `tool_use_id`, interrupt, subagent รวมเข้า session แม่; `tests/store.test.ts` เพิ่ม 1 เคส: SessionEnd แล้ว snapshot ยังมีใบเสร็จ
