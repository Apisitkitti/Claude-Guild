# Plan: Claude Guild ให้มีชีวิต (Opus, 2026-11-17)

ที่มา: [RESEARCH-liveliness.md](RESEARCH-liveliness.md). เป้าหมาย: ดูแล้วรู้สึกว่ามีอะไรเกิดขึ้นตลอด และดูนานๆ แล้วได้รางวัล

## 1. การต่อสู้มีน้ำหนัก (ผลมากสุด)
- **Monster HP** ตามชนิด: slime 3, bat 3, mushroom 4, goblin 5, skeleton 6. ทุก PostToolUse ที่สำเร็จ = ตี 1 ครั้ง
  - ดาเมจ: Bash/Edit/Write 2, อื่นๆ 1, crit 10% ×2
  - หลอด HP 12×2px เหนือหัวมอน
  - HP เหลือ 0 = ตาย: poof, เหรียญ, +XP ลอยขึ้น, ตัวใหม่เกิด (แทนการสุ่ม 30% เดิม)
- **Feedback ตอนตี** (ต่อ hit):
  - ง้าง 150ms ตอน PreToolUse
  - hit-stop 60ms เฉพาะคู่ที่ปะทะ
  - flash ขาว 2 frame
  - เลขดาเมจลอยขึ้น (easeOutBack; crit เป็นสีเหลืองและตัวใหญ่)
  - particle 8 จุด
- **Screen shake** แบบ trauma (amp ≤ 3px, ปัด int): เฉพาะ crit, มอนตาย, failure, boss — ไม่ใช่ทุก hit เพราะถ้ามีหลาย session จะสั่นตลอด
- **Failure**: มอนพุ่งสวน, tint แดง, เลข "-1"
  - นักผจญภัยมี 3 หัวใจ; เสียหัวใจต่อ failure, ไม่ตาย (ค้าง 0 = ทำหน้าเหนื่อย)
  - Stop ไปโรงเตี๊ยมแล้วหัวใจเต็ม

## 2. ระบบสะสม
- **XP**: ต่อ hit 1–3, ฆ่ามอน +5, boss +25. Level threshold = 10 × 1.5^(lv-1)
- **Level up**: แบนเนอร์ "LEVEL UP! Lv.N" เหนือหัว, วงประกาย 24 จุด, flash จอ alpha 0.3
- **Gold**: ฆ่ามอน +1–3, boss +10. แสดงคลังกิลด์รวมใน header
- **Quest complete** ตอน Stop (ถ้ามี ≥3 tool ตั้งแต่ prompt ล่าสุด): ม้วนกระดาษกลางบน 2.5s "เควสสำเร็จ! ⚔️N 💰+G"
- **Boss**: tool ที่ Pre แล้วยังไม่ Post เกิน 30s
  - ogre หรือ dragon ขนาด 24×24 มาแทนมอน, แบนเนอร์ BOSS, shake
  - Post มาเมื่อไรบอสตาย (ทองกับ XP ก้อนใหญ่)
- **เก็บข้าม reload**: localStorage `guild.progress.v1` = { [session_id]: {xp, lv, gold, kills, seen} }, prune > 7 วัน, + `treasury` สะสมตลอดชีพ

## 3. ฉากมีชีวิต
- ผีเสื้อ 3–5 ตัวตอนกลางวัน, นกบินผ่านทุก 20–40s, หิ่งห้อยตอนค่ำ
- ควันปล่องไฟกิลด์, ฝุ่นตอนเดิน
- ฝนตกเป็นครั้งคราว (สุ่มทุก ~10 นาที ตกนาน 60s)
- **พักเมื่อว่าง**: นั่งอยู่เกิน 60s โดยไม่มี event → นั่งข้างกองไฟเล็กๆ (ท่า rest), มอนนอนหลับ "Zzz". event มาเมื่อไรลุกขึ้นสู้ต่อ
- **รอ permission**: vignette แดงกะพริบที่ขอบจอ + "!" เดิม (ข้อนี้ปิดไม่ได้ เพราะคือจุดประสงค์หลัก)

## 4. Panel
- การ์ด: Lv, หลอด XP, หัวใจ, ทอง, จำนวนมอนที่ฆ่า
- header: 💰 คลังกิลด์

## ไม่ทำรอบนี้
Mana bar (context %) — hook ไม่มี token; prompt bubble — server ตัด prompt ทิ้ง; เสียง

## แบ่งงาน (Sonnet 3 ตัวพร้อมกัน แล้ว Opus ตรวจ)
| Agent | ไฟล์ | งาน |
|---|---|---|
| A world | engine.ts, render.ts, layout.ts, sim.ts | ข้อ 1–3 ทั้งหมด (state + วาด) |
| B sprites | sprites.ts, palette.ts | sprite ใหม่ตาม contract |
| C panel | OfficeApp.tsx, globals.css | ข้อ 4 |

### Contract
- **sprites**:
  - `bossSprite(kind: "ogre"|"dragon", frame, hurt)` 24×24 หันซ้าย
  - Pose เพิ่ม `"rest"` (นั่งพื้น)
  - prop ใหม่: `butterfly0/1`, `bird0/1`, `firefly`, `smoke0/1/2`, `dust0/1`, `zzz`, `heart_empty`, `campfire0/1`, `crit` (ดาวเล็ก), `gold_icon`
- **engine → panel**:
  - `RosterRow` เพิ่ม optional `level, xp, xpNext, gold, kills, hp, hpMax`
  - `OfficeView` เพิ่ม optional `treasury`
