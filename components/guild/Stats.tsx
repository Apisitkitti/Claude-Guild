import { isNum } from "./format";
import type { RpgRow } from "./types";

export function Stats({ p }: { p: RpgRow }) {
  const { xp, xpNext, hp, hpMax, gold, kills } = p;
  const showXp = isNum(xp) && isNum(xpNext) && xpNext > 0;
  const showHp = isNum(hp) && isNum(hpMax) && hpMax > 0;
  if (!showXp && !showHp && !isNum(gold) && !isNum(kills)) return null;
  const pct = showXp ? Math.max(0, Math.min(100, (xp / xpNext) * 100)) : 0;
  const maxHearts = showHp ? Math.min(hpMax, 10) : 0;
  const hearts = showHp ? Math.max(0, Math.min(hp, maxHearts)) : 0;
  return (
    <div className="stats">
      {showXp && (
        <div className="xp" role="progressbar" aria-label="XP" aria-valuemin={0} aria-valuemax={xpNext} aria-valuenow={Math.min(xp, xpNext)}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="srow">
        {showHp && (
          <span className="hearts" role="img" aria-label={`หัวใจ ${hp}/${hpMax}`}>
            {Array.from({ length: maxHearts }, (_, k) => (k < hearts ? "♥" : "♡")).join("")}
          </span>
        )}
        {isNum(gold) && <span className="sgold" title="ทอง">💰 {gold}</span>}
        {isNum(kills) && <span className="skills" title="มอนสเตอร์ที่ฆ่า">⚔️ {kills}</span>}
      </div>
    </div>
  );
}
