import { PERCENT } from "@/lib/constants";

import { fmtTok, isNum } from "./format";
import type { RpgRow } from "./types";

const MANA_HOT_PCT = 90;
const MANA_WARN_PCT = 70;

export function Mana({ p }: { p: RpgRow }) {
  const { ctxUsed: used, ctxLimit: limit } = p;
  const valid = isNum(used) && isNum(limit) && limit > 0;
  const pct = valid ? Math.max(0, Math.min(PERCENT, Math.round((used / limit) * PERCENT))) : 0;
  const lvl = pct > MANA_HOT_PCT ? " hot" : pct > MANA_WARN_PCT ? " warn" : "";
  const tip = valid ? `${fmtTok(used)} / ${fmtTok(limit)} tokens${p.ctxGuessed ? " (ประมาณ)" : ""}` : "";
  if (!valid) return null;
  return (
    <div className="mana" title={tip}>
      <div
        className={`bar${lvl}`}
        role="progressbar"
        aria-label="Context"
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% ${tip}`}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="mpct">
        🔮 {p.ctxGuessed ? "≈" : ""}
        {pct}%
      </span>
    </div>
  );
}
