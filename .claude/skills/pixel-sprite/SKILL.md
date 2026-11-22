---
name: pixel-sprite
description: Add or redesign a Claude Guild pixel-art sprite - adventurer class, squire, NPC (bard/chef/innkeeper), monster or boss. Use for "วาดตัวละคร", "sprite", "pixel art", "ออกแบบ monster", "boss ใหม่", "character design", "หน้าตาตัวละคร", or any change to the look of a character on the canvas.
---

# pixel-sprite

All sprites are code, not image files: each builder paints onto an in-memory grid, outlines it, converts it to an `HTMLCanvasElement`, and caches it. `render.ts` draws that canvas 1:1 with `ctx.drawImage` (the world canvas is scaled up, so never scale per-sprite). Read the existing file for your type first and copy its style.

## Hard rules (from the user - never break)
1. Characters are never translucent or tinted, and nothing translucent is drawn over a character. Every sprite colour is opaque `#rrggbb`. The hurt flash is an opaque lighter palette, not an overlay. (The adventurer's red hurt glow in `drawAdventurer` sits BEHIND the sprite; keep it that way.)
2. Every character needs its own recognisable design: distinct silhouette plus a signature prop. Not a recolour. Example: the bard holds a lute, the ranger uses a bow (not a sword), the chef stirs a pot.
3. Monsters and bosses must look menacing, not cute: fangs, glowing red or violet eyes, claws, horns, hunched or aggressive posture.
4. Drawing files are exempt from `no-magic-numbers` (eslint override for `sprites.ts`, `npcSprites.ts`, `bossSprites.ts`, `monsterSprites.ts`, `render.ts`, `tests/**`). Do not add named constants for pixel coordinates. Any other file (palette, layout) is NOT exempt.
5. A dark 1px outline closes every silhouette (see below).

## Which file, which size
| Type | File | Builder | Canvas |
|---|---|---|---|
| Adventurer (warrior, mage, rogue, cleric, ranger; `ADV_CLASSES`) | `lib/office/sprites.ts` | `charSprite(look, pose, frame)` | 16x24, feet on row 23 |
| Squire (subagent) | `lib/office/sprites.ts` | `internSprite(pose, frame)` | 12x18 |
| NPC | `lib/office/npcSprites.ts` | `bardSprite(playing, frame)`, `chefSprite(pose, frame)`, `innkeeperSprite(frame)` | `NPC_W` x `NPC_H` = 16x24 |
| Monster (`MONSTER_KINDS`) | `lib/office/monsterSprites.ts` | `monsterSprite(kind, frame, hurt)` | `MON_W` x `MON_H` = 20x20, `MON_FRAMES` = 4, creature feet on row 18 (`GROUND`), outline row 19 |
| Boss (`BOSS_KINDS`: ogre, dragon, lich) | `lib/office/bossSprites.ts` | `bossSprite(kind, frame, hurt)` | `BOSS_W` x `BOSS_H` = 32x32, `BOSS_FRAMES` = 4, feet on bottom row |
| Props / small icons | `lib/office/sprites.ts` | `prop(name)` via `PROPS` | any |

Monsters and bosses face LEFT (toward the adventurer). Kinds and class names are unions in `lib/office/palette.ts` (`AdvClass`, `MonsterKind`, `BossKind` plus the `ADV_CLASSES` / `MONSTER_KINDS` / `BOSS_KINDS` arrays). Add new kinds there first; `render.ts` and layout code then see them. Adventurer colours come from `Look` (`lookFor(sessionId)`: hair, shirt, skin, cls); class cloth colours come from `mkPal` / `clothFor` in `sprites.ts`.

## Data format
Two styles, both real:

**1. ASCII art, one letter per colour (NPCs, props).** `npcSprites.ts` has a `COLORS` map and a `Pixels.stamp(x0, y0, art)` method; `.` is empty:
```ts
const KEEPER_LEGS = ["....NNN..NNN....", "....NNN..NNN....", "...NNNN..NNNN..."];
const drawKeeper = (pixels: Pixels, frame: number) => {
  pixels.stamp(0, 17, KEEPER_LEGS);
  pixels.stamp(0, 1 + bob, KEEPER_HEAD); // head bobs by shifting the stamp
};
export const innkeeperSprite = (frame: number) => {
  const index = wrap(frame, CLOTH_X.length);
  return cached(`keeper|${index}`, (pixels) => drawKeeper(pixels, index)); // cached() also runs outline()
};
```
`sprites.ts` `PROPS` uses the same idea with `EXTRA` plus `SPRITE_COLORS` letters and `rowsToCanvas`.

**2. Procedural `Grid` calls (adventurers, monsters, bosses).** `Grid(width, height)` from `sprites.ts` has `set`, `get`, `row(y,x0,x1,c)`, `rect(x0,y0,x1,y1,c)`, `outline()`, `recolor(fn)`, `recolorFill(fn)`, `toCanvas()`, and `dx`/`dy` offsets used for bob and squash. Colour helpers: `mix`, `lighten`, `luma`, `INK`. Monster-only helpers: `blob` (shaded ellipse), `tri`. Bosses subclass `Grid` (rounds coordinates) adding `ell`, `tri`, `line`, `limb` taking a `Ramp { base, hi, sh, dk }` (base, highlight, shadow, dark).
```ts
const grid = new Grid(MON_W, MON_H);
drawGoblin(grid, frame);
grid.outline();
if (hurt) grid.recolor(hurtTone);
return grid.toCanvas();
```

## Palette and outline
- Use a 3-4 tone ramp per material (base / highlight upper-left / shadow lower-right), like `Ramp` or the `STEEL`, `STEEL_HI`, `STEEL_SH` constants in `sprites.ts`. Define new colours as hex consts at the top of the file; the shared `PAL` array in `palette.ts` is for the world, not for sprites.
- Outline: always call `grid.outline()` (or `cached()` in NPCs) LAST before `toCanvas()`. It paints every empty cell touching a filled one with `mix(neighbour, INK, 0.8)`, a dark shade of the neighbouring fill. So leave a 1px empty border: nothing but outline on row 0, column 15 (NPCs) or the last row.
- Hurt variant: monsters use `grid.recolor(hurtTone)` (lighter, reddish); bosses use `grid.recolorFill(...)` which skips cells in `grid.inked`, so the outline stays dark and the silhouette holds. Keep dark fills (`luma < 40`) as they are.

## Frames and animation
- Adventurer: `normFrame(frame, count)` wraps; `walk` has 4 frames, all other poses 2. Poses: `idle walk attack cast read write hand_up hurt drink cheer rest`. `render.ts` picks pose and frame in `poseFor(emp, time)` (e.g. `Math.floor(time * 1.5) % 2`) and draws in `drawAdventurer`. The weapon hand sits at fixed spots the duel code relies on (idle 12,15; attack wind-up 12,10; strike 11,14; ranger 11,13): keep them.
- Monster/boss: 4 frames, `frame` is wrapped with a modulo that also handles negatives and NaN. In `render.ts` the frame is `Math.floor(time * 3 + emp.order) % 4` (`% 2` for a boss that is not fighting). Bosses use only frames 0-1 (the calm pair) while walking out or idle; the menace frames (fire breath, spectral flame) are reserved for `fighting`. Put attack-only effects on frames 2-3.
- NPC: frame counts are per pose (bard `BARD_FRAMES.playing` / `.resting`; chef 4; keeper 4). Drawn in `render.ts` near `chefSprite(...)`, `bardSprite(...)`, `innkeeperSprite(...)`.
- Every public builder caches by key and wraps the frame; copy that pattern (`cache.get(key)`).

## Wiring
- New adventurer class: extend `AdvClass` + `ADV_CLASSES` + `CLASS_LABEL` in `palette.ts` (and the `m.class_*` messages), add a `case` in `drawBody` (and `drawHead` / `drawLegs` / `drawOffhand` where the class differs), a weapon in `drawWeapon`, and `CLASS_PANTS`/`clothFor` entries in `sprites.ts`.
- New monster or boss kind: extend `MonsterKind`/`BossKind` and the arrays in `palette.ts`, add a `drawX` and a branch in `buildMonster` / `build`. `render.ts` (the `monsterSprite` / `bossSprite` calls in the dungeon preview and the fight drawing; grep for them) needs no change unless sizes change.
- Boss placement: drawn centred at `bossCenterX(posX)` = `min(posX + BOSS_DX, WORLD_W - BOSS_W/2)`, `BOSS_DX = 12`. `layout.ts` mirrors it as `BOSS_DRAW_DX` in `routeBoss`; change both together. Changing `BOSS_W/H` or `MON_W/H` also affects the overlap test in `bossSprites.test.ts`.
- New NPC: new file section in `npcSprites.ts` with a `drawX`, an exported builder using `cached(...)`, then call it from `render.ts`.

## Tests (vitest, `npm test`)
Tests stub `document.createElement` with a fake canvas that records `fillRect` calls (`cellsOf` / `opsOf`). Extend the one for your type:
- `tests/classSprites.test.ts`: 16x24 for every class/pose/frame, hex-only colours, feet on row 23, dark top row, weapon hand glove colour at the duel spots (`GLOVE`), pairwise `diff > MIN_DIFF` (60 px) between classes for idle/walk/attack/drink, squire 12x18.
- `tests/npcSprites.test.ts`: `NPC_W` x `NPC_H`, cache identity with wrapped frames, all animation frames distinct (`Set` size = frame count), row 0 and column 15 only dark outline.
- `tests/monsterSprites.test.ts`: 20x20, hex colours, `cells.size > 80`, consecutive frames differ by more than 3 px, feet in the bottom three rows, hurt = same silhouette keys but different colours, silhouettes distinct per kind, cache and NaN/negative frame wrapping.
- `tests/bossSprites.test.ts`: 32x32, `ops.length > 150`, 4 distinct frames, distinct silhouettes, hurt is lighter, opaque and keeps a dark outline, `> 3` pixels on the bottom row, plus the `bossCenterX` / route placement tests.
A new kind gets picked up automatically by loops over `MONSTER_KINDS` / `BOSS_KINDS` / `ADV_CLASSES`; for NPCs add explicit cases. A new asserted property (e.g. a signature prop colour at a known pixel, like the `GLOVE` check) is worth a test.

## Verify
1. `npm test` (and `npm run lint` if you touched non-drawing files).
2. Look at it live: use the sibling skill `guild-simulate` to get the type on screen (spawn a session, start a fight, trigger a boss or NPC scene), with the built-in browser pane via `preview_start` config `office-dev` (localhost:5050). Take a screenshot, then `zoom` on the sprite region; check each frame, the hurt flash, and facing. Never kill running processes; reuse the dev server if it is already up.
3. Squint test: is the silhouette distinct from the others, is the prop readable, does a monster look threatening at 1x?
