# Judge B (รอบ 2) — กรรมการสายวิศวกรรม

มุมมอง: ความถูกต้อง, ข้อมูลมีจริงไหม, วาง logic ฝั่ง server หรือ client, false positive, ขอบเขต perf/memory, testability (vitest ใน `tests/`), และขนาดงานจริง
ตรวจกับโค้ด: `lib/store.ts`, `lib/transcript.ts`, `lib/territory.ts`, `lib/office/engine.ts`, `app/events/route.ts`, `hooks/settings.example.json`

ข้อเท็จจริงสำคัญที่ใช้ตัดสิน:
- hook ที่ติดตั้งอยู่: SessionStart, UserPromptSubmit, Pre/PostToolUse, PostToolUseFailure, PermissionRequest, Notification, PreCompact, Stop, Subagent*, SessionEnd ทุกตัวเป็น `async: true` → **ขวางไม่ได้ และลำดับที่มาถึงไม่การันตี** (curl แยก process, payload ไม่มี timestamp ใช้ได้แค่ `receivedAt`)
- `addEvent` ทิ้ง `tool_response`, `last_assistant_message`, `prompt` (DROP_KEYS) และตัด string เหลือ 300 ตัวอักษร (`slim`) แต่ `raw` ยังอยู่ในฟังก์ชัน → ถ้าจะใช้ข้อมูลพวกนี้ต้องคำนวณจาก `raw` **ก่อน** slim (ทำได้จริง); `error` ของ PostToolUseFailure เหลืออยู่ 300 ตัว
- Bash ที่ exit ≠ 0 มาเป็น `PostToolUseFailure.error` ไม่ใช่ `PostToolUse.tool_response` → test ที่พังจะมีให้แค่ error string ซึ่งมีเวลา/duration/เลขบรรทัดปนอยู่ ต้อง normalize ก่อน hash
- `TerritoryTracker` เป็นแม่แบบที่ดี: pure, `now` แบบ inject ได้, เรียกใน `addEvent`, sweep ใน interval 30s เดิม, ส่ง SSE + อยู่ใน `snapshot()`; ตอนนี้ `STORE_VERSION = 8` ทุกทีมต้อง bump และต่อ tracker ใน `createStore`/`dropSession`
- `context` มาจาก tail 256KB ของ transcript (debounce 500ms, คืนแค่ค่าล่าสุด รวม input+cache_read+cache_creation, `limitGuessed` เมื่อเกิน 200k) — ไม่มีอนุกรม ไม่มีแยก cache
- `s.waiting` มีอยู่แล้ว แต่ไม่มี `waitingSince`; Notification ใช้แค่ `permission_prompt` (`idle_prompt` มีจริงแต่ยังไม่ได้ใช้)
- squire (`agent_id`) และ parallel tool calls ใช้ `session_id` เดียวกับแม่ → buffer ต่อ session ล้วน ๆ จะสลับกันมั่ว ต้อง key ด้วย `(session_id, agent_id ?? "main")`

## คะแนน
| ทีม | Impact (x2) | Delight | Feasibility | Theme | Risk (10=ต่ำ) | รวม /60 |
|---|---|---|---|---|---|---|
| 1 Berserk Watch | 8 | 8 | 6 | 9 | 6 | **45** |
| 2 Mana Ledger | 7 | 6 | 6 | 7 | 8 | **41** |
| 3 Lookout Bell | 9 | 7 | 8 | 6 | 8 | **47** |
| 4 Infirmary | 7 | 7 | 4 | 8 | 5 | **38** |

## ความเห็นรายทีม

### ทีม 1 — Berserk Watch (45)
- **จุดแข็ง:** วาง detector ฝั่ง server ถูกที่ (`lib/berserk.ts` แบบ territory); แนวคิด "fingerprint เดิม + ผลเดิม = วน, ผลเปลี่ยน = คืบหน้า" แม่นที่สุดในสามทีมเรื่องแยก retry ที่ชอบธรรม; reset ตอน Stop/UserPromptSubmit; ไม่เก็บเนื้อหา
- **จุดอ่อน:** hash `tool_response` ใช้ไม่ได้กับเคสหลัก (test พัง = PostToolUseFailure ไม่มี tool_response) และ output มี duration/timestamp → hash ไม่เคยซ้ำ = ไม่เตือน (false negative); 4 detector + 2 ระดับ + sprite frame ใหม่ + rage meter + sim ใน engine 2,000 บรรทัด = ใหญ่เกิน M; ping-pong พึ่งลำดับเหตุการณ์ที่ async ไม่การันตี
- **Must-fix:** `lib/store.ts:addEvent` — hash จาก `raw` ก่อน DROP_KEYS แต่ hash ทั้ง `tool_response` และ `error` หลัง normalize (ตัดตัวเลข/เวลา/path tmp); `lib/berserk.ts` key ต่อ `(sid, agent_id)`; ตัด detector 3-4 ออกจาก MVP; vitest ใน `tests/berserk.test.ts`

### ทีม 2 — Mana Ledger (41)
- **จุดแข็ง:** ไม่ทับกับทีมอื่น ข้อมูลมีจริง (`usage` ต่อ assistant message, `PreCompact`, ความยาว `tool_response` ก่อน drop); DOM ล้วนไม่แตะ canvas; ระบุ "≈" ชัด; ซ่อน 🔴 เมื่อ `limitGuessed` ถูกต้อง
- **จุดอ่อน:** `readContext` คืนแค่ค่าล่าสุดจาก tail 256KB → อนุกรมต้องเก็บจากการอ่านแต่ละครั้ง (debounce 500ms ทำให้ข้ามบาง message); attribution Δused แบ่งตามความยาว response เป็นการเดาที่ผู้ใช้จะเชื่อเกินจริง; "turn ถึง compact" ไม่รู้ threshold auto-compact จริง (ไม่ใช่ 100%); cache TTL ไม่ใช่ 5 นาทีเสมอ
- **Must-fix:** `lib/transcript.ts` — แยกคืน `cacheRead/cacheCreate/input` (ยังส่งออกแค่ตัวเลข) และใช้ seq เดิมกันค่าเก่า; ตัด attribution แบบแบ่งสัดส่วน เหลือ "Top tool_response ≈ chars/4" ตรง ๆ; ring buffer จำกัดต่อ session และลบใน `dropSession`; test ด้วย JSONL fixture ใน `tests/transcript.test.ts`

### ทีม 3 — Lookout Bell (47)
- **จุดแข็ง:** ขนาดเล็กที่สุด (~350 บรรทัด) logic อยู่ server ทั้งหมด (`lib/attention.ts` แบบ TerritoryTracker); กฎ loop เรียบและกัน false positive ดี: นับเฉพาะ hash เดิมที่**ล้มเหลว** และ **reset เมื่อ Edit/Write สำเร็จคั่น** (สัญญาณความคืบหน้าที่เชื่อถือได้กว่า hash output); ใช้ `last_assistant_message` ก่อน drop + `idle_prompt` เป็นตัวเสริมถูกต้อง; คิว triage รวมสัญญาณที่มีอยู่แล้ว (waiting/context/clash) เป็นคำตอบเดียว "ไปดูใครก่อน"
- **จุดอ่อน:** "test ด้วย curl script" ไม่พอ — repo มี vitest อยู่แล้ว; ตัวจับ "ถามคำถาม" เป็น heuristic (ภาษาไทย/อังกฤษ) ต้องติดป้ายเดา; queue ต้องมีเวลา (`since`) จึงต้องคำนวณใน sweep ไม่ใช่แค่ตอนมี event; ซ้ำกับ `waitingIds()` ใน engine บางส่วน
- **Must-fix:** `lib/store.ts` — เพิ่ม `waitingSince` + เรียก `attention.sweep(now)` ใน interval เดิม, bump `STORE_VERSION` เป็น 9, ลบ state ใน `dropSession`; `lib/attention.ts` — key ต่อ `(sid, agent_id)`, ไม่นับ `is_interrupt`, dedupe ด้วย `tool_use_id`, normalize error ก่อนเทียบ; เก็บ tail ข้อความ ≤80 ตัวเฉพาะ main agent; `tests/attention.test.ts` (vitest + injected `now`)

### ทีม 4 — Infirmary (38)
- **จุดแข็ง:** เรียนรู้จากรอบ 1 (เตือนแทนขวาง, server-side, dedupe `tool_use_id`, ไม่นับ `is_interrupt`, เทียบ fingerprint ของ error); ข้อมูลที่อ้างมีจริงทั้งหมด (`error` 300 ตัว, `s.waiting`, `s.context`)
- **จุดอ่อน:** scope กว้างที่สุด — 6 อาการ + HP bar + นักบวช NPC เดินหาเป้าใน engine + ป้ายชวนพัก + regex คำสั่งเสี่ยง ไม่จบใน M; "ไม่มี Bash test สำเร็จคั่น" ต้องเดาว่าคำสั่งไหนคือ test; regex `rm -rf` หลบง่ายและเตือนหลังเหตุ (คุณค่าต่ำ, FP สูง); "เวลาทำงานของคน" ต้องอยู่ client (localStorage) ไม่ใช่ `lib/health.ts` แต่ pitch ใส่รวมกัน; `waiting` ค้างเกินจริงเพราะไม่มี hook ตอน approve → ⏳ จะเตือนผิด
- **Must-fix:** ตัดข้อ 5-6 และ NPC ออก; `lib/health.ts` เหลือ loop + failure streak; `waiting >5 นาที` ต้องมี `waitingSince` และปิดเมื่อเห็น PostToolUse ถัดไป; vitest แทน curl

## ทีม 1, 3, 4 ซ้อนกัน — ควรรวม
ทั้งสามทีมสร้าง "loop detector ฝั่ง server ต่อ session" ตัวเดียวกัน ทำ 3 ตัว = 3 tracker, 3 SSE event, 3 ป้ายเหนือหัวแย่งที่กัน → **ต้องรวมเป็นโมดูลเดียว** `lib/loop.ts` (pure, `now` inject, vitest) ที่ทีม 3 ใช้เป็นแหล่งของคิว
ดีไซน์ detector ที่ sound ที่สุด (ผสม):
1. key `(session_id, agent_id ?? "main")`, ring buffer ≤20, dedupe `tool_use_id`, ข้าม `is_interrupt` (ทีม 4)
2. fingerprint = tool + input normalize (Bash ตัดตัวเลข/timestamp, Edit = path + hash(old_string) จาก raw) (ทีม 3)
3. นับเป็นวนเมื่อ fingerprint เดิม **ล้ม ≥3 ใน 5 นาที โดย error ที่ normalize แล้วเหมือนกัน** (ทีม 4 + แนวคิด "ผลเดิม" ของทีม 1); success ที่ผล normalize เดิมใช้ได้เป็นระดับรอง
4. reset เมื่อ Edit/Write สำเร็จคั่น, UserPromptSubmit, หรือ Stop (ทีม 3 + ทีม 1)
5. ไม่ใช้ ping-pong ใน MVP (พึ่งลำดับที่ async ไม่การันตี)

## อันดับ
1. **ทีม 3 — Lookout Bell (47)** — เล็ก, server-side, กฎ FP ดีที่สุด, เป็นที่รวมของสัญญาณเดิมทั้งหมด
2. ทีม 1 — Berserk Watch (45) — แนวคิด "ผลเดิม" ดีและเข้าธีมสุด แต่ hash output ใช้กับเคสหลักไม่ได้และ scope ภาพใหญ่
3. ทีม 2 — Mana Ledger (41) — ไม่ซ้ำใคร ความเสี่ยงต่ำ แต่ตัวเลข attribution/forecast เป็นการเดามากกว่าที่ pitch ขาย
4. ทีม 4 — Infirmary (38) — ข้อมูลถูกหมด แต่ scope กว้างเกินรอบเดียว

**ผู้ชนะ (Judge B): ทีม 3 — Lookout Bell** โดยรวม detector เป็น `lib/loop.ts` ตัวเดียวตามข้างบน และยืม Berserk (ทีม 1) เป็นภาพของสถานะ 🔁 บนตัวละคร
