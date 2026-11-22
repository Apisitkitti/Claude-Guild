# Judge B (รอบ 3 เข้มข้น) — กรรมการสายวิศวกรรม

**มุมมอง:** ความถูกต้อง, ข้อมูลมีจริงไหม, privacy/security, ขอบเขต memory, testability (vitest `tests/**/*.test.ts` — `vitest.config.mts:10`), ขนาด ≤400 บรรทัดที่ทำได้จริง, ตัวชี้วัด/kill ที่วัดได้ · ให้คะแนน**แผนฉบับแก้ (rebuttal)**
**สูตร:** Base = 2×Impact + Delight + Feasibility + Theme + Risk · −3/ข้ออ้างที่ผมตรวจแล้วไม่จริงและไม่ติดป้าย · −2/ข้อกล่าวหาที่ไม่ตอบ/ตอบเลี่ยง · +2/การแก้ที่ดีขึ้นจริง (สูงสุด +4)

ข้อเท็จจริงที่ตรวจเอง (commit `61509a0`):
- `slim` (`lib/store.ts:272-280`) ตัด string 300 ตัว (`:273`) และยุบ object ที่ depth ≥2 เป็น `"{…}"` (`:275`) → `tool_input.todos[]` หายจริง; `DROP_KEYS` (`:282`) ทิ้ง `tool_response/last_assistant_message/prompt/custom_instructions`; แต่ `evt` ที่ slim แล้วยังมี command 300 ตัวแรก → `store.events` + SSE (`:313`) + snapshot (`:322`)
- `attention.ingest(raw)` ได้ **raw ที่ไม่ผ่านอะไรเลย** (`:302`) และเก็บ `target` 80 ตัวของคำสั่ง (`lib/attention.ts:127`) ลงแถว loop + ข้อความ `copy` (`:281`) ที่ broadcast ทาง SSE `attention`
- `dropSession` (`lib/store.ts:124-133`) ถูกเรียกจาก SessionEnd (`:218-219`), sweep เงียบ >10 นาที (`:38,69`) และ evict เมื่อเกิน `MAX_SESSIONS=200` (`:149,229-238`); `STORE_VERSION = 10` (`:55`)
- `MAX_BODY = 1MB` → 413 ทิ้งทั้ง event (`app/events/route.ts:3,32`); PostToolUse ของ Edit พก `tool_response.originalFile` ทั้งไฟล์ → ไฟล์ใหญ่หายเงียบ (red team ถูก)
- hook ทุกตัว `async: true` + `curl --max-time 1` (`hooks/settings.example.json:8-10`) → ลำดับไม่การันตี; waiting ปิดด้วย PreToolUse ใด ๆ (`lib/store.ts:248`)
- `.guild/` **ไม่อยู่ใน** `.gitignore` และมีไฟล์ `.guild/token` (git status = untracked, `git check-ignore` ไม่ match) — red team R3-3 ถูก
- ความจริงของ payload Claude Code: Bash exit≠0 → `PostToolUseFailure.error`; Task tools (`TaskCreate/TaskUpdate`) แทน TodoWrite ในรุ่นปัจจุบัน (red team R1-2 ถูก); commit ใช้ heredoc `$(cat <<'EOF'` (R1-4 ถูก); PermissionRequest มี `tool_name/tool_input/permission_suggestions` แต่**ไม่มี `tool_use_id`**; Grep/Glob `path` เป็น optional; Read มี `file_path` (+`offset/limit` optional)
- ตรวจ red team: ข้อกล่าวหาทั้ง 24 ข้อถูกตามโค้ด ยกเว้น R2-4 ที่ "แก้" ได้แค่เชิงสัญลักษณ์ — `cwd` ของ session ก็มาจาก payload เดียวกัน (ระดับความเชื่อถือเท่าเดิม) ส่วนที่มีค่าจริงคือเพดาน entry → ไม่ให้โบนัสส่วน trust

| ทีม | Impact ×2 | Delight | Feas. | Theme | Risk | Base | − | + | **Final** |
|---|---|---|---|---|---|---|---|---|---|
| 1 Receipt Ledger | 7 (14) | 6 | 7 | 6 | 7 | 40 | 0 | +4 | **44** |
| 2 Cartographer's Atlas | 6 (12) | 5 | 7 | 5 | 6 | 35 | 0 | +2 | **37** |
| 3 Permission Tax | 7 (14) | 6 | 6 | 5 | 6 | 37 | 0 | +4 | **41** |
| 4 Sentinel Ledger | 7 (14) | 5 | 5 | 6 | 6 | 36 | 0 | +4 | **40** |

ไม่มีทีมใดโดน −3: เลขบรรทัดที่คลาด 1-6 บรรทัด (ทีม 1 `attention.ts:204→210`, `:205→211`, `store.ts:274→275`, `:318→319`, `RESULTS.md:24→23`; ทีม 2 `attention.ts:207-216→214-219`; ทีม 4 `:30→31`, `:32→33`, `store.ts:270,272→267,273`) — **เนื้อหาที่อ้างจริงทุกข้อ** จึงไม่นับเป็นข้ออ้างเท็จ และทุกทีมแก้แล้ว · ไม่มี −2: ทุกทีมตอบครบ 6/6 (หัวไฟล์ทีม 2 เขียน "หักล้างบางส่วน 1" แต่เนื้อหายอมรับทุกข้อ — ไม่เลี่ยง) · ไม่มีทีมถูกตัดสิทธิ์

## ทีม 1 — Receipt Ledger (40 + 4 = 44)
- **แข็ง:** ข้อมูลแกน (Edit สำเร็จ + `file_path`, Bash `command`, Success/Failure split) มีจริงและเป็นท่อเดียวกับ attention; ไม่มีตัวนับ "จำนวน tool call" → spam ไม่ได้ผล; kill ระดับตัวนับ + ระดับฟีเจอร์ชัดและวัดได้
- **+2 R1-1:** `closed` receipts TTL 2 ชม. + cap 30 แก้ปัญหาข้อ 3 ของตัวเองได้จริง มีขอบเขต memory · **+2 R1-3:** ฟื้นระดับ `(session, cwd, runner)` ปิด false negative ที่พบบ่อยที่สุด (R1-2/R1-4 เป็นการตัด/ลด scope ไม่ใช่ +)
- **อ่อน:** `npm test 2>&1 | tail -30` (Claude ทำบ่อยมาก) ได้ exit ของ `tail` = 0 → fail ไม่เคยมาเป็น Failure และ pass ปลอมได้ → metric "false ฟื้น = 0" เสี่ยง; recorder เขียน raw ลง `.guild/` ซึ่งไม่ถูก ignore
- **Must-fix ถ้าชนะ:** (1) `lib/outcomes.ts` — คำสั่งที่มี `|` (ไม่มี `set -o pipefail`), `|| true`, `; true` → ไม่นับทั้ง red และ green + test (2) recorder: ตัด `DROP_KEYS` + `tool_input.content/new_string/old_string`, เพิ่ม `.guild/` ใน `.gitignore`, mode 0600, ปิดเป็นค่าเริ่มต้น (3) ย้ายใบเสร็จเข้า `closed` ภายใน `dropSession` (`lib/store.ts:124`) เพื่อครอบทั้ง SessionEnd/sweep/`MAX_SESSIONS` evict (4) ids dedupe มีเพดานต่อ session แบบ `MAX_IDS_PER_KEY` (5) bump `STORE_VERSION` → 11 (6) TaskUpdate: จับ payload จริงก่อนเขียน parser ตามที่สัญญา

## ทีม 2 — Cartographer's Atlas (35 + 2 = 37)
- **แข็ง:** DOM ล้วน (render 0 บรรทัด), Read `file_path` มีจริง, relabel Grep/Glob เป็นสมมติฐานอย่างซื่อตรง, ย้าย test ถูกที่
- **+2 R2-6/R2-4:** global cap 5,000 แถว + Set 20 + 5 cwd + `opendir` หยุดที่ 200 entry = ขอบเขต memory/IO ที่ test ได้ · **ไม่ให้ +R2-1:** median/hub-80% กับ N session เล็ก (2-3 ตัว) ไฟล์ที่อ่านแทบทุกไฟล์จะเป็น "hub" → แถว Confusion ว่างหรือสุ่ม ยังไม่มีหลักฐานว่าแยก "งง" ออกจาก "สำคัญ"
- **อ่อน:** ตัวนับ copy-click อยู่ใน memory หายเมื่อ restart; metric 1 top-5 ≥3/5 ตัวอย่างเล็กเกินจะมีนัย; Read ไฟล์ใหญ่ถูก 413 ทิ้ง
- **Must-fix:** กำหนด N session ขั้นต่ำก่อนแสดง Confusion; ไม่ส่ง absolute path (ใช้ `displayPath`, `lib/territory.ts:44`); ลบ `sid` จาก Set ใน `dropSession`

## ทีม 3 — Permission Tax (37 + 4 = 41)
- **แข็ง:** ข้ออ้างใน pitch ถูกทุกข้อ (`store.ts:246-250`, `settings.example.json:66`, `attention.ts:25,87,124`); ยอมรับว่าเป็น "ขอบบน" ตั้งแต่ pitch; ไม่เขียน settings ให้ผู้ใช้
- **+2 R3-3:** ไม่เก็บคำสั่ง/label เลย เก็บแค่ rule ที่ไม่มีอาร์กิวเมนต์ + `.gitignore` + 0600 + test secret ไม่รั่ว · **+2 R3-4:** `suggestRule` ปฏิเสธคำสั่งประกอบ/env prefix/denylist = rule ที่ปลอดภัยกว่าเดิมจริง
- **อ่อน:** ข้อแก้ R3-2 "ปิดด้วย PostToolUse ของ `tool_use_id` เดียวกัน" — PermissionRequest **ไม่มี `tool_use_id`** ต้องผูกผ่าน PreToolUse ก่อนหน้า (ไม่ได้ระบุ); และ PreToolUse ของ tool เดียวกันที่มาช้ากว่า PermissionRequest (async) จะปิด wait = 0 วินาที (`lib/store.ts:248`); นาทีส่วนใหญ่กลายเป็น "จำนวนครั้ง × มัธยฐาน" → metric ลด ≥30% ยังกึ่งผูกกับตัวเอง (rule ลด prompt ⇒ ลดนาทีตามนิยาม)
- **Must-fix:** ผูก wait กับ `(tool_name, fingerprint(tool_input))` ของ PreToolUse ล่าสุด และไม่ให้ Pre ของคู่เดียวกันปิด wait; รายงานแยก "วัดจริง" กับ "ประมาณ"; ใช้ `permission_suggestions` เป็นตัวเลือกแรกเมื่อมี

## ทีม 4 — Sentinel Ledger (36 + 4 = 40)
- **แข็ง:** **+2 R4-1** redact ก่อน slim แก้รอยรั่ว secret ที่มีอยู่จริงในแอปทั้งตัว (ไม่ใช่แค่ฟีเจอร์ตัวเอง) · **+2 R4-2** กฎ 1-3 จาก PostToolUse เท่านั้น ปิด false accusation เคส deny
- **อ่อน:** redact ไม่ครบท่อ — `attention.ingest(raw)` (`lib/store.ts:302`) ยังได้ raw → `curl -H "Authorization: Bearer sk-…"` ที่ล้ม 3 ครั้งจะไปโผล่ใน `target`/`copy` ของแถว loop ทาง SSE `attention`; pattern เฉพาะ prefix ที่รู้จัก (`PASSWORD=…` ใน `.env` หลุด); 390 บรรทัด + 5 กฎ + แก้ hot path ของ store + ไอคอน canvas = เกิน 400 ได้ง่าย (Feasibility 5); fixture "log ประวัติจริง" ไม่บอกที่มา
- **Must-fix:** ส่งสำเนาที่ redact แล้วให้ attention/territory ด้วย (classify เท่านั้นที่ได้ raw); test ว่า SSE `attention` ไม่มีค่า secret; ตัดกฎ 5 ออกจาก MVP ถ้าเกิน 400

## ผู้ชนะ (Judge B): ทีม 1 — Receipt Ledger (44)
ข้อมูลแกนมีจริงครบ, ขอบเขต memory ชัด, test list ละเอียดที่สุด และการแก้ R1-1/R1-3 เปลี่ยนจาก "ใบเสร็จที่หายตอนกลับมาดู" เป็นฟีเจอร์ที่ใช้ได้จริง — มีเงื่อนไขว่าต้องแก้เคส pipe `| tail` และ recorder/`.gitignore` ก่อน merge
อันดับ: 1 > 3 (41) > 4 (40) > 2 (37) · หมายเหตุ: redaction ของทีม 4 (รวมส่วน attention) ควรทำเป็นงานแยกไม่ว่าใครชนะ เพราะเป็นรอยรั่วของ store ปัจจุบัน
