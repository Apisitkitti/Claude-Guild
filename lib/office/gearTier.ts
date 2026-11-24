// Level tiers shared by the look (gear on the sprite, Lv badge colour) and combat (damage, crit, class skill).

export type GearTier = 0 | 1 | 2 | 3 | 4;

const ADEPT_LV = 5;
const VETERAN_LV = 10;
const ELITE_LV = 15;
const LEGEND_LV = 20;
/** first level of each tier: Lv1 novice, Lv5 adept, Lv10 veteran, Lv15 elite, Lv20 legend */
export const GEAR_TIER_LEVELS: readonly number[] = [1, ADEPT_LV, VETERAN_LV, ELITE_LV, LEGEND_LV];

export const GEAR_TIER_NAMES = ["novice", "adept", "veteran", "elite", "legend"] as const;
export type GearTierName = (typeof GEAR_TIER_NAMES)[number];

export const gearTier = (level: number): GearTier => {
  let tier = 0;
  for (let i = 0; i < GEAR_TIER_LEVELS.length; i++) if (level >= GEAR_TIER_LEVELS[i]) tier = i;
  return tier as GearTier;
};

export const gearTierName = (level: number): GearTierName => GEAR_TIER_NAMES[gearTier(level)];
