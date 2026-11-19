# 🗝️ Lookout Bell — กระดิ่งยามเฝ้า: คิว "ใครต้องการฉันก่อน" + จับ session ที่วนลูป/ติดหล่ม

**One-liner:** ยามเฝ้ากิลด์ที่เรียงลำดับว่า session ไหนต้องการคุณก่อน (ถามคำถามค้าง / วนลูปแก้ซ้ำ / งานเสร็จรอรีวิว / context ใกล้เต็ม) พร้อมเหตุผลสั้น ๆ ในบรรทัดเดียว — ไม่ต้องเปิดหลายหน้าต่างไล่ดูทีละอัน

## ปัญหา
- รัน Claude Code 4-6 session พร้อมกัน สิ่งที่แพงที่สุดคือ "ความสนใจของคุณ" ไม่ใช่ token. ตอนนี้กิลด์บอกได้แค่ ❗ (รอ permission) กับ ⚔️ (ชนไฟล์)
- เคสที่เจ็บจริงและยังไม่มีใครเตือน: (1) session วนลูป — รัน test เดิมพังเดิมซ้ำ 8 รอบ เผา token เป็นชั่วโมงโดยไม่มีใครรู้ (2) Claude หยุดเพราะ "ถามคำถามกลับ" แต่ดูเหมือนเสร็จแล้ว คุณลืมตอบนาน (3) หลาย session เสร็จพร้อมกัน ไม่รู้จะไปดูอันไหนก่อน

## ทำงานยังไง
**Data source (ทั้งหมดมีอยู่แล้วใน hook ที่ติดตั้ง ไม่ต้องเพิ่ม hook):**
- **Loop detector:** `PreToolUse` (`tool_name`, `tool_input`) + `PostToolUseFailure` (`tool_name`, `error`). server เก็บ ring buffer 12 รายการ/session ของ `hash(tool_name + normalized tool_input)` (Bash → command ตัดเลขล้วน/timestamp; Edit → file_path + hash(old_string)). เกณฑ์: hash เดิมซ้ำ ≥3 ครั้งใน 5 นาที *และ* ล้มเหลวอย่างน้อย 2 ใน 3 → "🔁 วนลูป: `npm test` ล้มซ้ำ 4 ครั้ง". ยังมีแบบ ping-pong A→B→A→B (edit ไฟล์เดิมสลับกับ test พัง)
- **Asked-you detector:** `Stop` มี `last_assistant_message` (store ทิ้งฟิลด์นี้ตอน sanitize อยู่ → อ่านก่อนทิ้ง เก็บแค่ boolean + 80 ตัวอักษรท้าย). ถ้าลงท้ายด้วย `?`/`ไหม`/`คะ|ครับ?`/"Would you like"/"Should I" → "💬 รอคำตอบคุณ" ต่างจาก "✅ เสร็จ รอรีวิว". เสริมด้วย `Notification` (`notification_type: idle_prompt`) ที่ Claude Code ยิงหลังรอเกิน ~60 วิ
- **Context pressure:** มี `context.used/limit` จาก transcript อยู่แล้ว → ≥85% ขึ้น "🗜️ context ใกล้เต็ม"
- **Triage queue** (server คำนวณใน `lib/store.ts`, ส่งใน snapshot/SSE): `{sid, reason, since, severity}` เรียง: permission > loop > ถามคำถาม > context > เสร็จรอรีวิว; ในระดับเดียวกันเรียงตามรอนานสุด
- **แสดงผล:** แถบ "🔔 คิวของคุณ" ในแผงกิลด์ (2-4 แถว, คลิกแล้วกล้อง/โฟกัสไปที่ตัวละคร) + ป้ายเหนือหัวตัวละครเป็นไอคอนทึบบนพื้นทึบ (ไม่ทับ/ไม่ทำให้ตัวละครโปร่งใส) + ปุ่มลัด `N` = ไปที่ session ถัดไปในคิว + title tab `🔔(3)` รวมกับของเดิม
- **Demo moment:** เปิด 3 session; session A ถูกสั่งให้รัน test ที่พังเดิม → ตัวละครขึ้น 🔁 + คิวขึ้นแถวแดง "วนลูป 4 ครั้ง" ใน ~30 วิ ก่อนที่คุณจะเห็นใน terminal; session B จบด้วยคำถาม → "💬 รอคุณ 2 นาที"; กด `N` กระโดดไปทีละตัว

## ทำไมคุ้ม
- แก้ปัญหา multi-session จริง: เปลี่ยนกิลด์จาก "ของสวยดูเล่น" เป็นเครื่องมือตัดสินใจว่า "ไปดูอันไหนต่อ"
- การจับวนลูปประหยัดเงินจริง (token ที่ไม่ควรเผา) และ logic ล้วน ๆ ฝั่ง server ทดสอบด้วย curl ได้ ไม่ต้องพึ่ง canvas
- ต่อยอดของเดิม (waiting/notify/context/clash) ไม่ใช่ระบบใหม่ → ขนาดเล็กแต่ผลกระทบเห็นชัด

## ขอบเขต MVP (~1 วันของคน 1 คน, ~350 บรรทัด)
- `lib/attention.ts` (ใหม่, ~150 บรรทัด, คลาสแบบ `TerritoryTracker`: `ingest(evt)`, `queue()`, `sweep()`) + unit-ish test ด้วย curl script
- `lib/store.ts`: อ่าน `last_assistant_message` ก่อน sanitize, ต่อ tracker, ใส่ `attention` ใน snapshot/SSE, bump STORE_VERSION
- `components/OfficeApp.tsx` + css: แถบคิว, ปุ่ม `N`, รวม title; `lib/office/render.ts`: ป้ายไอคอนเหนือหัว (ทึบ) — ใช้ pattern เดียวกับ ❗
- **ไม่ทำใน MVP:** auto-kill/สั่งหยุด session, เสียง, ข้อความ LLM สรุป, เก็บประวัติข้าม restart

## ความเสี่ยง + วิธีกัน
- **แจ้งผิด (false positive):** รัน test ซ้ำหลังแก้โค้ดเป็นเรื่องปกติ → นับเฉพาะ hash เดิมที่ *ล้มเหลวติดกัน* และ reset เมื่อมี Edit/Write ที่สำเร็จคั่น (input เปลี่ยน = ไม่ใช่ลูป); ตั้งเกณฑ์ใน const เดียวปรับง่าย; แต่ละแถวกด ✕ ปิดได้ (ไม่เตือนซ้ำจนกว่า hash ใหม่)
- **Heuristic "ถามคำถาม" ไม่แม่น:** บอกตรง ๆ ว่าเป็นการเดา — ใช้ป้ายกลาง "💬 น่าจะรอคุณ" ไม่ใช่ fact; ถ้าไม่มี `last_assistant_message` (เวอร์ชันเก่า) fallback เป็น "✅ เสร็จ" เฉย ๆ
- **hooks เป็น async:** เตือนได้แต่ขวาง/หยุด session ไม่ได้ และมี delay เล็กน้อย — ข้อความเป็น "ดูหน่อย" ไม่ใช่ "หยุดแล้ว"
- **ความเป็นส่วนตัว:** `last_assistant_message`/`tool_input` อาจมีความลับ → เก็บแค่ hash + ท้ายข้อความ ≤80 ตัวอักษร ใน memory ไม่เขียนดิสก์ ไม่ส่งออกนอก localhost
- **Notification event เปลี่ยนตามเวอร์ชัน:** อย่าพึ่ง `idle_prompt` อย่างเดียว — ตัวหลักคือ `Stop` + เวลาที่ผ่านไป
- **Thai readability:** ข้อความเหตุผลเป็นแถว HTML ปกติ (ไม่วาดบน canvas) ขนาด ≥12px
