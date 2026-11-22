import type { RosterAct, RosterRow } from "@/lib/office/engine";
import { CLASS_LABEL } from "@/lib/office/palette";
import { Avatar } from "./Avatar";
import { InternList } from "./InternList";
import { Mana } from "./Mana";
import { Stats } from "./Stats";
import { isNum } from "./format";
import type { OfficeRef, RpgRow } from "./types";

const ACT_CHIP: Record<RosterAct, { cls: string; label: string }> = {
  typing: { cls: "c-magic", label: "✨ ร่ายเวท" },
  reading: { cls: "c-read", label: "📜 อ่านคัมภีร์" },
  bash: { cls: "c-combat", label: "⚔️ ต่อสู้" },
  handup: { cls: "c-seal pulse", label: "❗ ต้องการคุณ" },
  intern_handup: { cls: "c-seal pulse", label: "❗ ลูกมือต้องการ" },
  thinking: { cls: "c-grey", label: "ครุ่นคิด" },
  phone: { cls: "c-owl", label: "🦉 ส่งนกฮูก" },
  mcp: { cls: "c-portal", label: "🌀 พอร์ทัล" },
  sticky: { cls: "c-notes", label: "📝 จดบันทึก" },
  coffee: { cls: "c-tavern", label: "🍺 โรงเตี๊ยม" },
  stretch: { cls: "c-tavern", label: "บิดขี้เกียจ" },
  enter: { cls: "c-grey", label: "รับเควส" },
  leave: { cls: "c-grey", label: "กลับกิลด์" },
};

export function RosterCard({ r, highlighted, selected, flashing, internsHidden, onToggleInterns, officeRef }: {
  r: RosterRow; highlighted: boolean; selected: boolean; flashing: boolean; internsHidden: boolean; onToggleInterns: () => void; officeRef: OfficeRef;
}) {
  const chip = ACT_CHIP[r.act] ?? ACT_CHIP.thinking;
  const p = r as RpgRow;
  return (
    <li className={`card${highlighted ? " hl" : ""}${flashing ? " lvup" : ""}`} style={{ borderLeftColor: r.color }}>
      <button
        type="button"
        className="csel"
        onClick={() => officeRef.current?.select(r.id)}
        aria-pressed={selected}
        aria-label={`${r.tag} ${r.project}: ${r.status}`}
        title={r.status}
      >
        <Avatar look={r.look} />
        <span className="who">
          <b>{r.tag}{r.look.cls ? <span className="cls">{CLASS_LABEL[r.look.cls]}</span> : null}{isNum(p.level) ? <span className="lv">Lv.{p.level}</span> : null}</b>
          <span className="proj">{r.project}</span>
        </span>
        <span className={`chip ${chip.cls}`}>{chip.label}</span>
      </button>
      <Stats p={p} />
      <Mana p={p} />
      {(isNum(r.claims) || r.conflict) && (
        <div className="terr">
          {isNum(r.claims) && <span className="tb claims" title={`ถือครอง ${r.claims} ไฟล์`}>🏳 {r.claims}</span>}
          {r.conflict === "clash" && <span className="tb clash" role="img" aria-label="ชนกัน" title="ชนกัน!">⚔️</span>}
          {r.conflict === "overlap" && <span className="tb overlap" role="img" aria-label="แตะไฟล์เดียวกัน" title="แตะไฟล์เดียวกัน">⚔</span>}
        </div>
      )}
      {r.interns > 0 && (
        <button
          className="itoggle"
          aria-expanded={!internsHidden}
          aria-label={`ลูกมือ ${r.interns}`}
          title="ซ่อน/แสดงลูกมือ"
          onClick={onToggleInterns}
        >
          {internsHidden ? "▸" : "▾"} ลูกมือ {r.interns}
        </button>
      )}
      {r.interns > 0 && !internsHidden && <InternList list={r.internList} />}
    </li>
  );
}
