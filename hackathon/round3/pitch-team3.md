# ทีม 3 "โจร" — Permission Tax: บัญชีเวลารอ + ตัวแนะนำ allow-rule
**หนึ่งประโยค:** วัดว่าวันนี้คุณ "ทำให้ session ค้าง" กี่นาทีเพราะ permission prompt ซ้ำ ๆ แล้วเสนอ rule `permissions.allow` สำเร็จรูปให้กดคัดลอก — เปลี่ยนเวลารอเป็นเวลาที่ได้คืน

## ปัญหา
- Lookout Bell บอก "ใครรอ" แต่ไม่บอก "รอนานเท่าไรสะสม" และ "รอเรื่องอะไรซ้ำ ๆ" — prompt `git status`/`npm test` เดิมโผล่ 15 ครั้ง/วัน ไม่มีใครเห็นภาพรวม
- ค่าจริงอยู่แค่ใน `waitingSince` ที่ถูกล้างทิ้งทันทีเมื่อกลับมาทำงาน (`lib/store.ts:246-250`) → ไม่มีประวัติเลย
- สมมติฐาน: dev รัน 3-5 session ขนานมีเวลารอ permission รวม 20-40 นาที/วัน (ยังไม่เคยวัด — MVP นี้คือเครื่องวัด)

## ทำงานยังไง
**แหล่งข้อมูล (ไม่มี hook ใหม่ ใช้ที่ติดตั้งแล้ว):**
- เริ่มรอ: `PermissionRequest` / `Notification(permission_prompt)` → `lib/store.ts:245-247` (hook ลงทะเบียนที่ `hooks/settings.example.json:66`)
- `tool_name` + `tool_input` ของ PermissionRequest ถูกเก็บใน event (ไม่อยู่ใน `DROP_KEYS`, `lib/store.ts:282`); ใช้ `fingerprint()`+`normalizeCommand()` เดิมจัดกลุ่ม "prompt แบบเดียวกัน" (`lib/attention.ts:87,124`)
- จบรอ: event ถัดไปของ main agent (`PreToolUse/PostToolUse/Stop/UserPromptSubmit`) ที่ล้าง `waiting` (`lib/store.ts:248-250`) → ระยะเวลา = `receivedAt` ต่าง
- **ข้อจำกัดที่ต้องบอกตรง ๆ:** ไม่มี hook ตอนกด grant (`lib/attention.ts:25`) → เวลาที่วัดเป็น "ขอบบน" (รวมเวลาที่เครื่องรัน tool ต่อหลัง grant) ติดป้าย "≤" ใน UI; รอเกิน 10 นาทีถือว่าคนไม่อยู่ ไม่นับ (สมมติฐานค่า cutoff, ปรับได้)
- วันที่ใช้เวลาท้องถิ่น; เก็บในหน่วยความจำ server + dump ลง `.guild/` ไฟล์ JSON รายวัน (ข้ามรีสตาร์ท)

**แสดงอะไร (DOM ≥12px ในแผงด้านข้าง ไม่แตะ canvas):** แถบ "💸 ภาษี permission วันนี้ ≤ 27 นาที / 41 prompt" + ตาราง top 5 ของ (tool, รูปแบบ command) พร้อมจำนวนครั้ง, นาทีรวม, และปุ่ม **Copy rule** ที่ให้ข้อความ `"Bash(npm test:*)"` สำหรับ `permissions.allow` ใน settings.json
- กฎความปลอดภัย: ไม่แนะนำ rule สำหรับ `rm`, `sudo`, `git push`, `curl|sh`, `chmod`, `>` redirect ฯลฯ (denylist ใน `lib/timeledger.ts`) และแนะนำ prefix แคบเท่านั้น — ต้องให้คนกดคัดลอกเอง, ระบบไม่เขียน settings ให้
- **Demo moment:** เปิด 3 session ให้ขอ `npm test` ซ้ำ → ตารางขึ้น "npm test ×6 ≈ 4.2 นาที → [Copy rule]" → วาง rule → รันอีกรอบ prompt หายและตัวนับหยุดเพิ่ม

## ทำไมคุ้ม
- ตัดต้นทางของเวลารอ (ไม่ใช่แค่เตือนให้ไวขึ้นแบบ Bell): prompt ที่ซ้ำหายถาวร 1 rule = ประหยัดทุกวัน
- ใช้ท่อข้อมูลที่พิสูจน์แล้ว (ingest + dedupe + fingerprint); ไม่ต้อง hook ใหม่ ไม่ต้องขวาง hook

## ตัวชี้วัด + kill criterion
- **ตัวชี้วัด:** (1) หลังใช้ 5 วันทำการ จำนวน prompt/วัน ที่ตรงกับ rule ที่คัดลอกไปลดลง ≥50% เทียบวันแรก (วัดจากตัวนับเดียวกัน) (2) ≥1 rule ถูกคัดลอกต่อสัปดาห์ (บันทึก counter ฝั่ง server)
- **Kill:** ถ้าหลัง 5 วัน เวลา "≤" รวมเฉลี่ย <5 นาที/วัน (ไม่มีอะไรให้ประหยัด) หรือ top-5 ไม่มีกลุ่มใดซ้ำ ≥3 ครั้ง → ถอดแผงออก ไม่ทำต่อ; ถ้า error ของขอบบนเกิน 2 เท่าในการวัดคู่ด้วยนาฬิกาจับเวลา 5 prompt → ปิดตัวเลขนาที เหลือแค่จำนวนครั้ง

## ขอบเขต MVP (≈330 บรรทัดรวม test)
- `lib/timeledger.ts` (~150): `TimeLedger` class, inject `now`, ingest event → เปิด/ปิด wait (key = session_id, ไม่นับ `agent_id`), group ด้วย fingerprint, denylist, `suggestRule()`, `toJSON()`
- `lib/store.ts` (+~25): สร้าง tracker, ingest คู่ `attention.ingest` (ใช้ RAW event), bump `STORE_VERSION` (ตอนนี้ 10, บรรทัด 55), ล้างใน `dropSession`, flush ไฟล์ใน sweep timer 30s เดิม (บรรทัด 67)
- `components/OfficeApp.tsx` (+~60): section พับได้ถัดจาก 🔔 คิว + ปุ่ม Copy
- `tests/timeledger.test.ts` (~95): (1) wait เปิด-ปิดถูกด้วย `now` ฉีด (2) PermissionRequest+Notification คู่กันนับครั้งเดียว (3) รอ >10 นาทีไม่นับ (4) subagent event ไม่ปิด wait ของ main (5) grouping: `npm test` ต่าง timestamp = กลุ่มเดียว (6) denylist ไม่แนะนำ `rm -rf`/`git push` (7) session ถูก drop แล้ว state ล้าง (8) event หลัง SessionEnd ไม่เปิด wait

## ความเสี่ยง + วิธีกัน
- ตัวเลขนาทีเกินจริง (ไม่มี grant hook) → ป้าย "≤", cutoff 10 นาที, kill criterion วัดคู่นาฬิกา
- rule กว้างเกินเปิดช่องอันตราย → denylist + prefix แคบ + คนกดคัดลอกเอง + เตือนข้อความ "ตรวจก่อนวาง"
- `tool_input` ถูก `slim` ตัดสตริงยาว (`lib/store.ts:287`) → ใช้ RAW event ก่อน slim เหมือน attention; เก็บเฉพาะ fingerprint+label สั้น ไม่เก็บ command เต็ม (กันความลับรั่วลงไฟล์)
- ซ้ำซ้อน Bell → ไม่แตะคิว/ลำดับ; อ่านข้อมูลย้อนหลังเท่านั้น
