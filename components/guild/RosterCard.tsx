import type { RosterAct, RosterRow } from "@/lib/office/engine";
import { classLabel } from "@/lib/office/palette";
import { m } from "@/paraglide/messages";

import { Avatar } from "./Avatar";
import { isNum } from "./format";
import { InternList } from "./InternList";
import { Mana } from "./Mana";
import { Stats } from "./Stats";
import type { OfficeRef, RpgRow } from "./types";

const ACT_CHIP: Record<RosterAct, { cls: string; label: () => string }> = {
  typing: { cls: "c-magic", label: () => m.act_typing() },
  reading: { cls: "c-read", label: () => m.act_reading() },
  bash: { cls: "c-combat", label: () => m.act_bash() },
  handup: { cls: "c-seal pulse", label: () => m.act_handup() },
  intern_handup: { cls: "c-seal pulse", label: () => m.act_intern_handup() },
  thinking: { cls: "c-grey", label: () => m.act_thinking() },
  phone: { cls: "c-owl", label: () => m.act_phone() },
  mcp: { cls: "c-portal", label: () => m.act_mcp() },
  sticky: { cls: "c-notes", label: () => m.act_sticky() },
  coffee: { cls: "c-tavern", label: () => m.act_coffee() },
  stretch: { cls: "c-tavern", label: () => m.act_stretch() },
  enter: { cls: "c-grey", label: () => m.act_enter() },
  leave: { cls: "c-grey", label: () => m.act_leave() },
};

export function RosterCard({
  r,
  highlighted,
  selected,
  flashing,
  internsHidden,
  onToggleInterns,
  officeRef,
}: {
  r: RosterRow;
  highlighted: boolean;
  selected: boolean;
  flashing: boolean;
  internsHidden: boolean;
  onToggleInterns: () => void;
  officeRef: OfficeRef;
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
          <b>
            {r.tag}
            {r.look.cls ? <span className="cls">{classLabel(r.look.cls)}</span> : null}
            {isNum(p.level) ? <span className="lv">Lv.{p.level}</span> : null}
          </b>
          <span className="proj">{r.project}</span>
        </span>
        <span className={`chip ${chip.cls}`} title={chip.label()}>
          {chip.label()}
        </span>
      </button>
      <Stats p={p} />
      <Mana p={p} />
      {(isNum(r.claims) || r.conflict) && (
        <div className="terr">
          {isNum(r.claims) && (
            <span className="tb claims" title={m.card_claims_title({ count: r.claims })}>
              🏳 {r.claims}
            </span>
          )}
          {r.conflict === "clash" && (
            <span className="tb clash" role="img" aria-label={m.card_clash_label()} title={m.card_clash_title()}>
              ⚔️
            </span>
          )}
          {r.conflict === "overlap" && (
            <span className="tb overlap" role="img" aria-label={m.card_overlap_label()} title={m.card_overlap_label()}>
              ⚔
            </span>
          )}
        </div>
      )}
      {r.interns > 0 && (
        <button
          className="itoggle"
          aria-expanded={!internsHidden}
          aria-label={m.card_interns({ count: r.interns })}
          title={m.card_interns_toggle()}
          onClick={onToggleInterns}
        >
          {internsHidden ? "▸" : "▾"} {m.card_interns({ count: r.interns })}
        </button>
      )}
      {r.interns > 0 && !internsHidden && <InternList list={r.internList} />}
    </li>
  );
}
