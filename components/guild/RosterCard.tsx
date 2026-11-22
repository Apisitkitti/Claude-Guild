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

export const RosterCard = ({
  row,
  highlighted,
  selected,
  flashing,
  internsHidden,
  onToggleInterns,
  officeRef,
}: {
  row: RosterRow;
  highlighted: boolean;
  selected: boolean;
  flashing: boolean;
  internsHidden: boolean;
  onToggleInterns: () => void;
  officeRef: OfficeRef;
}) => {
  const chip = ACT_CHIP[row.act] ?? ACT_CHIP.thinking;
  const rpg = row as RpgRow;
  return (
    <li className={`card${highlighted ? " hl" : ""}${flashing ? " lvup" : ""}`} style={{ borderLeftColor: row.color }}>
      <button
        type="button"
        className="csel"
        onClick={() => officeRef.current?.select(row.id)}
        aria-pressed={selected}
        aria-label={`${row.tag} ${row.project}: ${row.status}`}
        title={row.status}
      >
        <Avatar look={row.look} />
        <span className="who">
          <b>
            {row.tag}
            {row.look.cls ? <span className="cls">{classLabel(row.look.cls)}</span> : null}
            {isNum(rpg.level) ? <span className="lv">Lv.{rpg.level}</span> : null}
          </b>
          <span className="proj">{row.project}</span>
        </span>
        <span className={`chip ${chip.cls}`} title={chip.label()}>
          {chip.label()}
        </span>
      </button>
      <Stats rpg={rpg} />
      <Mana rpg={rpg} />
      {(isNum(row.claims) || row.conflict) && (
        <div className="terr">
          {isNum(row.claims) && (
            <span className="tb claims" title={m.card_claims_title({ count: row.claims })}>
              🏳 {row.claims}
            </span>
          )}
          {row.conflict === "clash" && (
            <span className="tb clash" role="img" aria-label={m.card_clash_label()} title={m.card_clash_title()}>
              ⚔️
            </span>
          )}
          {row.conflict === "overlap" && (
            <span className="tb overlap" role="img" aria-label={m.card_overlap_label()} title={m.card_overlap_label()}>
              ⚔
            </span>
          )}
        </div>
      )}
      {row.interns > 0 && (
        <button
          className="itoggle"
          aria-expanded={!internsHidden}
          aria-label={m.card_interns({ count: row.interns })}
          title={m.card_interns_toggle()}
          onClick={onToggleInterns}
        >
          {internsHidden ? "▸" : "▾"} {m.card_interns({ count: row.interns })}
        </button>
      )}
      {row.interns > 0 && !internsHidden && <InternList list={row.internList} />}
    </li>
  );
};
