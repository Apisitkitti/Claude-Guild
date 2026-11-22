# Rebuttal ทีม 3 "โจร" — Permission Tax (ตอบ R3-1..R3-6; ยอมรับทั้ง 6 ข้อ, หักล้าง 0)
(pitch ต้นฉบับไม่ถูกแก้ — ฉบับนี้คือแผนที่ใช้แทน)

**R3-1 tautology — ยอมรับ.** rule ที่วางแล้วทำให้ prompt หาย "ตามนิยาม" จริง เลิกใช้ metric นั้น
- แผนแก้: ตัวชี้วัดหลัก = **นาทีรอรวมของ *ทุก* prompt ต่อวัน** (ประมาณการตาม R3-2) เฉลี่ย 5 วันหลังติดตั้ง เทียบ baseline 5 วันแรก ต้องลด ≥30% และ **จำนวน prompt ต่างชนิด (distinct tool+prefix) ต้องไม่เพิ่ม** (กันผลแทนที่: rule ปิดตัวหนึ่ง แต่ตัวใหม่โผล่)
- Kill: นาทีรอรวมไม่ลด ≥15% หลัง 5 วัน หรือ baseline <5 นาที/วัน → ถอดแผง

**R3-2 นาทีพองด้วยเวลารัน tool — ยอมรับ (ข้อที่ร้ายแรงที่สุด).** ตรวจแล้ว: ไม่มี hook ตอน grant (`lib/attention.ts:25-26`) และ wait ปิดที่ event ถัดไป (`lib/store.ts:248-250`) ซึ่งหลัง grant คือ PostToolUse หลัง tool รันจบ — จริง
- แผนแก้: แยกวิธีปิด wait เป็น 2 ชนิด
  1. ปิดด้วย `UserPromptSubmit`/`Stop`/`PreToolUse` ของ `tool_use_id` อื่น → วัดเป็นนาทีได้ (คนตอบจริงหรือ agent ไปต่อ) — แต่ PreToolUse ผ่าน async มาช้าได้ จึงยังเป็นขอบบน ติดป้าย "≤"
  2. ปิดด้วย `PostToolUse` ของ **tool_use_id เดียวกัน** (ปิดหลังรันจบ) → **ไม่ใช้ gap ดิบ** นับเป็น "1 prompt" แล้วคิดเวลาด้วยค่าประมาณ = มัธยฐาน "ปฏิกิริยาคน" ที่ **วัดเองจาก tool เร็ว** (Read/Edit/Glob/Grep ที่รันเสี้ยววินาที gap ≈ เวลาคนล้วน ๆ) ไม่มีตัวอย่างพอ (<5) ใช้ค่าตั้งต้น 15 วินาที ติด "สมมติฐาน" และแสดงเป็น "~"
- demo เปลี่ยนจาก `npm test` เป็น `git status`/`npm run lint` (รันสั้น) เพื่อไม่ให้ตัวเลขปนเวลารัน; test ยืนยันว่า Bash ที่รัน 5 นาทีไม่ทำให้ wait = 5 นาที

**R3-3 ความเป็นส่วนตัว/.gitignore — ยอมรับ.** ตรวจแล้ว: `grep guild .gitignore` ไม่เจอ และ label คือ `target` ตัด 80 ตัวแรกของคำสั่ง (`lib/attention.ts:127`) มี token ได้ — จริง
- แผนแก้: **ไม่เก็บ label/คำสั่งเลย** ลง disk หรือ memory ระยะยาว เก็บเฉพาะ `rule` ที่สร้างแล้ว (เช่น `Bash(npm run lint:*)` — ไม่มีอาร์กิวเมนต์ จึงไม่มี secret) + ตัวนับ/นาที; เพิ่ม `.guild/` ใน `.gitignore` (+1 บรรทัด); ไฟล์รายวันเขียน mode 0600; test: คำสั่ง `curl -H "Authorization: Bearer abc" x` ไม่ทำให้ `abc` โผล่ใน JSON ที่ persist

**R3-4 สร้าง prefix จาก hash ไม่ได้ — ยอมรับ.** `fp` เป็น fnv (`lib/attention.ts:127`) สร้าง rule ไม่ได้ จริง
- แผนแก้: สร้าง rule จาก **คำสั่งดิบตอน ingest** (ก่อน slim) ด้วย `suggestRule(tool, input)` แล้วทิ้งคำสั่ง เหลือแค่ rule string เป็น group key: Bash → ตัดเฉพาะ 1-2 token แรกที่เป็น subcommand ใน allowlist (`npm run X`, `git status|diff|log`, `pnpm test`, ฯลฯ); **คำสั่งประกอบ (`&&`, `;`, `|`, `$(`, backtick, redirect) และ env prefix (`FOO=1 …`) → ไม่เสนอ rule** เพราะ prefix match ไม่ครอบและกว้างเกินไป (`cd x && npm test` ไม่เสนอ ไม่ตัด `cd` ทิ้ง) ; Edit/Write/Read → เสนอ rule ระดับโฟลเดอร์เฉพาะที่ไม่เกี่ยวกับ denylist
- `permission_suggestions` ใน payload: repo ไม่เคยอ้างถึง (`grep` ใน lib/hooks/tests/app = 0) → **สมมติฐาน** ว่ามี; ถ้า field มีจริงจะใช้เป็นตัวเลือกแรก ถ้าไม่มี ใช้ตัวสร้างของเราเอง (ไม่ใช่แกนหลัก)
- test: `cd x && npm test` → ไม่มี rule, `FOO=1 npm test` → ไม่มี rule, `npm test` → `Bash(npm test:*)`, `rm -rf`/`git push`/`sudo` → ไม่มี rule
- ย้ำ: เป็นข้อความให้ **คัดลอก ผู้ใช้วางเอง** — ระบบไม่เขียน settings ไม่ว่ากรณีใด

**R3-5 ซ้อน Bell/ข้าม subagent — ยอมรับบางส่วน.** ข้อเท็จจริงถูก: `lib/store.ts:243` ข้ามเหตุการณ์ที่มี `agent_id`; แต่ Bell เก็บแค่ wait ปัจจุบันของ main (`lib/attention.ts:264-268`) ไม่มีประวัติ/ผลรวม/การจัดกลุ่ม จึงไม่ซ้ำหน้าที่ — ledger อ่านอย่างเดียว ไม่แตะคิว
- แผนแก้: ledger ใช้ key `(session_id, agent_id ?? "main")` นับ subagent ด้วยป้าย "intern" แยกคอลัมน์; UI มีบรรทัด "นับเฉพาะ prompt ที่ hook ส่งมา; subagent แยกป้าย" ; test: PermissionRequest ของ subagent ไม่ปิด/เปิด wait ของ main แต่ถูกนับในกลุ่ม intern

**R3-6 endpoint ตัวนับคัดลอก — ยอมรับ (ตัดทิ้ง).** metric ใหม่ (R3-1) ไม่ต้องใช้ตัวนับ "คัดลอก" แล้ว → ไม่มี route ใหม่ ไม่มี state ฝั่ง server เพิ่ม ปุ่ม Copy ใช้ `navigator.clipboard` ฝั่ง client ล้วน

## แผน MVP ฉบับแก้ (≈365 บรรทัด)
- `lib/timeledger.ts` (~170): ledger, 2 ชนิดการปิด wait, ตัวประมาณปฏิกิริยา, `suggestRule`, denylist, mask/ไม่เก็บคำสั่ง
- `lib/store.ts` (+~25): ingest RAW คู่ attention, bump `STORE_VERSION`, ล้างใน `dropSession`, flush ใน sweep 30s
- `components/OfficeApp.tsx` (+~60): section พับได้ + Copy (client-only) + ป้าย "≤/~" และบรรทัดอธิบาย intern
- `.gitignore` (+1): `.guild/`
- `tests/timeledger.test.ts` (~110): ปิด wait 2 ชนิด / Bash รัน 5 นาทีไม่พอง / มัธยฐานจาก tool เร็ว+ค่าตั้งต้น / ตัดรอบ >10 นาที / dedupe PermissionRequest+Notification / intern แยก / suggestRule 6 เคส (ข้างบน) / secret ไม่รั่วใน persist / drop session ล้าง state / event หลัง SessionEnd ไม่เปิด wait
