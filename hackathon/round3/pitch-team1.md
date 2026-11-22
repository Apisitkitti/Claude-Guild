# Receipt Ledger — สมุดใบเสร็จผลงาน
**หนึ่งบรรทัด:** แทนที่จะนับว่า session "ยุ่ง" แค่ไหน ให้นับว่า "ได้อะไรจริง" — ไฟล์ที่แก้สำเร็จ, test แดง→เขียว, commit, TodoWrite ที่ติ๊กเสร็จ — แล้วโชว์เป็นใบเสร็จต่อ session

## ปัญหา
- UI ตอนนี้โชว์แต่ *กิจกรรม* (กำลังใช้เครื่องมืออะไร) ไม่ใช่ *ผลลัพธ์* — session ที่รัน Read 200 ครั้งดูขยันเท่ากับ session ที่ commit 3 ครั้ง
- รอบ 1 กรรมการสั่งไว้ว่า quest ต้อง "ให้รางวัลผลลัพธ์ ไม่ใช่ grind" (`hackathon/RESULTS.md:24`) ยังไม่มีใครทำ
- ตอนกลับมาที่โต๊ะ ผู้ใช้ไม่รู้ว่า session ที่ Stop ไปแล้ว "ทำสำเร็จหรือแค่ค้าง" (Lookout Bell บอกแค่ว่าเสร็จ/ถามค้าง: `lib/attention.ts:195-203`)

## ทำงานยังไง
**ที่มาข้อมูล (ทั้งหมดเป็น event ที่ store รับอยู่แล้ว ไม่ต้องเพิ่ม hook):**
- `PostToolUse` / `PostToolUseFailure` ติดตั้งแล้ว `hooks/settings.example.json:40,53`; ตัวแยกสำเร็จ/ล้มเหลวมีอยู่แล้ว `lib/attention.ts:204` (`failed = name === "PostToolUseFailure"`)
- ไฟล์ที่แก้สำเร็จ: `tool_name ∈ EDIT_TOOLS` + `tool_input.file_path` (`lib/territory.ts:27,77-81`, `lib/attention.ts:31`)
- คำสั่ง Bash: `tool_input.command` (`lib/attention.ts:126`); test fail มาเป็น `PostToolUseFailure.error` (`hackathon/round2/RESULTS.md:19`)
- dedupe: `tool_use_id` (`lib/attention.ts:214-219` — ใช้แบบเดียวกัน); ข้าม `is_interrupt` (`lib/attention.ts:205`)
- ต้องอ่านจาก **raw event ก่อน slim** เหมือน attention (`lib/store.ts:282-302`) เพราะ `slim` ย่อ object ลึก ≥2 ชั้นเป็น `"{…}"` (`lib/store.ts:274`) → `tool_input.todos[]` จะหาย

**ตัวนับผลลัพธ์ 4 แบบ (ต่อ session, key = `session_id`):**
1. **ไฟล์เปลี่ยน** — จำนวน path ไม่ซ้ำที่ Edit/Write สำเร็จ
2. **Test แดง→เขียว** — Bash ที่ command ตรง regex test runner (`vitest|jest|pytest|npm test|go test|cargo test`) : มี failure ก่อน แล้วคำสั่ง fingerprint เดียวกัน (ใช้ `fingerprint()` เดิม) สำเร็จ = 1 "ฟื้น" (นับแค่ทรานซิชัน ไม่นับรันเขียวซ้ำ)
3. **Commit** — Bash `git commit` ใน `PostToolUse` (สำเร็จเท่านั้น; สมมติฐาน: Bash exit≠0 ถูกส่งเป็น `PostToolUseFailure` — รอบ 2 ยืนยันกรณี test fail แต่ยังไม่ได้พิสูจน์กับ git commit โดยเฉพาะ → test ต้องใช้ fixture จริง)
4. **Todo เสร็จ** — `TodoWrite` สำเร็จ: นับ `tool_input.todos[].status === "completed"` ที่เพิ่มขึ้น (สมมติฐาน: ชื่อ tool/ฟิลด์ตามที่ Claude Code ส่ง; ไม่มี fixture ในรีโป → ถ้า payload ไม่ตรง ตัวนับนี้เป็น 0 และฟีเจอร์ที่เหลือยังทำงาน)

**แสดงผล (DOM เท่านั้น ไม่แตะ canvas ตัวละคร):** แถวในพาเนลข้าง session: `📄3 ✅1 📦2 ☑4` ฟอนต์ ≥12px + ปุ่มขยาย "ใบเสร็จ" (รายชื่อไฟล์, คำสั่ง test ที่ฟื้น, subject commit ตัดที่ 80 ตัว) บน canvas เพิ่มได้อย่างมากไอคอนทึบเล็ก ๆ เหนือหัวเมื่อ "ฟื้น test" (ไม่ย้อมสี/ไม่โปร่งใสทับตัวละคร)
**ช่วงโชว์เด็ด:** session หนึ่ง vitest แดง 3 รอบ → แก้ → เขียว: ไอคอน ✅ เด้ง +1 ในใบเสร็จพร้อมไฟล์ที่แก้ ขณะ session ข้าง ๆ ที่ grep ไม่หยุดมีใบเสร็จว่าง "0 ผลลัพธ์ · 41 tool calls" — เห็นต่างทันที

## ทำไมคุ้ม
- ตอบ 1 คำถามที่ผู้ดูแลถามจริง: "session นี้ได้งานหรือยัง" โดยไม่ต้องเปิด terminal
- ใช้ pipeline เดิม (raw ingest → tracker → sweep → `dropSession`) ไม่ต้องมี hook ใหม่ ไม่เสี่ยงขวาง hook
- ชนะ "นับกิจกรรม" ตรง ๆ: ตัวนับไม่มี "จำนวน tool call" เป็นคะแนนเลย — spam ไม่ได้ผล (Edit ไฟล์เดิมซ้ำ = นับ 1)

## ตัวชี้วัด + Kill criterion
- **วัด:** ใน replay ของ 10 session จริง (บันทึก payload จาก `store.events` ลง fixture) ตัวนับตรงกับ `git log`/ผล test จริง ≥ 90% (ไฟล์ที่เปลี่ยน, จำนวน commit) และ false "test ฟื้น" = 0
- **วัดที่สอง:** ผู้ใช้ 3 คนดูใบเสร็จของ session ที่เสร็จแล้ว ตอบ "สำเร็จ/ค้าง" ถูก ≥ 80% ใน 10 วินาที
- **Kill:** ถ้าใน fixture จริง `git commit` หรือ test fail ไม่แยกด้วย Success/Failure ได้ (>20% จัดผิด) → ตัดตัวนับนั้นทิ้ง; ถ้าเหลือน้อยกว่า 2 ใน 4 ตัวนับที่ถูกต้อง → ยกเลิกทั้งฟีเจอร์

## ขอบเขต MVP (≈330 บรรทัด)
- `lib/outcomes.ts` (~150): `OutcomeTracker` — `ingest(raw, now)`, `snapshot()`, `dropSession`, `sweep`; inject `now`
- `lib/store.ts` (~25): สร้าง tracker, เรียก `ingest(raw)` ข้าง attention (`:302`), `dropSession`, bump `STORE_VERSION` (`:55`), ใส่ใน `snapshot()` (`:318`)
- `lib/office/live.ts` + `components/OfficeApp.tsx` (~90): รับ field `outcomes`, แถวสรุป + แผงใบเสร็จ
- `lib/office/render.ts` (~15): ไอคอนทึบ "ฟื้น test" ชั่วคราว
- `tests/outcomes.test.ts` (~60 ใช้ vitest ตามแบบ `tests/attention.test.ts`):
  1. Edit สำเร็จนับไฟล์ ไม่ซ้ำ path; Edit ที่ `PostToolUseFailure` ไม่นับ
  2. `tool_use_id` ซ้ำไม่นับซ้ำ; `is_interrupt` ข้าม
  3. test fail ×2 แล้ว pass = ฟื้น 1; pass ซ้ำอีกไม่เพิ่ม
  4. pass โดยไม่เคย fail = 0
  5. `git commit` สำเร็จ = +1; `git commit` ที่ล้มเหลว = 0
  6. TodoWrite: completed เพิ่ม 1→3 = +2; ส่งซ้ำเท่าเดิม = 0; payload แปลก = 0 ไม่ throw
  7. subagent (`agent_id`) รวมเข้า session แม่
  8. `dropSession`/late-after-end ไม่ทำให้ค้างหรือนับ

## ความเสี่ยง + วิธีกัน
- **จับ test runner ผิด (regex):** นับเฉพาะ fingerprint ที่ "เคย fail แล้ว pass" ไม่ใช่แค่ match ชื่อ — ตัวอย่าง `echo vitest` ไม่เคย fail จึงไม่นับ
- **งานล้มเหลวเงียบ (exit 0 แต่ test แดง เช่นผ่าน `|| true`):** ติดป้ายใน UI ว่า "ตามที่ hook รายงาน" ไม่อ้างว่าพิสูจน์แล้ว
- **Payload TodoWrite ไม่ตรง (สมมติฐาน):** ฟีเจอร์ไม่พึ่งตัวนี้ (ดู kill)
- **Gaming:** ไม่มีรางวัล/XP จากตัวเลข — เป็นใบเสร็จเฉย ๆ จึงไม่มีแรงจูงใจให้ spam เก็บ path/command แบบตัดความยาว ไม่เก็บ tool_response
