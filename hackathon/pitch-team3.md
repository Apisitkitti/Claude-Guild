# Team 3 (ทีมโจรสายโชว์) — "Quest Chronicle" บันทึกตำนานประจำวัน

**One-liner:** กดปุ่มเดียว ได้ "การ์ดตำนานกิลด์" ภาพ pixel แบบ shareable (PNG) พร้อม timelapse ย่อ 1 วันของกิลด์เป็นคลิป 10 วินาที — สรุปว่าวันนี้ใครสู้บอสไหน เก็บ XP/ทองเท่าไร ฟื้นจากความล้มเหลวกี่ครั้ง

## ปัญหา / ทำไมต้องมี
Guild สนุกตอนดูสด แต่ปิดจอแล้วทุกอย่างหาย ไม่มีอะไรให้โชว์เพื่อนร่วมทีม/โพสต์ลงโซเชียล และคนใช้ Claude Code ไม่เห็นภาพรวมว่า "วันนี้ AI ทำงานให้เราไปเท่าไร" ฟีเจอร์นี้เปลี่ยน activity ดิบให้เป็นเรื่องเล่าที่อยากแชร์

## ทำงานยังไง (user-facing)
1. ปุ่ม "📜 Chronicle" บน HUD เปิด modal สรุปของวัน (หรือช่วงเวลาที่เลือก, กรองตามโปรเจกต์ได้ด้วยตัวกรองเดิม)
2. **Recap card** วาดบน canvas ขนาด 1200x630: ตัวละคร top adventurer + ฉลากตำแหน่ง (เช่น "Bash Berserker", "Reader of Scrolls" ตาม tool ที่ใช้มากสุด), สถิติ (มอนสเตอร์ที่ล้ม, บอสที่ฆ่า, level up, squire ที่เรียกใช้, ทอง, จำนวนครั้งที่ล้มแล้วลุก), กราฟ heatmap ชั่วโมงทำงานแบบ pixel
3. **Timelapse:** เล่นเหตุการณ์ทั้งวันซ้ำด้วย engine เดิมที่ความเร็ว 60-300x (สะสมนักผจญภัยเข้า-ออกกิลด์, บอสโผล่/ตาย, mana bar พุ่ง) แถบ scrub ด้านล่าง
4. ปุ่ม "Save PNG" / "Copy" / "Record GIF-WebM" (MediaRecorder จาก canvas.captureStream)

**Demo moment:** กรรมการกดปุ่ม → หน้าจอกรอกลับเป็น timelapse 10 วินาที เห็นกิลด์คึกคัก บอสตัวใหญ่ล้มกลางเพลง จบด้วยการ์ดตำนานเด้งขึ้นพร้อมเอฟเฟกต์ confetti pixel แล้วกด Copy วางลง Slack ต่อหน้ากรรมการได้ทันที ทำจาก session จริงที่รันอยู่บนเครื่อง

## ใช้ข้อมูลอะไร / มีอยู่แล้วตรงไหน
- Event ทั้งหมดผ่าน `addEvent` ใน `lib/store.ts` (session_id, cwd, tool_name, agent_id/agent_type, PostToolUseFailure + duration_ms, Stop, PreCompact) และถูกส่ง SSE ไปยัง `OfficeApp.tsx` → engine ทุกอัน
- Engine มี logic XP/level/gold/boss/squire อยู่แล้ว (`lib/office/engine.ts`) และมี seam headless จาก PLAN-next S1 — timelapse = ป้อน event log เก่าเข้า engine ตัวที่สอง ไม่ต้องเขียน logic ใหม่
- `lib/office/render.ts` + `sprites.ts` วาด pixel อยู่แล้ว — card ใช้ sprite ชุดเดียวกัน
- ที่ยังขาด: เก็บ log ยาวกว่า `MAX_EVENTS = 200` (ตอนนี้ ring buffer เล็กเกินไป)

## ขอบเขต MVP (1 รอบ) vs ต่อยอด
**MVP:** (a) เก็บ compact log ฝั่ง client ใน IndexedDB (เฉพาะ ts, session short id, event name, tool_name, ผลสำเร็จ/ล้ม, duration) ไม่เก็บ input (b) ฟังก์ชัน `computeChronicle(log)` ล้วนๆ + unit test (c) modal + recap card + Save PNG (d) timelapse เล่นซ้ำด้วย engine headless ความเร็วเลือกได้
**ต่อยอด:** บันทึก WebM/GIF, สรุปรายสัปดาห์, ambient TV mode ที่เล่น highlight วนลูป, สีการ์ดตาม rank, share link แบบ static

## ความเสี่ยง / privacy / ข้อจำกัด
- ไม่เก็บ prompt, tool_response หรือ path เต็ม — ชื่อโปรเจกต์ใช้ basename และมีสวิตช์ "ซ่อนชื่อโปรเจกต์" ก่อน export (การ์ดไปอยู่ภายนอกเครื่อง)
- Log อยู่ในเบราว์เซอร์เท่านั้น มีปุ่ม Clear; การ์ดสร้างฝั่ง client ไม่ส่งออกเซิร์ฟเวอร์
- เสี่ยงทางเทคนิค: engine ต้อง deterministic พอสำหรับ replay (ใช้ Math.random ผ่าน seed จาก ts); MediaRecorder ต่างกันตามเบราว์เซอร์ จึงเป็น stretch ไม่ใช่ MVP
- ข้อมูลเริ่มสะสมหลังเปิดฟีเจอร์ (ไม่ย้อนหลัง); demo mode ใช้ log จำลองเพื่อให้โชว์ได้เสมอ

## ประเมินแรง: **M**
ไฟล์หลัก: ใหม่ `lib/office/chronicle.ts` (+ test ใน `tests/`), ใหม่ `components/ChronicleModal.tsx`; แก้เล็กน้อย `components/OfficeApp.tsx` (ปุ่ม + log recorder), `lib/office/engine.ts` (รับ clock/time scale ภายนอก), `lib/office/render.ts` (draw ลง offscreen canvas)
