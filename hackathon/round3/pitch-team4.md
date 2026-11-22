# ทีม 4 นักบวช — "Sentinel Ledger" สมุดบันทึกความเสี่ยง + ตรวจก่อนปิดงาน
**One-liner:** ตัวตรวจฝั่ง server ที่อ่าน tool_input ดิบ แล้วจดคำสั่งอันตราย / ไฟล์นอกโปรเจกต์ / secret ใน input / "ปิดงานโดยไม่รัน test" ลงสมุดต่อ session — **เตือนหลังเกิดเหตุ ไม่ใช่ขวาง** (hook เป็น async)

## ปัญหา
คนเปิด 5-10 session พร้อมกัน ไม่มีใครเห็นทุก tool call; `rm -rf`, `git push --force`, แก้ `.env` หรือเขียนไฟล์นอก repo หลุดผ่านไปเงียบ ๆ และ Claude มักพูดว่า "เสร็จแล้ว" โดยไม่รัน test. ตอนนี้ UI ไม่มีที่ไหนบอกเรื่องนี้ (attention.ts มี kind แค่ permission/loop/asked/context/done — `lib/attention.ts:32`)

## ทำงานยังไง
**แหล่งข้อมูล (ทั้งหมดมีอยู่แล้ว):**
- `PreToolUse`/`PostToolUse`/`Stop` ถูกส่งเข้า `/events` แล้ว — `hooks/settings.example.json` (matcher `*` ทั้ง Pre/Post)
- `tool_input` (`command`, `file_path`) และ `cwd` อยู่ใน HookEvent — `lib/store.ts:14-15`; territory ใช้ `cwd`+`file_path` แล้ว — `lib/territory.ts:80-81`, `resolveTarget` `:35`
- **ต้องตรวจจาก raw ก่อน slim**: `slim` ตัด string ที่ 300 ตัวอักษร (`lib/store.ts:270,272`) ทำให้ secret/คำสั่งยาวหลุดการตรวจ; ช่องทางเดิมคือ `store.attention.ingest(raw, …)` ที่ `lib/store.ts:302` — เพิ่ม `store.risk.ingest(raw, …)` ข้างกัน ใต้เงื่อนไข `!lateAfterEnd` เดียวกัน (`:295`)
- ตรวจ Bash แบบเดียวกับที่ attention แยกคำสั่ง — `lib/attention.ts:126`; ชุดเครื่องมือ edit — `lib/attention.ts:30` (`EDIT_TOOLS`)
- `tool_response` ถูกทิ้งใน store (`DROP_KEYS` `lib/store.ts:282`) แต่ `PostToolUse` ยังมาถึงเป็นสัญญาณ "edit สำเร็จ" (ไม่อ่านเนื้อ response)

**กฎ (pure function `classify(event) → Finding[]`):**
1. 🔴 destructive: `rm -rf` นอก tmp, `git push --force`/`-f`, `git reset --hard`, `DROP TABLE|DATABASE`, `chmod -R 777` (regex บน `command`)
2. 🔴 นอกโปรเจกต์: `resolveTarget(cwd, file_path)` ไม่อยู่ใต้ `cwd` (ยกเว้น tmp/scratchpad)
3. 🟠 ไฟล์ลับ: Edit/Write ไป `.env*`, `*.pem`, `id_rsa`, `credentials*`
4. 🟠 secret ใน input: pattern `AKIA…`, `sk-…`, `ghp_…`, `-----BEGIN … PRIVATE KEY` ใน `command`/`content` — **เก็บแค่ชื่อ pattern + 4 ตัวท้าย ห้ามเก็บค่าจริง**
5. 🟡 quality: `Stop` เมื่อมี edit สำเร็จของไฟล์โค้ดและ **ไม่มี** Bash ที่ตรง `test|vitest|jest|pytest|tsc|lint|build` หลัง edit ล่าสุด (นับเฉพาะ PostToolUse ที่ไม่ใช่ failure)

**แสดงผล:** DOM section ใหม่ "🛡 สมุดเสี่ยง" ใน `components/OfficeApp.tsx` (ข้อความไทย ≥12px, ระดับสี + ชื่อ session + คำสั่งตัดสั้นที่ mask แล้ว + ปุ่ม "รับทราบ"). บน canvas: ไอคอน 🛡 ทึบข้างหัวตัวละครที่ session มี finding 🔴 ยังไม่รับทราบ (ไม่ย้อมสี/ไม่โปร่งใสทับตัวละคร). **ไม่ใส่ในคิวกระดิ่ง** เพื่อไม่ชนกับ Lookout Bell
**Demo moment:** สั่ง session หนึ่งรัน `git push --force` → 3 วินาทีต่อมาไอคอน 🛡 โผล่ + แถวแดง "session X: force push (เกิดไปแล้ว ตรวจ git reflog)" พร้อมปุ่ม Copy ข้อความเตือน; อีก session แก้โค้ดแล้ว Stop โดยไม่รัน test → แถวเหลือง

## ทำไมคุ้ม
เป็นสัญญาณที่ "ไม่มีใครเฝ้า" จริง ๆ และต่างจาก Wards รอบ 1 (ที่ถูกวิจารณ์เรื่อง async) ตรงที่ **ยอมรับตรง ๆ ว่าเตือนหลังเหตุ** — ค่าที่ให้คือ "รู้ทันเวลาจะ rollback/rotate key" ไม่ใช่ป้องกัน. ต่างจาก Infirmary รอบ 2 (เตือนคนพัก) เพราะเป็นเรื่องความปลอดภัยของงาน

## ตัวชี้วัด + Kill criterion
- **Precision:** บน fixture ≥40 คำสั่ง Bash/path จริงที่ผมเขียนเอง (20 อันตราย, 20 ปกติ เช่น `rm -rf node_modules`, `git push --force-with-lease` ต้องไม่แดง) → precision ≥90%, recall ≥85%
- **ความหน่วง:** event → แถวใน UI ≤2 วินาที (SSE เดิม)
- **เตือนเกิน:** ในการใช้งานจริง 1 วัน ≤3 แถวแดง/session/ชั่วโมง ที่คนกด "รับทราบ" โดยไม่ทำอะไรเกิน 50% → ถือว่า noisy
- **Kill:** precision <80% หลังปรับ regex 1 รอบ, หรือ กฎ 5 (quality) มี false positive >30% (สมมติฐาน: งานแก้เอกสาร/config จะถูกนับเป็นโค้ดผิด) → ตัดกฎนั้นทิ้ง; ถ้ากฎเหลือ <3 → ยกเลิกฟีเจอร์

## ขอบเขต MVP (≈330 บรรทัด)
- `lib/risk.ts` (~170): `classify`, `maskSecret`, `RiskTracker` (ring ต่อ session สูงสุด 30 แถว, dedupe ด้วย `tool_use_id` เหมือน `attention.ts:214`, `dropSession`, sweep)
- `lib/store.ts` (~25): สร้าง tracker, `ingest(raw)`, snapshot + SSE event `risk` (คู่ `refreshAttention` `:118-121`), bump `STORE_VERSION` (`:55`), ล้างใน `dropSession` (`:125`)
- `components/OfficeApp.tsx` (~60): section + ปุ่มรับทราบ/Copy; `lib/office/render.ts` (~20): ไอคอน 🛡
- `tests/risk.test.ts` (~80, vitest ฉีด `now`): rm -rf ปกติ vs tmp · force vs force-with-lease · path นอก cwd · `.env` · secret ถูก mask (assert ว่าค่าจริงไม่อยู่ใน snapshot/JSON) · command >300 ตัวอักษรยังจับได้ (raw) · dedupe `tool_use_id` · Stop ไม่มี test → เหลือง / มี test หลัง edit → ไม่เตือน / test ก่อน edit → เตือน · late event หลัง SessionEnd ไม่นับ · cleanup เมื่อ dropSession

## ความเสี่ยง + วิธีกัน
- **Async = เตือนช้า:** เรียกชื่อว่า "บันทึก" ไม่ใช่ "ป้องกัน"; UI เขียน "เกิดไปแล้ว" ชัด; ไม่โฆษณาว่าขวางได้
- **เก็บ secret ซ้ำเอง:** mask ที่ tracker ก่อนเข้า snapshot; `evt` ที่ store เก็บผ่าน slim อยู่แล้ว แต่ finding ห้ามอ้าง `evt`; มี test ยืนยัน
- **Regex พลาด/เลี่ยงได้ (`r\m -rf`, base64):** สมมติฐาน: พอสำหรับ "พลั้ง" ไม่ใช่ "ตั้งใจหลบ"; ระบุใน UI ว่าเป็น heuristic
- **ไม่รู้ว่า PostToolUse = สำเร็จจริง (ไม่อ่าน response):** `PostToolUseFailure` แยกอยู่แล้ว (`hooks/settings.example.json`) นับเฉพาะ Post ที่ไม่ใช่ failure
- **Body >1MB โดน 413 หายทั้งตัว** (round2/RESULTS.md): ยอมรับ ไม่พึ่ง response; Write ใหญ่ ๆ อาจไม่ถูกตรวจ secret
