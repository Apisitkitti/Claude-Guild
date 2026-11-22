import { PERCENT } from "@/lib/constants";
import { m } from "@/paraglide/messages";

import { fmtTok, isNum } from "./format";
import type { RpgRow } from "./types";

const MANA_HOT_PCT = 90;
const MANA_WARN_PCT = 70;

export const Mana = ({ rpg }: { rpg: RpgRow }) => {
  const { ctxUsed: used, ctxLimit: limit } = rpg;
  const valid = isNum(used) && isNum(limit) && limit > 0;
  const pct = valid ? Math.max(0, Math.min(PERCENT, Math.round((used / limit) * PERCENT))) : 0;
  const lvl = pct > MANA_HOT_PCT ? " hot" : pct > MANA_WARN_PCT ? " warn" : "";
  const tipParams = valid ? { used: fmtTok(used), limit: fmtTok(limit) } : { used: "", limit: "" };
  const tip = valid ? (rpg.ctxGuessed ? m.mana_tip_guessed(tipParams) : m.mana_tip(tipParams)) : "";
  if (!valid) return null;
  return (
    <div className="mana" title={tip}>
      <div
        className={`bar${lvl}`}
        role="progressbar"
        aria-label={m.mana_label()}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% ${tip}`}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="mpct">
        🔮 {rpg.ctxGuessed ? "≈" : ""}
        {pct}%
      </span>
    </div>
  );
};
