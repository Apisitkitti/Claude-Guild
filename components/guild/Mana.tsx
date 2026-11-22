import { fmtTok, isNum } from "./format";
import type { RpgRow } from "./types";

export function Mana({ p }: { p: RpgRow }) {
  const { ctxUsed: used, ctxLimit: limit } = p;
  if (!isNum(used) || !isNum(limit) || limit <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
  const lvl = pct > 90 ? " hot" : pct > 70 ? " warn" : "";
  const tip = `${fmtTok(used)} / ${fmtTok(limit)} tokens${p.ctxGuessed ? " (ประมาณ)" : ""}`;
  return (
    <div className="mana" title={tip}>
      <div className={`bar${lvl}`} role="progressbar" aria-label="Context" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}% ${tip}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="mpct">🔮 {p.ctxGuessed ? "≈" : ""}{pct}%</span>
    </div>
  );
}
