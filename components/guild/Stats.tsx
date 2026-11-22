import { PERCENT } from "@/lib/constants";
import { m } from "@/paraglide/messages";

import { isNum } from "./format";
import type { RpgRow } from "./types";

const MAX_HEARTS = 10;

export const Stats = ({ rpg }: { rpg: RpgRow }) => {
  const { xp, xpNext, hp, hpMax, gold, kills } = rpg;
  const showXp = isNum(xp) && isNum(xpNext) && xpNext > 0;
  const showHp = isNum(hp) && isNum(hpMax) && hpMax > 0;
  const pct = showXp ? Math.max(0, Math.min(PERCENT, (xp / xpNext) * PERCENT)) : 0;
  const maxHearts = showHp ? Math.min(hpMax, MAX_HEARTS) : 0;
  const hearts = showHp ? Math.max(0, Math.min(hp, maxHearts)) : 0;
  if (!showXp && !showHp && !isNum(gold) && !isNum(kills)) return null;
  return (
    <div className="stats">
      {showXp && (
        <div
          className="xp"
          role="progressbar"
          aria-label="XP"
          aria-valuemin={0}
          aria-valuemax={xpNext}
          aria-valuenow={Math.min(xp, xpNext)}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="srow">
        {showHp && (
          <span className="hearts" role="img" aria-label={m.stats_hearts({ hp: hp ?? 0, max: hpMax ?? 0 })}>
            {Array.from({ length: maxHearts }, (_, k) => (k < hearts ? "♥" : "♡")).join("")}
          </span>
        )}
        {isNum(gold) && (
          <span className="sgold" title={m.stats_gold()}>
            💰 {gold}
          </span>
        )}
        {isNum(kills) && (
          <span className="skills" title={m.stats_kills()}>
            ⚔️ {kills}
          </span>
        )}
      </div>
    </div>
  );
};
