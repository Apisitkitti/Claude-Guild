# Mana Ledger — บัญชีมานา: ใครกิน context, เมื่อไหร่จะเต็ม, อะไรสิ้นเปลือง
**One-liner:** ต่อยอด mana bar ที่มีอยู่ให้เป็น "ตัวพยากรณ์ + ผู้ชันสูตร" context ของทุก session: เหลืออีกกี่ turn ก่อน compact, tool call ไหน/ไฟล์ไหนกินมานาไปเท่าไหร่, และเตือนเมื่อมีของสิ้นเปลือง (อ่านไฟล์ซ้ำ, cache หลุด)

## ปัญหา
รัน Claude Code 3-5 session พร้อมกัน แล้ว session หนึ่งโดน auto-compact กลางงาน (ลืม context, คุณภาพตก) หรือ cache หลุดตอนพักแล้วเสียเงินเต็มราคา — โดยไม่รู้ล่วงหน้า ตอนนี้ mana bar บอกแค่ "ใช้ไปกี่ %" ไม่บอกว่า (1) จะเต็มเมื่อไหร่ (2) อะไรกิน (3) ควรทำอะไร (/compact เอง, แตก session ใหม่, ส่งให้ subagent)

## ทำงานยังไง
**Data source (มีจริงแล้ว/เพิ่มน้อยมาก):**
- `transcript_path` (ส่งมาในทุก event, `lib/transcript.ts` อ่าน tail อยู่แล้ว) → ต่อ assistant message แต่ละอัน: `usage.input_tokens / cache_read_input_tokens / cache_creation_input_tokens / output_tokens`, `message.model`, `timestamp`. ไม่นับ `isSidechain` (subagent) รวมกับ session แม่ แต่เก็บแยกเป็น "ค่าใช้จ่ายของ squire"
- `PostToolUse`: `tool_use_id`, `tool_name`, `tool_input.file_path|command|pattern`, `tool_response` (วัดแค่ความยาว string → ประมาณ token ≈ chars/4; ไม่เก็บเนื้อหา)
- `PreCompact`/`SessionStart(source=compact)`: ตัดรอบ + บันทึกว่า compact เกิดที่ใช้ไป X%
**Server (`lib/ledger.ts` ใหม่, state ใน `lib/store.ts`):** เก็บ ring buffer ต่อ session ~200 จุด `{t, used, cacheRead, cacheCreate, out}`; ทุก turn ได้ Δused = ขนาดที่ context โตจริง → จับคู่กับ tool call ที่อยู่ระหว่าง 2 assistant message นั้น (ถ้ามีหลายอันแบ่งตามสัดส่วนความยาว response แล้วติดป้าย "ประมาณ")
**แสดงผล:** (1) บนการ์ด session: "พยากรณ์ ~14 turn ถึง compact" (เฉลี่ยเคลื่อนที่ของ Δused 5 turn ล่าสุด; ซ่อนถ้าข้อมูลน้อยกว่า 3 turn) (2) panel "📜 Ledger": สปาร์กไลน์ context ต่อ session, ตาราง "ตัวกินมานา" Top 5 (เช่น `Read logs/app.log ≈ 38k tok`), ตัวเลข cache hit % (`cache_read / (cache_read+cache_creation+input)`), จำนวน compact ที่ผ่านมา (3) คำเตือนแบบกำหนดเงื่อนไขตายตัว: 🟡 อ่านไฟล์เดียวกัน ≥3 ครั้งใน session เดียว · 🟡 cache_creation พุ่งหลังเงียบ >5 นาที ("cache หลุด จ่ายเต็มรอบนี้ ≈ 60k tok") · 🔴 คาดว่าถึง 90% ใน <5 turn → toast ภาษาไทย "แนะนำ /compact ตอนนี้ ก่อนมันกลืนงานกลางทาง"
**Demo moment:** โหมด demo จำลอง session ที่ Read ไฟล์ใหญ่ → เส้นสปาร์กไลน์ชัน, ตัวเลขพยากรณ์ลดฮวบ 14→5 turn, แถว "กินมานา" ขึ้นอันดับ 1 พร้อมชื่อไฟล์, toast 🔴 เด้ง, เสร็จแล้ว compact → เส้นตกลง จอแสดงตัวเลข "ประหยัดได้" ก่อน/หลัง

## ทำไมคุ้ม
เปลี่ยนจาก "ดูว่าเกิดอะไร" เป็น "ตัดสินใจก่อนพัง" — compact เองตอนจังหวะดี ดีกว่าโดนบังคับกลางแก้บั๊ก; รู้ว่า cache หลุดเพราะพักนานจะได้ไม่ปล่อย session ค้างแล้วกลับมาจ่ายแพง; เห็นรูปแบบข้าม session (ไฟล์เดียวกันถูกอ่านซ้ำในทุก session = ควรเขียนลง CLAUDE.md). ใช้กับ review judge: ข้อมูลจริง 100% ไม่มีตัวเลขสุ่ม, ไม่ต้องมี hook ใหม่ (ใช้ event ที่ hook ไว้อยู่แล้ว)

## ขอบเขต MVP (ขนาด M)
- `lib/transcript.ts`: ขยาย `readContext` ให้คืนอนุกรมของ usage (ตอนนี้คืนแค่ค่าล่าสุด) + จับ compact boundary
- `lib/ledger.ts` (ใหม่, pure): forecast, attribution, rule คำเตือน + unit test ด้วย transcript fixture
- `lib/store.ts`: เก็บ ring buffer, ส่ง SSE event `ledger` (บีบเป็นตัวเลขล้วน) · `app/events/route.ts`: ส่ง `tool_response` length เท่านั้นเข้า ledger (ไม่เก็บ body)
- `components/OfficeApp.tsx` + `globals.css`: panel Ledger, badge พยากรณ์บนการ์ด, toast; demo scenario ใน `lib/office/sim.ts`
- ไม่แตะ canvas/ตัวละคร (เลี่ยงกฎ translucent) — ทั้งหมดเป็น DOM overlay

## ความเสี่ยง + วิธีกัน
- **ตัวเลขไม่ exact:** hooks ไม่ให้ token ต่อ tool call; มีแค่ usage ต่อ assistant message → แสดงเป็น "≈" และเขียนชัดว่า attribution คือการประมาณจาก Δcontext; ไม่ทำ "ราคา $" ใน MVP (ราคาเปลี่ยน/ต่างตาม plan; ทำเป็น env table ภายหลังและติดป้ายประมาณ)
- **context limit เดาไม่ได้** (200k vs 1M): ใช้ตรรกะ `limitGuessed` เดิม + `CLAUDE_OFFICE_CTX_LIMIT`; ถ้าเดา ให้ซ่อน toast 🔴 และโชว์แค่แนวโน้ม
- **transcript format เปลี่ยน/ไม่มีไฟล์:** parser ทนพัง (try/catch เหมือนเดิม) → ถ้า null ซ่อนฟีเจอร์ ไม่ทำให้ที่เหลือล่ม
- **ขวางไม่ได้:** hook เป็น async → ทำได้แค่เตือน/แนะนำ ไม่สั่ง compact แทนผู้ใช้ และไม่โฆษณาว่าป้องกันได้
- **Privacy/security:** อ่านเฉพาะ path ใต้ `~/.claude/projects/*.jsonl` (guard เดิม), เก็บเฉพาะตัวเลข + ชื่อไฟล์/tool, ไม่เก็บ prompt/response, อยู่ใน memory ของ process, ไม่ส่งออกนอกเครื่อง
- **พยากรณ์แกว่ง:** ใช้ median ของ Δ 5 turn + ต้องมี ≥3 จุดก่อนแสดง + หยุดเตือนซ้ำ 2 นาทีต่อ session
