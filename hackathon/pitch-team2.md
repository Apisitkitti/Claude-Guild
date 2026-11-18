# Guild Almanac — สมุดบันทึกกิลด์ + Bestiary + Quest Board

**One-liner:** ทุกการทำงานของ Claude Code ถูกบันทึกเป็น "ตำนานกิลด์" ข้ามวัน/ข้ามสัปดาห์: สมุดสะสมมอนสเตอร์ (Bestiary), ภารกิจประจำวัน/สัปดาห์ (Quest Board) และตรารางวัลที่ปลดล็อกจากพฤติกรรมจริง ไม่ใช่ตัวเลขสุ่ม

## ปัญหา / ทำไมต้องมี
ตอนนี้กิลด์สนุกเฉพาะ "ตอนนั้น": XP/ทอง/เลเวลมีอยู่แต่ไม่มีเป้าหมายระยะยาว เปิดวันที่ 5 ก็เหมือนวันที่ 1 ไม่มีเหตุผลให้กลับมาดู และไม่มีอะไรบอกเลยว่าสัปดาห์นี้ Claude ทำอะไรไปบ้าง

## มันทำงานยังไง (user-facing)
ปุ่ม "📖 Almanac" เปิดหนังสือ 3 หน้า:
1. **Bestiary** — มอนสเตอร์แต่ละชนิดผูกกับ tool จริง (Bash=Goblin, Edit=Slime ฯลฯ) ช่องมืดจนกว่าจะเจอ ล่าครบ 10/50/200 ตัว = ดาวบรอนซ์/เงิน/ทอง, มีสถิติ "ตัวที่ใช้เวลานานสุด" (duration_ms)
2. **Quest Board** — 3 ภารกิจ/วัน สุ่มจากแม่แบบ เช่น "ล่า Goblin 20 ตัว", "ผ่าน 5 session โดยไม่เสียหัวใจ", "ฆ่าบอสที่ค้างเกิน 30s 1 ตัว", "ใช้มานาไม่เกิน 70% ทั้งวัน" ทำครบ = ทอง + ตราประทับในปฏิทิน
3. **Chronicle** — ปฏิทินร้อน (heatmap) 8 สัปดาห์ + บรรทัดเล่าเรื่องอัตโนมัติ เช่น "วันอังคาร: อัศวิน claude-office ล้ม Boss 'npm install' หลังต่อสู้ 94 วินาที"

**Demo moment:** กดโหมด demo → มอนสเตอร์ตัวใหม่ตายบนจอ → หน้าต่างลอยขึ้น "✨ ค้นพบ: Wraith แห่ง WebFetch!" ช่องใน Bestiary สว่างพร้อมเสียงเอฟเฟกต์ แล้ว Quest ติ๊กครบ มีตราประทับตกลงบนปฏิทินต่อหน้ากรรมการ

## ใช้ข้อมูลอะไร / มีอยู่แล้วตรงไหน
- `tool_name`, `PostToolUseFailure` (error, duration_ms), Stop, SubagentStart, PreCompact, context mana — engine รับครบแล้ว
- `lib/office/engine.ts` มี persistence (`PROGRESS_KEY`, บรรทัด ~349/372), นับ kills/gold/hearts และเหตุการณ์ boss อยู่แล้ว → แค่ฮุก "event ชนะ/แพ้/บอส" ออกมาเป็น stream ให้ Almanac นับ
- `OfficeApp.tsx` มี panel/modal แบบมีอยู่แล้ว; `tests/engine` มี harness headless ใช้ทดสอบกติกา quest ได้ทันที

## ขอบเขต MVP (1 รอบงาน) vs ต่อยอด
**MVP:** `lib/office/almanac.ts` (pure logic: ตาราง tool→มอนสเตอร์, ตัวนับ, แม่แบบ quest 6 แบบ, สุ่มแบบ seed ตามวันที่) + engine ยิง callback `onFeat(kind, tool, ms)` + persist ใน localStorage แยก key + modal Bestiary & Quest + toast ตอนค้นพบ + unit test
**ต่อยอด:** heatmap/Chronicle, ตราตำแหน่ง (Title) ติดชื่ออัศวิน, ฉากเลื่อนขั้นกิลด์ (Guild Rank → ปลดสกิน/ฉาก), export การ์ดสรุปสัปดาห์เป็นรูป

## ความเสี่ยง / privacy / ข้อจำกัด
- ใช้เฉพาะชื่อ tool, จำนวน, duration — ไม่แตะ prompt/tool_response, ไม่ส่งออกนอกเครื่อง (localStorage เท่านั้น)
- ข้อมูลอยู่ใน browser เครื่องเดียว ล้างแคชแล้วหาย → MVP เพิ่มปุ่ม export/import JSON
- Quest ต้องไม่ล่อให้ "ทำเกินจริง" (ไม่มีภารกิจที่ส่งเสริมให้เรียก tool เปลืองเพื่อเก็บแต้ม) ตรง theme "honest to real activity"
- event ซ้ำตอน reconnect/snapshot → ใช้ `tool_use_id` กันนับซ้ำ (engine เคยมี reconcile แล้ว)

## ประเมินแรง: **M**
ไฟล์หลัก: `lib/office/almanac.ts` (ใหม่), `lib/office/engine.ts` (เพิ่ม hook จุดเดียว), `components/OfficeApp.tsx` + `app/globals.css` (modal/ปุ่ม/toast), `tests/almanac.test.ts` (ใหม่)

**ทำไมชนะ:** เปลี่ยนกิลด์จาก "จอดูเล่น" เป็น "เกมที่อยากกลับมาเช็กทุกวัน" ด้วยข้อมูลจริง 100% ไม่ต้องเพิ่ม hook ใหม่ ความเสี่ยงต่ำ ฟีเจอร์เล็กพอจบในรอบเดียว แต่เห็นผลทันทีบนจอ
