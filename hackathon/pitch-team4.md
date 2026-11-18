# Team 4 (ทีมนักบวชสายไวลด์การ์ด) — "Guild Rules: ป้ายห้ามเข้าเขตต้องห้าม"

**One-liner:** ให้ผู้เล่นปักธง "เขตต้องห้าม / เขตขออนุมัติ" บนแผนที่กิลด์ แล้วนักผจญภัยที่เหยียบเขตนั้นจะถูกเด้งกลับเป็นแอนิเมชันโล่ ("Ward") หรือหยุดรอคุณอนุมัติ — ฮุกของเราเป็นเสมือน "นักบวชผู้พิทักษ์" ที่ปกป้อง repo ของคุณจริง ๆ

## ปัญหา / ทำไมต้องมี
Dashboard ทุกตัวแค่ "ดู" แต่ไม่ช่วย "คุม" เวลา Claude รัน 5 session พร้อมกัน ไม่มีใครเฝ้าทัน มันแตะ `.env`, `rm -rf`, `git push --force` ได้ในพริบตา ผู้ใช้อยากได้ guardrail แต่ไม่อยากเขียน JSON ใน settings.json เอง

## ทำงานยังไง (user-facing)
- เปิดแผงใหม่ "Wards" (ปิดเป็นค่าเริ่มต้น, opt-in) เลือก preset แบบการ์ด: `Protect Secrets` (.env, *.pem, id_rsa), `No Force Push`, `Stay In Project` (ห้ามเขียนนอก cwd), หรือพิมพ์ glob เอง
- แต่ละ rule มี 2 โหมด: **Ward (ปฏิเสธ)** หรือ **Ask (หยุดรอ)** — ตั้งต่อโปรเจกต์ได้
- เมื่อ Claude พยายามละเมิด: PreToolUse hook ถามเซิร์ฟเวอร์ → ตอบ `deny` พร้อมเหตุผลสั้น ๆ ให้ Claude รู้ตัวและเปลี่ยนแผน
- **Demo moment:** นักผจญภัยวิ่งไปหา "หีบสมบัติ .env" → โล่ทองเรืองแสงเด้งชน ตัวละครกระเด็นถอยหลัง ข้อความ "🛡 Ward blocked: .env" เด้งขึ้น พร้อมเสียง/สั่นจอ และ Claude เองตอบกลับว่า "โอเค ขอแก้วิธีอื่น" สด ๆ บนเวที ส่วนโหมด Ask: ตัวละครยืนหน้าประตูล็อก ปุ่ม [ปล่อยผ่าน] [ปิดประตู] โผล่ใต้ avatar กรรมการกดเองได้

## ใช้ข้อมูลอะไร / มีอยู่แล้วตรงไหน
- PreToolUse: `tool_name`, `tool_input` (file_path/command), `session_id`, `cwd`, `agent_id` — engine.ts มี helper ดึง file/path อยู่แล้ว (~บรรทัด 201) และ store.ts เก็บ `cwd`/`waiting`/permission alert อยู่แล้ว
- ต่อยอดระบบแจ้งเตือน permission และตัวกรองโปรเจกต์ที่มีแล้ว
- เพิ่มเอนต์รี `PreToolUse` ใน `hooks/` สคริปต์ที่เรียก `POST /guard` แล้วพิมพ์ JSON decision ออก stdout

## MVP (1 รอบงาน)
- กฎเก็บในไฟล์ local `~/.claude-guild/wards.json` (glob + regex คำสั่ง); matcher เป็นฟังก์ชันบริสุทธิ์ + vitest
- โหมด Ward เท่านั้น (deny) + เอฟเฟกต์โล่ใน canvas + log "Wards triggered" ต่อ session + นับเป็น achievement "Shield Bearer"
- โหมด Ask (long-poll ≤ 30 วินาที, หมดเวลา = ปล่อยให้ permission prompt ปกติของ Claude Code จัดการ) ถ้ามีเวลา
- **ต่อยอด:** policy ต่อ squire/subagent, git-aware (ห้ามแก้ branch main), ส่ง rule เข้า repo ทีม

## ความเสี่ยง / privacy / ข้อจำกัด
- **Opt-in เท่านั้น:** ไม่ติดตั้ง hook ถ้าไม่กดเปิด; ไม่มีกฎ = ไม่ทำอะไรเลย (fail-open: ถ้าเซิร์ฟเวอร์ล่ม/timeout 2 วินาที สคริปต์ exit 0 ไม่บล็อกงาน)
- ปฏิเสธได้อย่างเดียว ไม่เคย "อนุมัติแทน" และไม่ bypass permission ของ Claude Code
- ประมวลผลบนเครื่องเท่านั้น ไม่เก็บ tool_input ดิบ เก็บแค่ชื่อกฎ + path ที่ตรง
- Glob ไม่ครอบคลุมทุกการหลบ (เช่น `cat $(echo .e""nv)`) — ระบุชัดว่าเป็น safety net ไม่ใช่ sandbox
- latency ของฮุก PreToolUse เพิ่มต่อทุก tool call → ต้องเร็ว (<50ms, matcher ในหน่วยความจำ)

## ประเมินแรง: **M**
ไฟล์หลัก: `hooks/guard.sh` (ใหม่), `app/guard/route.ts` (ใหม่), `lib/wards.ts` (ใหม่ + test ใน `tests/`), `lib/store.ts` (เก็บ ward events), `lib/office/engine.ts` + `render.ts` (แอนิเมชันโล่), `components/OfficeApp.tsx` (แผง Wards)
