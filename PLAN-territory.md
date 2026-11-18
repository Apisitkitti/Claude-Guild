# Plan: ⚔️ Territory Clash (ผู้ชนะ hackathon) — Opus, 2026-11-18

อ้างอิง: [hackathon/pitch-team1.md](hackathon/pitch-team1.md), [hackathon/RESULTS.md](hackathon/RESULTS.md)

**เป้าหมาย:** เมื่อหลาย session แก้ไฟล์เดียวกัน กิลด์บอกทันที — เห็น "ดินแดน" ของแต่ละคนตลอดเวลา และเห็นศึกเมื่อชน
**ข้อจำกัดที่ต้องพูดตรงๆ:** hook เป็น async → **เตือนได้ ขวางไม่ได้**

## นิยาม
- **ดินแดน (claim):** ไฟล์ที่ session แก้ผ่าน Edit / Write / MultiEdit / NotebookEdit (PreToolUse)
  - path = `path.resolve(cwd, file_path|notebook_path)` แล้ว normalize
  - ไม่นับ: `node_modules/`, `.git/`, `/tmp`, `/private/tmp`, scratchpad, `.next/`
- **ถือครองจน:** session นั้น `Stop` / `SessionEnd` / ไม่แตะไฟล์นั้น 10 นาที
- **subagent:** squire ของ session เดียวกันนับเป็นของ session แม่ (ไม่ชนกันเอง)
- **🟡 Overlap:** session B แก้ไฟล์ที่ A ถือครองอยู่ (A ยังไม่ Stop) → ไฟล์มีผู้ถือ ≥ 2
- **🔴 Clash:** `PostToolUseFailure` ของ edit tool บนไฟล์ที่ session อื่นถือครอง/เพิ่งแตะใน 2 นาที
- จบเมื่อเหลือผู้ถือ ≤ 1 หรือผู้ใช้กด dismiss (dismiss ฝั่ง client ต่อไฟล์+คู่ session)

## Server (single source of truth)
- `lib/territory.ts` (ใหม่, pure, test ง่าย): `TerritoryTracker` — `onEvent(evt, now)` → คืน `changed: boolean`; `snapshot()`; `sweep(now)`; caps: ≤ 50 claims/session, ≤ 2000 รวม
- `lib/store.ts`: เรียก tracker ใน `addEvent`, เมื่อเปลี่ยน → broadcast `event: territory` + ใส่ใน `snapshot()`; sweep ใน timer เดิม; STORE_VERSION +1
- รูปข้อมูล (path ส่งเป็น relative ต่อ repo root ถ้าหาได้จาก cwd ร่วม ไม่งั้น basename + โฟลเดอร์แม่ — ไม่ส่ง absolute path ที่ไม่จำเป็น):
```ts
type TerritoryMsg = {
  claims: { sid: string; files: string[] }[];          // ดินแดนของแต่ละคน (ย่อ)
  conflicts: { file: string; sids: string[]; level: "overlap" | "clash"; since: number }[];
};
```

## Client
- `live.ts`: `addEventListener("territory")` → `office.setTerritory(msg)`; snapshot อ่าน `territory`
- **engine:** เก็บ claims/conflicts; RosterRow เพิ่ม `claims?: number`, `conflict?: "overlap"|"clash"`; `OfficeView.conflicts?`
- **render:**
  - ธงเล็กสีประจำตัวปักข้างช่องสู้ + ตัวเลขจำนวนไฟล์ที่ถือ (มองเห็นตลอด — ข้อเสนอกรรมการ C)
  - 🟡: เส้นประสีเหลืองเชื่อมสองคน + ไอคอน ⚔️ เล็กกลางเส้น
  - 🔴: ดาบไขว้ประกายแดงกลางเส้น, ทั้งคู่หันเข้าหากัน, `addTrauma` เบาๆ (เคารพ reduced-motion), banner "⚔️ auth.ts" สั้นๆ
  - ต้องไม่ทับตัวละคร (วาดก่อน entity หรือเป็น UI ด้านบน ไม่ใช่ tint)
- **panel:**
  - การ์ด: badge 🏳 N (จำนวนไฟล์), ⚔️ เมื่อชน
  - section ใหม่ "ดินแดน" (พับได้ เหมือน section อื่น): รายการ conflict (ไฟล์, คู่ session, ระดับ, ปุ่ม ✕ dismiss, คลิกชื่อ = select ตัวละคร); ว่าง = "ยังไม่มีศึก"
  - หมายเหตุใน section: "ตรวจเฉพาะ Edit/Write — คำสั่ง Bash ที่เขียนไฟล์ยังไม่นับ"
- **alerts:** เฉพาะ 🔴 → ชื่อแท็บ `⚔️(N)` (รวมกับ ❗ ได้: `❗(1) ⚔️(1) Claude Guild`) + desktop notification (ใช้ opt-in 🔔 เดิม, rate limit เดิม); 🟡 → แค่ badge/เส้น/log
- **sim/demo:** ทุก ~60–90s ให้ 2 นักผจญภัยแก้ไฟล์เดียวกัน, บางครั้งตามด้วย failure → clash
- ไม่ทำ: เสียง, Bash-write detection, git branch/worktree

## Tests
- `tests/territory.test.ts`: normalize/ignore list, claim/release on Stop/SessionEnd/expiry, squire = แม่, overlap → clash ด้วย failure, ไม่ชนกับตัวเอง, caps, relative path display
- `tests/store.test.ts`: broadcast `territory` เมื่อเปลี่ยนเท่านั้น, อยู่ใน snapshot
- `tests/engine/*`: setTerritory → roster badges/conflicts, dismiss, waiting+clash title count

## แบ่งงาน (Sonnet 2 ตัวพร้อมกัน → Opus review → fix → verify → commit)
| Agent | ไฟล์ |
|---|---|
| Server | `lib/territory.ts`, `lib/store.ts`, `tests/territory.test.ts`, `tests/store.test.ts` |
| Client | `lib/office/{live,engine,render,sim}.ts`, `components/OfficeApp.tsx`, `app/globals.css`, `tests/engine/**` |
