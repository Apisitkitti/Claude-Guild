# 🔥 Berserk Watch — "นักรบคลั่ง" เตือนทันทีเมื่อ session วนลูปเผา token
**One-liner:** จับ session ที่ติดวงวน (สั่งคำสั่งเดิมซ้ำ, fail ซ้ำ, แก้ไฟล์เดิมไม่จบ) แล้วให้ตัวละครเข้าสู่โหมด Berserk พร้อมบอกเหตุผลเป็นภาษาคน ก่อนที่คุณจะกลับมาเจอ context เต็มและงานเป็นศูนย์

## ปัญหา
คนที่เปิด 3-5 session แล้วเดินไปทำอย่างอื่น มักกลับมาเจอว่า agent รัน `npm test` ซ้ำ 15 รอบ, Edit ล้มซ้ำ ๆ, หรือสลับแก้ A↔B ไม่จบ — เสีย token/เวลา และ context ใกล้เต็มโดยไม่มีสัญญาณ Guild วันนี้บอกว่า "ใครทำอะไร" (และ context %) แต่ไม่แยก "ทำงานคืบหน้า" ออกจาก "ฟาดลมอยู่กับที่" ซึ่งเป็นสิ่งที่ dev อยากรู้ที่สุดตอนไม่ได้เฝ้าจอ

## ทำงานยังไง
**ข้อมูล (ทั้งหมดมีใน hook อยู่แล้ว ไม่ต้อง hook ใหม่):**
- `PreToolUse`: `tool_name`, `tool_input` (`command` / `file_path` / `pattern`), `tool_use_id`, `session_id`, `agent_id` → ทำ fingerprint = hash(tool_name + input ที่ normalize แล้ว)
- `PostToolUse`: `tool_response` (store ตัดทิ้งตอน slim อยู่แล้ว → ต้องเพิ่ม hash ของ response/exit-code **ก่อน** slim ใน `store.ts` แล้วเก็บเฉพาะ hash 8 ตัว ไม่เก็บเนื้อหา)
- `PostToolUseFailure`: `error` (prefix 60 ตัวอักษร), `is_interrupt`; `Stop`/`UserPromptSubmit` = รีเซ็ตคะแนน (user เข้ามาแทรกแล้ว)
**ตัวตรวจฝั่ง server** (`lib/berserk.ts` แบบเดียวกับ `lib/territory.ts` — ผ่าน reload/หลายแท็บ), ต่อ session ถือ ring buffer 30 รายการ:
1. ซ้ำเป๊ะ: fingerprint เดิม ≥3 ครั้งใน 5 นาที **และ** response hash เดิม (รัน test เดิมแล้วผลเหมือนเดิม = วน; ผลเปลี่ยน = กำลังคืบหน้า ไม่เตือน)
2. fail ติดกัน ≥4 ครั้ง (error prefix เดียวกัน) 3. ping-pong A-B-A-B ของไฟล์ที่ Edit 4. แก้ไฟล์เดิม ≥5 ครั้งใน 5 นาที โดยมี failure คั่น
- 2 ระดับ: 🟠 **Rage** (1 สัญญาณ) → 🔴 **Berserk** (2 สัญญาณ หรือ context >70% ระหว่างวน — ใช้ `context` จาก transcript ที่มีอยู่)
**สิ่งที่เห็น:** ตัวละครขึ้น sprite โหมดคลั่ง (ผมตั้ง, ตาแดง, ฟาดดาบใส่อากาศเร็วขึ้น — เป็นเฟรมใหม่ opaque ไม่ใช่ overlay/tint), เหนือหัวมี "Rage meter" แถบ pixel ทึบ 5 ช่อง, ศัตรู (monster) ตัวเดิมไม่ตายซ้ำ ๆ + ตัวนับ `x4` ลอยข้าง, roster ขึ้นเหตุผลไทย เช่น "รัน `npm test` ซ้ำ 4 รอบ ผลเหมือนเดิม" / "Edit `auth.ts` ล้ม 4 ครั้งติด" พร้อมปุ่ม **คัดลอกข้อความช่วย** (ร่างข้อความให้ user วางเองใน session เช่น "หยุดรัน X ซ้ำ ลองอธิบายว่าคิดอะไรอยู่ก่อน") + ชื่อแท็บ `🔥(1)` + Desktop Notification ที่มีอยู่
- **Demo moment:** ให้ session จริงรัน test ที่พังแบบวนลูป (หรือปุ่ม sim) → ตัวละครค่อย ๆ ตาแดง meter เต็มทีละช่อง จนแบนเนอร์ "🔥 BERSERK" ฟาดลงจอ พร้อมสาเหตุ; พอ user พิมพ์เข้า session meter ลดและตัวละครสงบลง

## ทำไมคุ้ม
เป็นคำตอบของคำถามที่ dev ถามจริงเวลาแอบทิ้ง session ไว้: "มันคืบหน้าหรือติดอยู่?" ประหยัด token/เวลาจริง ใช้ data ที่มีแล้วเกือบทั้งหมด ไม่ต้องใช้ LLM วิเคราะห์ และต่อยอดจาก Territory/context/alert ที่สร้างไว้ ทำให้งานยาว ๆ ของ agent มี "ดราม่า" ที่มีความหมาย (ความคลั่ง = สัญญาณจริง ไม่ใช่การตกแต่ง) ต่างจาก Almanac/Chronicle ที่ให้ค่าหลังเหตุการณ์ อันนี้เตือน **ระหว่าง** เหตุการณ์

## ขอบเขต MVP (~M, 1 รอบ)
- ใหม่: `lib/berserk.ts` (detector + unit test vitest: ซ้ำ, fail ติด, ผลเปลี่ยน=ไม่เตือน, รีเซ็ตตอน Stop/UserPromptSubmit)
- แก้: `lib/store.ts` (hash response ก่อน slim, เรียก detector, ส่ง SSE `berserk` + ใส่ใน snapshot, bump `STORE_VERSION`), `lib/office/engine.ts` (รับ message, state ต่อ employee, roster row), `lib/office/sprites.ts` + `render.ts` (เฟรมคลั่ง + rage meter + counter), `components/OfficeApp.tsx` (roster reason, ปุ่มคัดลอก, tab title), `lib/office/sim.ts` (สคริปต์ลูปสำหรับ demo)
- ตัดออก: auto-kill/pause, ส่งข้อความเข้า session, ตรวจ Bash ที่เขียนไฟล์, ประวัติย้อนหลัง

## ความเสี่ยง + วิธีกัน
- **เตือนผิด (retry ที่ชอบธรรม เช่น รอ build/poll):** ต้องซ้ำ fingerprint **และ** ผลเดิม; command ที่มี `sleep`/`watch`/`tail -f` ยกเว้น; ปุ่ม dismiss ต่อสัญญาณ; เกณฑ์ปรับได้ใน const เดียว; ข้อความเป็น "น่าสงสัย" ไม่ใช่ "พัง"
- **hook async:** เตือนได้เท่านั้น ขวาง/หยุด agent ไม่ได้ — UI ต้องไม่เขียนว่า "หยุดแล้ว"; มีแค่ร่างข้อความให้ user ไปวางเอง
- **เห็นแค่ที่ hook ส่ง:** ไม่เห็น reasoning/ข้อความของ model และ Claude Code ไม่ส่ง hook ตอนอนุมัติ permission (ตามที่ README บอก) → ช่วงรอ permission ไม่นับเป็นวน
- **Privacy:** เก็บเฉพาะ hash + path/command prefix สั้น ๆ ใน memory ไม่เก็บ tool_response ไม่เขียนดิสก์
- **canvas rule:** meter/ตาแดง/ออร่าวาดเป็นพิกเซลทึบข้าง ๆ หรือเป็นเฟรม sprite ใหม่ ไม่มีอะไรโปร่งใสทับตัวละคร
