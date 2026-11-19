# 🏆 Claude Guild AI Hackathon รอบ 2 — ผลการตัดสิน (2026-11-19)

ผู้ pitch: Sonnet 4 ทีม · กรรมการ: Opus 3 ท่าน (A ผลิตภัณฑ์ · B วิศวกรรม · C เกมดีไซน์)
เกณฑ์: 2×Impact + Delight + Feasibility + Theme + Risk (เต็ม 60 ต่อกรรมการ, รวม 180)
ขอบเขตรอบนี้: เครื่องเดียว (MCP / แชร์ข้ามเครื่องพักไว้ก่อน)

| อันดับ | ทีม | ฟีเจอร์ | A | B | C | รวม |
|---|---|---|---|---|---|---|
| 🥇 | 3 โจร | Lookout Bell — กระดิ่งยามเฝ้า: คิว "ใครต้องการฉันก่อน" | 47 | 47 | 47 | **141** |
| 🥈 | 1 นักรบ | Berserk Watch — นักรบคลั่ง (จับ session วนลูป) | 46 | 45 | 46 | **137** |
| 🥉 | 2 จอมเวท | Mana Ledger — บัญชีมานา (พยากรณ์ context) | 40 | 41 | 41 | **122** |
| 4 | 4 นักบวช | Infirmary — โรงพยาบาลสนาม | 41 | 38 | 39 | **118** |

ผู้ชนะเป็นเอกฉันท์ 3/3 เสียง — ทีม 1 ตามมาห่าง 4 คะแนน

## กรรมการทั้ง 3 เห็นตรงกัน: รวมทีม 1 + 3 + 4 เป็นฟีเจอร์เดียว
ทั้งสามทีมสร้างตัวจับลูปฝั่ง server แบบเดียวกัน — ใช้ **คิวของทีม 3 เป็นแกน** ลูปเป็นแค่ "เหตุผลหนึ่ง" ในคิว
- **ตัวจับลูป (B):** โมดูลเดียวฝั่ง server, key = `(session_id, agent_id ?? "main")`, dedupe ด้วย `tool_use_id`, ข้าม `is_interrupt`
  - fingerprint จาก payload ดิบ **ก่อน** `slim` / `DROP_KEYS` ใน `lib/store.ts` ลบ `tool_response` / `last_assistant_message`
  - ลูป = fingerprint เดิม fail ≥3 ครั้งใน 5 นาที ด้วย error เดิม (ตัดตัวเลข/เวลาออกก่อนเทียบ)
  - reset เมื่อ Edit/Write สำเร็จ, UserPromptSubmit หรือ Stop; ไม่ทำ ping-pong (hook async ลำดับไม่แน่นอน)
- **B ค้านทีม 1:** hash ของ `tool_response` พลาดเคสหลัก — test ที่ fail มาเป็น `PostToolUseFailure.error` ไม่มี response และ output มีเวลาที่เปลี่ยนทุกครั้ง
- **ภาพ (C):** รายละเอียดเหตุผลอยู่ใน DOM (≥12px) — บน canvas แค่ไอคอนทึบแบบเดียวกับ ❗; ท่า **Berserk ของทีม 1** ใช้แสดงสถานะ 🔁 ลูปบนตัวละคร; NPC ที่เคาน์เตอร์สั่นกระดิ่งที่วาดไว้อยู่แล้ว
- **C เตือน:** แถบ rage 5 ช่องชนตำแหน่งกับ HP ดวล 3 ช่อง; Infirmary ซ้ำกับหัวใจ/คลาสนักบวช และ 6 ประเภทเตือนรกเกิน
- **ใบวินิจฉัย + ปุ่ม Copy (ทีม 1/4):** ข้อความให้คนแปะเตือน Claude เอง — hook async เตือนได้ ขวางไม่ได้
- "ถามคำถามค้างไว้" เดาจากท้าย `last_assistant_message` ต้องติดป้ายว่าเป็นการเดา

## ข้อแก้ที่ต้องทำใน `lib/store.ts` (B)
- bump `STORE_VERSION`, รัน sweep ของ tracker ใหม่ใน timer 30s เดิม, ล้าง state ใน `dropSession`
- ทดสอบด้วย vitest ฉีด `now` แทน curl script
- event ที่ body เกิน 1MB โดน 413 หายทั้งตัว — อย่าพึ่ง response ใหญ่

## ทีมรองที่ควรเก็บไว้
- ทีม 2 Mana Ledger: มีประโยชน์ แต่ `lib/transcript.ts` อ่านแค่ tail 256KB → ต้องเขียน parser แบบต่อเนื่องใหม่; attribution ต่อไฟล์เป็นค่าประมาณ
- ทีม 4 Infirmary: ไอเดียเตือนให้คนพักเก็บไว้ได้; ชื่อ `lib/health.ts` ชนกับ `app/health/route.ts`
