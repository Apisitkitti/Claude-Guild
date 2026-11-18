# Judge B — กรรมการสายวิศวกรรม

เลนส์: ความถูกต้องทางเทคนิค, security/privacy, ความเสี่ยงต่อ workflow ของ Claude Code, maintainability, testability (vitest ใน `tests/`), และขอบเขตจบใน 1 รอบจริงไหม
ตรวจข้อกล่าวอ้างกับโค้ดจริง: `lib/office/engine.ts`, `lib/store.ts`, `app/events/route.ts`, `hooks/settings.example.json`, `scripts/install-hooks.mjs`, `tests/engine/helpers.ts`

ข้อเท็จจริงสำคัญที่ใช้ตัดสิน:
- engine (`Office`) รันใน **browser** ไม่ใช่ server — อะไรที่นับ/เก็บใน engine จะเกิดเฉพาะตอนเปิดแท็บกิลด์อยู่ และ snapshot ตอน reconnect มีแค่ `MAX_EVENTS = 200` (store.ts:32)
- hook ทุกตัวตอนนี้เป็น `async: true` + `curl --max-time 1 ... || true` → Claude Code ไม่เคยรอ server เลย นี่คือสัญญาหลักของโปรเจกต์ ("server ปิดอยู่ Claude ก็ไม่สะดุด")
- engine มี `clock` ภายใน + `update(dt)` และ test harness headless (`makeCanvas`, `tick`, `stubStorage`) อยู่แล้ว แต่ยังใช้ `Math.random()`/`Date.now()`/`performance.now()` ตรง ๆ หลายจุด (ไม่ deterministic)
- `engine.ts:201` ดึง `file_path/path/notebook_path` จริง; `isForeignOrigin` กัน cross-origin POST อยู่แล้ว

## คะแนน

| ทีม | Impact (x2) | Delight | Feasibility | Theme | Risk (10=ต่ำ) | รวม /60 |
|---|---|---|---|---|---|---|
| 1 Territory Clash | 8 | 8 | 8 | 9 | 8 | **49** |
| 2 Guild Almanac | 5 | 8 | 7 | 9 | 9 | **43** |
| 3 Quest Chronicle | 5 | 9 | 4 | 8 | 6 | **37** |
| 4 Guild Rules / Wards | 8 | 8 | 5 | 7 | 3 | **39** |

## ความเห็นรายทีม

### ทีม 1 — Territory Clash (49)
- **จุดแข็ง:** แก้ปัญหาจริงของคนรันหลาย session บน repo เดียว ข้อมูลครบแล้ว (`file_path` ใน PreToolUse, `PostToolUseFailure.error` เป็นสัญญาณยืนยัน) ไม่ต้องแตะ hook ไม่เปลี่ยนสัญญา async ใช้โครง alert/แท็บ/Notification เดิม เป็น read-only 100% → ความเสี่ยงต่อ workflow ศูนย์ ขอบเขต M สมจริง ทดสอบด้วย harness เดิมได้ทันที
- **จุดอ่อน:** false positive สูงกว่าที่ pitch คิด — ถือครอง 10 นาทีหมายถึงการ "ส่งต่อ" ไฟล์ตามลำดับปกติ (A แก้เสร็จ, B มาแก้ต่อ) ก็ขึ้นดาบไขว้ ควรปล่อยดินแดนเมื่อ Stop ของ session นั้น และให้ PostToolUseFailure เป็นตัวยกระดับจริง; Bash write ตรวจไม่ได้ (ยอมรับแล้ว)
- **Must-fix ทางเทคนิค:** อย่าเก็บ clash tracker ไว้ใน engine ฝั่ง browser — reload/เปิดหลายแท็บจะลืม/ตรวจซ้ำ และ snapshot 200 events อาจตัดประวัติ ให้คำนวณใน `lib/store.ts` (server, single source of truth, normalize ด้วย `path.resolve(cwd, file)`) แล้วส่ง `clash` ใน snapshot/SSE + unit test ใน `tests/store.test.ts`

### ทีม 2 — Guild Almanac (43)
- **จุดแข็ง:** ความเสี่ยงต่ำสุด pure logic (`almanac.ts`) ทดสอบง่าย ไม่แตะ hook/server ใส่ใจ privacy (ไม่เก็บ input) และคิดเรื่องกันนับซ้ำด้วย `tool_use_id` ไว้แล้ว ไม่สร้างแรงจูงใจเรียก tool เกินจริง
- **จุดอ่อน:** ข้อมูล "ข้ามวัน/ข้ามสัปดาห์" ถูกนับเฉพาะตอนเปิดแท็บกิลด์อยู่ (engine อยู่ใน browser) ปิดแท็บ = Bestiary/Quest ไม่ขยับ ผิดคำสัญญา "ข้อมูลจริง 100%"; เปิดหลายแท็บ/หลายเครื่องนับซ้ำหรือแตกกัน; impact ต่องานจริงต่ำ (เป็น engagement ล้วน)
- **Must-fix ทางเทคนิค:** กำหนดจุดนับที่เดียวและ idempotent — dedupe ด้วย `tool_use_id` ที่ persist (ไม่ใช่แค่ in-memory) และกัน event จาก snapshot replay ตอน reconnect ไม่ให้นับซ้ำ; ใช้ `storage` event sync ข้ามแท็บแบบเดียวกับ `PROGRESS_KEY` และระบุชัดใน UI ว่านับเฉพาะตอนกิลด์เปิด

### ทีม 3 — Quest Chronicle (37)
- **จุดแข็ง:** demo สวยที่สุด การ์ด PNG shareable ใช้ sprite เดิม `computeChronicle(log)` เป็น pure function ทดสอบได้ดี privacy คิดไว้ดี (basename + ซ่อนชื่อโปรเจกต์ก่อน export)
- **จุดอ่อน:** scope ใหญ่เกินรอบเดียว: IndexedDB recorder + การ์ด + timelapse replay ด้วย engine ตัวที่สอง; engine ไม่ deterministic (`Math.random`, `Date.now` ใน persistence, `performance.now` ใน loop) — "seed จาก ts" ต้องรื้อหลายจุด; engine ที่ replay จะเขียน `PROGRESS_KEY`/ยิง Notification/เสียงซ้ำถ้าไม่ปิดผลข้างเคียง; log ก็เก็บได้เฉพาะตอนแท็บเปิด (ปัญหาเดียวกับทีม 2)
- **Must-fix ทางเทคนิค:** ตัด timelapse ออกจาก MVP หรือถ้าจะทำ ต้อง inject RNG + clock เข้า `Office` และรัน replay ใน `demo`-like mode ที่ไม่ persist/ไม่ notify พร้อม test ว่า replay ไม่แตะ localStorage จริง; ส่ง MVP แค่ recorder + recap card + Save PNG

### ทีม 4 — Guild Rules / Wards (39)
- **จุดแข็ง:** ไอเดียกล้าและ impact สูง (จาก "ดู" เป็น "คุม") คิด opt-in, fail-open, deny-only ไม่ approve แทน ซึ่งถูกทาง; matcher เป็น pure function ทดสอบได้; deny ผ่าน PreToolUse `permissionDecision: "deny"` ให้ Claude ปรับแผนได้จริง
- **จุดอ่อน:** เปลี่ยนสัญญาหลักของโปรเจกต์ — hook จาก async fire-and-forget เป็น **synchronous ทุก tool call** (matcher `*`) เพิ่ม latency ทุกครั้ง และ server ค้าง = Claude ช้า 2 วินาทีต่อ tool; fail-open ทำให้ "การป้องกัน" หายเงียบ ๆ ตอน server ปิด (ผู้ใช้เข้าใจผิดว่าปลอดภัย); ซ้ำกับ `permissions.deny` ที่ Claude Code มีอยู่แล้ว; endpoint แก้กฎบน localhost:5050 ไม่มี auth (local process ใดก็ปิดกฎได้); โหมด Ask long-poll 30s บล็อก session; glob หลบง่าย; scope จริงใหญ่กว่า M (hook script ใหม่, route ใหม่, file I/O ใน home, installer, UI)
- **Must-fix ทางเทคนิค:** อย่าให้ server อยู่ในเส้นทางตัดสินใจ — ให้ UI แปลง preset เป็น `permissions.deny` ใน settings.json (ผ่าน `install-hooks.mjs` แบบ dry-run/backup) หรือให้ `guard.sh` อ่าน `wards.json` เองแบบ local โดยไม่ต้องเรียก HTTP แล้วค่อยส่ง event ward แบบ async ให้กิลด์วาดโล่; matcher จำกัดเฉพาะ `Edit|Write|Bash` ไม่ใช่ `*`

## อันดับ
1. **ทีม 1 — Territory Clash (49)** — impact จริง ความเสี่ยงต่ำ ข้อมูลพร้อม จบในรอบเดียวได้
2. ทีม 2 — Guild Almanac (43) — ปลอดภัยและทดสอบง่าย แต่คุณค่าต่องานจริงน้อยและนับเฉพาะตอนแท็บเปิด
3. ทีม 4 — Guild Rules (39) — impact สูงแต่ทำลายสัญญา async ของ hook; ควรเป็นโปรเจกต์ถัดไปเมื่อออกแบบใหม่
4. ทีม 3 — Quest Chronicle (37) — โชว์ดีที่สุดแต่ scope/determinism เกินรอบเดียว

**ผู้ชนะ (Judge B): ทีม 1 — Territory Clash**
