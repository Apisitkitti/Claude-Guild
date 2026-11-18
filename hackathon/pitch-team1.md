# ⚔️ Territory Clash — "ศึกแย่งดินแดน"
**One-liner:** เตือนทันทีเมื่อ 2 session แก้ไฟล์เดียวกัน (หรือ worktree/branch ชนกัน) ก่อนงานจะเขียนทับกันเงียบ ๆ

## ปัญหา
คนที่เปิด Claude Code 3-5 session บน repo เดียวกันมักไม่รู้ว่า session A กำลังแก้ `auth.ts` อยู่ ขณะที่ session B ก็เพิ่งแก้ไฟล์เดียวกัน ผลคือ edit ล้มเหลว (string not found), งานถูกเขียนทับ, merge conflict, เสียเวลา debug และเสีย token ฟรี ตอนนี้ Guild บอกได้แค่ "ใครทำอะไร" แต่ไม่บอก "ใครเหยียบเท้าใคร"

## ทำงานยังไง
- ทุกไฟล์ที่ Edit/Write/NotebookEdit คือ "ดินแดน" ของ adventurer คนนั้น (ถือครอง ~10 นาที หรือจนกว่า Stop/SessionEnd)
- ถ้า session อื่นแตะไฟล์เดียวกันในช่วงถือครอง = **Clash!** บน canvas: ดาบไขว้ประกายแดงระหว่างสองตัวละคร, เส้นประเชื่อมกัน, banner "⚔️ auth.ts — Alice vs Bob" ที่ roster, ชื่อแท็บ `⚔️(1) Claude Guild` และ Notification (ใช้ระบบเดิมของ permission alert)
- มีแผง "Territory" ใน panel: รายการไฟล์ที่ชน + session ที่เกี่ยวข้อง คลิกเพื่อ focus ตัวละคร
- **Demo moment:** เปิด 2 session ให้แก้ `README.md` พร้อมกัน → นักรบสองคนหันหน้าชนดาบกลางจอ จอสั่น เสียง clang แท็บกระพริบ กรรมการเห็นปุ๊บเข้าใจปั๊บว่า "ช่วยชีวิตงานได้จริง" ส่วน sim mode มีปุ่มจำลองให้เดโมได้โดยไม่ต้องเปิดจริง

## ใช้ข้อมูลอะไร
- `tool_input.file_path/notebook_path` จาก PreToolUse/PostToolUse (engine.ts ~บรรทัด 200 ดึง `file` อยู่แล้ว), `session_id`, `cwd`, `tool_name`
- `PostToolUseFailure.error` (เช่น "String to replace not found") ใช้เป็นสัญญาณชนซ้ำ → ยกระดับเป็น Clash ทันทีถ้ามี session อื่นแตะไฟล์นั้นเมื่อไม่นานมานี้
- ใช้โครง waiting/alert เดิม (store.ts `waiting`, ชื่อแท็บ, Notification) ไม่ต้องหาข้อมูลใหม่

## MVP (1 รอบ)
- engine: Map `path → {sid, t}` (realpath จาก cwd), ตรวจตอน PreToolUse ของ tool เขียนไฟล์; ปล่อย `clash` event ให้ render วาดดาบไขว้ + roster badge
- ไม่นับ: ไฟล์ชั่วคราว/`node_modules`/`.git`, session เดียวกัน, subagent ของ session เดียวกัน, ไฟล์ที่ต่างกันแต่ cwd ต่าง repo
- แจ้งเตือนแท็บ + Desktop Notification (reuse S3) + test vitest
- ต่อยอด: ตรวจ git worktree/branch เดียวกัน, ปุ่ม "Pause session" ผ่าน copy คำสั่ง, ประวัติ Clash รายวัน, ตรวจ Bash ที่มี `>`/`sed -i`

## ความเสี่ยง / Privacy
- เก็บแค่ path (ที่ slim แล้ว) ในหน่วยความจำ ไม่อ่านเนื้อไฟล์ ไม่เพิ่ม persistence
- false positive: สองคนแก้คนละส่วนของไฟล์เดียวกันก็เตือน → ใช้ระดับ "คำเตือน" ไม่ใช่ error และมีปุ่ม dismiss ต่อไฟล์
- Bash เขียนไฟล์ตรวจไม่ได้ใน MVP (ระบุชัดใน UI)
- path ยาว/symlink: normalize ด้วย cwd + `path.resolve`

## ประเมินแรง: **M**
ไฟล์หลัก: `lib/office/engine.ts` (clash tracker + event), `lib/office/render.ts` (ดาบไขว้/เส้นเชื่อม), `components/OfficeApp.tsx` (panel Territory + แท็บ/notification), `lib/office/sim.ts` (เดโม clash), `tests/**`
**ทำไมชนะ:** impact จริง (กันงานพัง), ภาพว้าว, เข้าธีมกิลด์ (ศึกแย่งดินแดน), ข้อมูลมีครบแล้ว, ความเสี่ยงต่ำ
