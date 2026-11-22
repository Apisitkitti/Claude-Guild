import { FNV_OFFSET_BASIS, FNV_PRIME } from "@/lib/constants";
import { m } from "@/paraglide/messages";

export const PAL = [
  "transparent",
  "#1a1c2c",
  "#3b2f3f",
  "#8b5e3c",
  "#c69c6d",
  "#f4e3c1",
  "#e8c9a0",
  "#b9805a",
  "#6e4a36",
  "#4a6fa5",
  "#d95763",
  "#5fa55a",
  "#f2c14e",
  "#8fd3ff",
  "#2b3a67",
  "#ffffff",
  "#7b5ea7",
] as const;

// ---- adventurer classes / monsters ----
export type AdvClass = "warrior" | "mage" | "rogue" | "cleric" | "ranger";
export const ADV_CLASSES: AdvClass[] = ["warrior", "mage", "rogue", "cleric", "ranger"];

const CLASS_LABEL: Record<AdvClass, () => string> = {
  warrior: () => m.class_warrior(),
  mage: () => m.class_mage(),
  rogue: () => m.class_rogue(),
  cleric: () => m.class_cleric(),
  ranger: () => m.class_ranger(),
};
/** class name in the viewer's language (a function, so it follows the locale at call time) */
export const classLabel = (cls: AdvClass): string => CLASS_LABEL[cls]();

export type MonsterKind = "slime" | "goblin" | "bat" | "skeleton" | "mushroom";
export const MONSTER_KINDS: MonsterKind[] = ["slime", "goblin", "bat", "skeleton", "mushroom"];

export type BossKind = "ogre" | "dragon";
export const BOSS_KINDS: BossKind[] = ["ogre", "dragon"];

const PAL_SHIRT_A = 9;
const PAL_SHIRT_B = 10;
const PAL_SHIRT_C = 11;
const PAL_SHIRT_D = 12;
const PAL_SHIRT_E = 16;
const PAL_SHIRT_F = 13;
const PAL_SKIN_A = 6;
const PAL_SKIN_B = 7;
const PAL_SKIN_C = 8;
/** hash bits consumed by each look trait (so traits vary independently) */
const HASH_SHIFT_SHIRT = 3;
const HASH_SHIFT_SKIN = 6;
const HASH_SHIFT_CLASS = 9;

const HAIRS = ["#3b2f3f", "#8b5e3c", "#f2c14e", "#d95763", "#1a1c2c", "#7b5ea7"];
/** indices into PAL */
const SHIRTS = [PAL_SHIRT_A, PAL_SHIRT_B, PAL_SHIRT_C, PAL_SHIRT_D, PAL_SHIRT_E, PAL_SHIRT_F];
const SKINS = [PAL_SKIN_A, PAL_SKIN_B, PAL_SKIN_C];

export interface Look {
  hair: string;
  shirt: string;
  skin: string;
  cls: AdvClass;
}

export const fnv1a = (text: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
};

export const lookFor = (sessionId: string): Look => {
  const hash = fnv1a(sessionId);
  return {
    hair: HAIRS[hash % HAIRS.length],
    shirt: PAL[SHIRTS[(hash >>> HASH_SHIFT_SHIRT) % SHIRTS.length]],
    skin: PAL[SKINS[(hash >>> HASH_SHIFT_SKIN) % SKINS.length]],
    cls: ADV_CLASSES[(hash >>> HASH_SHIFT_CLASS) % ADV_CLASSES.length],
  };
};

/** Squire look (subagents). */
export const INTERN_LOOK: Look = { hair: "#6e4a36", shirt: "#7a9a5a", skin: "#e8c9a0", cls: "warrior" };

// Fixed colours for sprite string chars (H/S/K are per-employee).
export const SPRITE_COLORS: Record<string, string> = {
  O: PAL[1],
  d: PAL[2],
  n: PAL[3],
  l: PAL[4],
  c: PAL[5],
  P: PAL[14],
  b: PAL[9],
  r: PAL[10],
  g: PAL[11],
  y: PAL[12],
  k: PAL[13],
  w: PAL[15],
  p: PAL[16],
  a: "#8d93a0",
};

// ---- cozy environment colours (kept for compatibility) + fantasy additions ----
export const COZY = {
  floorTones: ["#c9965f", "#c08d58", "#b98750", "#cf9e68", "#bd8b55"],
  seam: "#8a5c36",
  wallA: "#f1dfba",
  wallB: "#ead3a6",
  wallDot: "#e0c394",
  woodDark: "#4a2f20",
  woodMid: "#7b5236",
  woodLight: "#a8764a",
  woodTop: "#d2a574",
  woodHi: "#e6c295",
  curtain: "#c8606b",
  curtainHi: "#da7a84",
  curtainLo: "#a24853",
  chairs: ["#4f8f8b", "#c8606b", "#d9a441", "#5b7fb5"],
  rugs: [
    ["#b9553f", "#f1dfba", "#e0a050"],
    ["#4f7f6b", "#f1dfba", "#d9c27a"],
    ["#4f6f9f", "#f1dfba", "#e8b86a"],
    ["#8f5a7a", "#f1dfba", "#e0a050"],
  ],
  // fantasy additions
  grass: ["#5a9e4b", "#52964a", "#62a653", "#4f8c44", "#5ea150"],
  grassDark: "#3f7a38",
  dirt: ["#a8825a", "#9c7750", "#b48c62"],
  stoneWall: ["#8a8f9c", "#7e8391", "#969ba8"],
  stoneDark: "#5a5e6b",
  stoneLight: "#b5bac6",
  torchGlow: "#ffb347",
  sky: ["#8fd3ff", "#b9e4ff", "#dff3ff"],
  parchment: "#efe2c0",
  gold: "#e8c04e",
};
