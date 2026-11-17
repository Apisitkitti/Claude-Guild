# Research: ทำ Claude Guild ให้มีชีวิต (2026-11-17, Haiku x2)

ตัวเลขหลายตัวมาจากบทสรุปมือสอง — ใช้เป็นค่าเริ่มต้นแล้วจูนเอง

## โปรเจกต์คล้ายกัน (แรงบันดาลใจ ไม่ลอก)
- **Agents in the Office** — NPC เดินเล่น/คุยกันตอน idle; รอ permission = กล้องซูม + vignette แดงกะพริบ; tool → เดินไปวัตถุที่ตรงกัน
- **Age of Agents** — tool type → อาคาร (forge=edit, mage tower=web, mine=terminal); token เติมโกดัง
- **Claude Quest** — Mana bar = context ที่ใช้ (เหลือง→แดง, เติมตอน compact); biome หมุนเวียน + parallax; error = โดนดาเมจ; git push = แบนเนอร์ "SHIPPED!"
- **Git City** — สถิติสะสมกลายเป็นตึกที่โตขึ้น, achievements
- **Pixel Agents** — sprite ต่อ terminal, bubble ตอนรอ input

## Game juice (เรียงตามความคุ้ม)
1. Screen shake แบบ trauma: shake = trauma² × 4px, decay 0.9/frame, ปัดเป็น int
2. Hit-stop 50–80ms (crit/boss 130ms) — หยุดเฉพาะคู่ที่ปะทะ
3. Hit flash ขาว 2 frame; event ใหญ่ = flash ทั้งจอ alpha 0.3 1 frame
4. Anticipation: ง้าง 2 frame (~150ms) ก่อนตี
5. Squash & stretch ด้วยการสลับ frame (ไม่ scale เศษ), ฝุ่นตอนลงพื้น
6. Damage number: outline 1px, ลอยขึ้น 12px/0.6s easeOutBack, จำกัด ~20 ตัว
7. Particle 6–12 จุด/hit, gravity 0.15px/frame, life 20–30 frame, cap 150
8. Combo counter: tool สำเร็จติดกันภายใน 10s
9. Ambient critters: ผีเสื้อ/นก 3–6 ตัว, หิ่งห้อยตอนค่ำ
10. Idle fidget ทุก 4–9s, กะพริบตา 3–5s, bob 1px
11. Weather (ฝน/หิมะ) + day/night ตามนาฬิกาจริง
12. Level-up fanfare: แบนเนอร์เลื่อนเข้า 1s + วงประกาย 24 จุด + flash
13. Failure: X แดง + tint แดง + มอนสวนกลับ
14. ทุก event มี feedback ≥ 3 ช่องทาง (ท่า, ตัวเลข, flash/เสียง)
15. ควันปล่องไฟ, ประกายไฟ, ฝุ่นตอนวิ่ง

## Progression / meta (มาจาก hook event)
- **XP/Level** ต่อ session: PostToolUse ตามประเภท (Read น้อย, Edit กลาง, Bash มาก), threshold แบบ exponential
- **Gold** จาก tool ที่สำเร็จ + คลังกิลด์รวม
- **Quest complete banner** ตอน Stop (ถ้าผ่านจำนวน tool ขั้นต่ำ) พร้อมสรุป
- **Boss**: PreToolUse→PostToolUse นานเกิน ~60s หรือ session ยาว
- **Achievements**: permission แรก, พังแล้วกลับมาสำเร็จ (Phoenix), 100 tool calls (Centurion)
- **Monster HP**: ตีให้ตายด้วยจำนวน hit แทนสุ่ม 30%

## ข้อจำกัดของระบบเรา
- server ตัด `prompt` / `tool_response` ทิ้ง (privacy) → ไม่มี prompt bubble ถ้าไม่เปิดใหม่
- ไม่มี token/context % ใน hook → Mana bar ต้องอ่าน transcript (ยังไม่ทำ, ใกล้สุดคือ PreCompact)
- engine อยู่ฝั่ง client — reload แล้ว state หาย ถ้าจะเก็บ XP ต้องใช้ localStorage หรือย้ายไป server
