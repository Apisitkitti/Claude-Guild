# Rebuttal ทีม 4 นักบวช — Sentinel Ledger (ยอมรับ 6 / หักล้าง 0)
ตรวจซ้ำกับโค้ดแล้ว: ทุกข้อของ red team จริง ไม่หักล้างสักข้อ

**R4-1 ยอมรับ (ร้ายแรง)** จริง: `slim` ตัด string ที่ 300 ตัว (`lib/store.ts:267,273`) แต่ค่า 300 ตัวแรกยังเข้า `store.events`, SSE (`:313`) และ snapshot — คำว่า "mask ที่ tracker" ของผมไม่ครอบท่อนี้ เป็นข้อผิดพลาดของ pitch
- แก้: เพิ่ม `redactSecrets(raw)` ใน `lib/risk.ts` เรียกใน `addEvent` **ก่อนลูป slim** (ก่อน `lib/store.ts:283-289` เดิม) เพื่อแทนค่า secret ใน `tool_input.command/content/new_string` เป็น `‹sk-…a1b2›` ในสำเนาที่จะ slim/broadcast/log; ตัว `raw` ส่ง `classify` ก่อน redact. เป็นการเปลี่ยนพฤติกรรม store (ข้อมูลใน UI ถูกแก้) — ระบุไว้ชัด
- test: payload มี `AKIA…`/`sk-…`/PEM → `JSON.stringify(snapshot())`, ข้อความ SSE ที่ `broadcastRaw` ส่ง และบรรทัด `logEvent` (`:259`) ต้องไม่มีค่าจริง; secret ยาวเกิน 300 ตัวที่ถูก slim ตัดกลางก็ต้องไม่รั่วครึ่งค่า

**R4-2 ยอมรับ (ร้ายแรง)** จริง: PreToolUse ยิงก่อนผู้ใช้ตอบ permission (permission wait ถูกจัดการแยกที่ `lib/store.ts:245`) deny แล้ว UI จะใส่ร้าย
- แก้: กฎ 1-3 (destructive, นอกโปรเจกต์, ไฟล์ลับ) ตัดสินจาก **PostToolUse เท่านั้น** (= รันสำเร็จจริง) ข้อความ "รันแล้ว"; PreToolUse ใช้เฉพาะกฎ 4 (secret ใน input) ข้อความ "พยายามส่ง" ไม่กล่าวว่าเกิดผล; `PostToolUseFailure` = ไม่จด (แต่ถ้า Pre มาแล้วไม่มี Post ภายใน 90 วิ → ไม่แสดงอะไร)
- test: Pre แล้วไม่มี Post (deny) → 0 แถวระดับ "รันแล้ว"; Pre+Post → 1 แถว; Pre+PostFailure → 0; dedupe ด้วย `tool_use_id`

**R4-3 ยอมรับ** กฎ rm ขัดกันเองจริง
- แก้: `rm -rf` แดงเฉพาะเมื่อเป้าหมาย (1) เป็น `/`, `~`, `$HOME`, `..`, `*`/`.` หรือ (2) resolve แล้วอยู่นอก cwd; allowlist ชื่อโฟลเดอร์ build ตายตัว `node_modules, dist, build, .next, coverage, out, target, __pycache__, .turbo` ที่อยู่ใต้ cwd → ไม่เตือน
- test: `rm -rf node_modules dist .next` ปกติ · `rm -rf ./src` แดง · `rm -rf ~` แดง · `rm -rf /tmp/x` ปกติ · `rm -rf node_modules/../..` แดง

**R4-4 ยอมรับ** `resolveTarget` กรองแค่ tmp/node_modules/.git/.next (`lib/territory.ts:27-28,38-39`) และคืน null สำหรับ tmp ซึ่งใช้ตรวจ "นอกโปรเจกต์" ไม่ได้ → ผมจะเขียน resolver ของ risk เอง (`path.resolve` + `startsWith(cwd + "/")`)
- แก้: ยกเว้น `~/.claude/**`, tmp prefixes เดียวกับ `:28`, และพาธที่ session เคยทำงานด้วย `--add-dir`/`cwd` อื่นผ่านค่า `cwd` ที่เห็นใน event ของ session เดียวกันก่อนหน้า (**สมมติฐาน:** hook payload ไม่มี field ของ add-dir จึงใช้ cwd ที่เคยเห็นแทน) และลดกฎนี้เป็น 🟠 ไม่ใช่ 🔴 ยกเว้น `/etc`, `/usr`, `~/.ssh`, `~/.aws`
- test: เขียน `~/.claude/plans/x.md` → ไม่เตือน · `/etc/hosts` → แดง · `~/.ssh/config` → แดง · repo พี่น้องที่ cwd เคยเห็น → ไม่เตือน

**R4-5 ยอมรับ** Stop ยิงทุกเทิร์น (`lib/attention.ts:196-205` ตามที่ red team ชี้) และ Bell มีแถว "done" (`:286`) ซ้อนกัน
- แก้: ตัวนับ `unverifiedEdits` ต่อ session: เพิ่มเมื่อ PostToolUse edit ไฟล์โค้ด (นามสกุล ts/tsx/js/py/go/rs/java ฯลฯ — ไม่นับ `.md`, `.json`, `.yml`, `.env`, config); รีเซ็ตเมื่อ Bash test/lint/tsc/build สำเร็จ **หลัง** edit ล่าสุด หรือหลังเตือนแล้ว 1 ครั้ง → เตือนครั้งเดียวต่อชุด edit; เริ่มจาก edit ใหม่จึงเตือนได้อีก. ไม่เข้าคิว Bell, แสดงเป็นแถวเหลืองในสมุดเท่านั้น; ข้อความไม่ซ้ำกับ "เสร็จแล้ว รอรีวิว"
- test: edit→Stop→Stop→Stop = 1 แถว · edit .md→Stop = 0 · edit→test ผ่าน→Stop = 0 · test ก่อน edit→Stop = 1 · edit ใหม่หลังเตือน→Stop = แถวที่ 2

**R4-6 ยอมรับ** ออกข้อสอบเองตรวจเองจริง + อ้างเลขบรรทัดผิด (ตรวจแล้ว: `EDIT_TOOLS` อยู่ `lib/attention.ts:31`, `AttentionKind` `:33`, slim `lib/store.ts:267,273` — ขอแก้ตามนี้)
- แก้ตัวชี้วัด: fixture ดึงจาก log ประวัติจริงของ session (ผู้ใช้ติดป้ายทีหลังโดยคนที่ไม่ใช่ผู้เขียนกฎ — ให้กรรมการ/ทีมอื่นติดป้าย 40 คำสั่งก่อนผมเห็นผล); รายงาน precision/recall ต่อกฎแยกกัน ไม่รวมก้อนเดียว; **kill:** กฎใดที่ precision <80% บนชุดที่คนอื่นติดป้าย ตัดกฎนั้น ถ้าเหลือ <3 กฎ ยกเลิก (คงเดิม)

## แผน MVP ฉบับแก้ (≈390 บรรทัด)
- `lib/risk.ts` (~210): `redactSecrets`, `classify` (Post-only กฎ 1-3,5; Pre กฎ 4), allowlist/resolver, `RiskTracker` (`unverifiedEdits`, dedupe `tool_use_id`, `dropSession`, sweep)
- `lib/store.ts` (~30): redact ก่อน slim, `store.risk.ingest(raw)`, SSE `risk`, bump `STORE_VERSION` (`:55`), ล้างใน dropSession (`:125`)
- `components/OfficeApp.tsx` (~55) + `lib/office/render.ts` (~15): section 🛡 + ไอคอนทึบ
- `tests/risk.test.ts` (~110) ครอบทุก test ข้างบน + `tests/store.test.ts` เพิ่ม test redaction ของ SSE/snapshot/log
