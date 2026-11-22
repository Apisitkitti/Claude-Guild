# Design system

All visual tokens are defined once, in the `@theme static` block at the top of `app/globals.css` (Tailwind CSS v4). Colors are named by role, not by hue.

## Using tokens

- In CSS: `color: var(--color-gold); background: var(--color-panel); border-radius: var(--radius-md); font-size: var(--text-sm);`
- In markup, as Tailwind utilities: `<div className="bg-panel text-gold rounded-md text-sm font-serif">`. Utilities live in a CSS layer, so unlayered rules in `globals.css` (`.card`, `.bar`, ...) win over them on conflicts.
- Only the tokens below exist: Tailwind's default palette is reset (`--color-*: initial`). Tailwind's preflight is not imported, so global resets stay in `globals.css` and nothing visual changes when adding utilities.
- Do not hard-code hex colors or font stacks in rules; add a token first. Legacy aliases (`--bg`, `--panel2`, `--accent`, `--serif`...) are still defined in a `:root` block but new code should use `--color-*`/`--font-*`.

## Colors

| Token                                   | Value       | Swatch    | Used for                                                      |
| --------------------------------------- | ----------- | --------- | ------------------------------------------------------------- |
| `--color-bg` (`surface`)                | `#17110c`   | #17110c   | page background, darkest wood                                 |
| `--color-bg-glow` (`surface`)           | `#35241a`   | #35241a   | centre of the app radial gradient                             |
| `--color-panel` (`surface`)             | `#2a1c12`   | #2a1c12   | header bar and side panel background                          |
| `--color-panel-inset` (`surface`)       | `#1d140d`   | #1d140d   | pill, search input and toggle track background                |
| `--color-canvas` (`surface`)            | `#000`      | #000      | stage canvas background                                       |
| `--color-parchment` (`parchment`)       | `#f1e2c0`   | #f1e2c0   | card, queue item, receipt background                          |
| `--color-parchment-deep` (`parchment`)  | `#efdfb8`   | #efdfb8   | quest log background                                          |
| `--color-parchment-hover` (`parchment`) | `#f8ecce`   | #f8ecce   | card hover/highlight background                               |
| `--color-parchment-flash` (`parchment`) | `#fff3c4`   | #fff3c4   | level-up flash background                                     |
| `--color-parchment-track` (`parchment`) | `#e9d6a6`   | #e9d6a6   | XP bar track, territory badge background                      |
| `--color-parchment-edge` (`parchment`)  | `#b8975f`   | #b8975f   | card, queue and receipt borders                               |
| `--color-wood` (`wood`)                 | `#7a4e2c`   | #7a4e2c   | wood frame mid-tone, scrollbar thumb                          |
| `--color-wood-dark` (`wood`)            | `#4a2d18`   | #4a2d18   | borders, buttons, class badge text                            |
| `--color-wood-light` (`wood`)           | `#8a5a35`   | #8a5a35   | top of the stage frame gradient                               |
| `--color-wood-deep` (`wood`)            | `#5a3a20`   | #5a3a20   | level badge and checked toggle background                     |
| `--color-wood-shadow` (`wood`)          | `#2a170a`   | #2a170a   | stage frame border, level badge border                        |
| `--color-wood-canvas` (`wood`)          | `#2a1a0f`   | #2a1a0f   | canvas border                                                 |
| `--color-line` (`line`)                 | `#6b4a2e`   | #6b4a2e   | default borders and dividers                                  |
| `--color-line-soft` (`line`)            | `#6b4a2e55` | #6b4a2e55 | dotted dividers in the quest log                              |
| `--color-line-hover` (`line`)           | `#8a6440`   | #8a6440   | hovered input and toggle border                               |
| `--color-text` (`text`)                 | `#f3e3bf`   | #f3e3bf   | body text on dark surfaces                                    |
| `--color-dim` (`text`)                  | `#b79f7c`   | #b79f7c   | secondary text on dark surfaces                               |
| `--color-ink` (`ink`)                   | `#3a2412`   | #3a2412   | text on parchment                                             |
| `--color-ink-dim` (`ink`)               | `#6e5538`   | #6e5538   | secondary text on parchment                                   |
| `--color-ink-strong` (`ink`)            | `#1b1410`   | #1b1410   | text on coloured chips                                        |
| `--color-ink-on-gold` (`ink`)           | `#2b1a0c`   | #2b1a0c   | text on active gold buttons                                   |
| `--color-gold` (`gold`)                 | `#e0b04a`   | #e0b04a   | accent: headings, focus rings, active controls, warning/amber |
| `--color-gold-dark` (`gold`)            | `#8a6420`   | #8a6420   | borders of gold elements                                      |
| `--color-gold-bright` (`gold`)          | `#f2c14e`   | #f2c14e   | highlight outline, mana warn                                  |
| `--color-gold-glow` (`gold`)            | `#ffd75a`   | #ffd75a   | level-up glow                                                 |
| `--color-gold-yellow` (`gold`)          | `#f2d24a`   | #f2d24a   | territory overlap level                                       |
| `--color-gold-a0` (`gold`)              | `#e0b04a00` | #e0b04a00 | transparent gold (animation end)                              |
| `--color-gold-a33` (`gold`)             | `#e0b04a55` | #e0b04a55 | focus ring on search input                                    |
| `--color-gold-a53` (`gold`)             | `#e0b04a88` | #e0b04a88 | inset frame highlight, toggle focus ring                      |
| `--color-danger` (`danger`)             | `#b3262b`   | #b3262b   | errors, permission, clash, hearts                             |
| `--color-danger-dark` (`danger`)        | `#8d1a1f`   | #8d1a1f   | danger text on parchment, hover                               |
| `--color-danger-deep` (`danger`)        | `#5a0f12`   | #5a0f12   | border of danger chips                                        |
| `--color-danger-text` (`danger`)        | `#a8403f`   | #a8403f   | secondary text on failed rows                                 |
| `--color-danger-bright` (`danger`)      | `#ff5a5a`   | #ff5a5a   | mana hot                                                      |
| `--color-danger-tint` (`danger`)        | `#b3262b1f` | #b3262b1f | failed log row background                                     |
| `--color-on-danger` (`danger`)          | `#fff3d0`   | #fff3d0   | cream text on danger backgrounds                              |
| `--color-success` (`success`)           | `#6fb36a`   | #6fb36a   | connected pill                                                |
| `--color-success-dark` (`success`)      | `#4f9a5a`   | #4f9a5a   | done queue/receipt accent                                     |
| `--color-success-light` (`success`)     | `#8fd19a`   | #8fd19a   | done verdict background                                       |
| `--color-info` (`info`)                 | `#5b9bd8`   | #5b9bd8   | demo pill                                                     |
| `--color-info-link` (`info`)            | `#2f5f8f`   | #2f5f8f   | links and labels on parchment                                 |
| `--color-info-link-dark` (`info`)       | `#1d3f63`   | #1d3f63   | link hover                                                    |
| `--color-mana` (`mana`)                 | `#4aa3ff`   | #4aa3ff   | mana bar fill                                                 |
| `--color-mana-track` (`mana`)           | `#1f2b4a`   | #1f2b4a   | mana bar track                                                |
| `--color-mana-border` (`mana`)          | `#14213d`   | #14213d   | mana bar border                                               |
| `--color-context` (`accent`)            | `#7a5aa8`   | #7a5aa8   | context-pressure queue accent                                 |
| `--color-avatar-bg` (`accent`)          | `#5a7a58`   | #5a7a58   | avatar tile background                                        |
| `--color-neutral` (`neutral`)           | `#8a8a8a`   | #8a8a8a   | no-receipt accent                                             |
| `--color-neutral-light` (`neutral`)     | `#d3cdbf`   | #d3cdbf   | no-receipt verdict background                                 |
| `--color-act-combat` (`activity`)       | `#e0733a`   | #e0733a   | chip: combat                                                  |
| `--color-act-magic` (`activity`)        | `#a98be0`   | #a98be0   | chip: magic                                                   |
| `--color-act-read` (`activity`)         | `#7cc276`   | #7cc276   | chip: reading                                                 |
| `--color-act-owl` (`activity`)          | `#c9b48a`   | #c9b48a   | chip: owl                                                     |
| `--color-act-portal` (`activity`)       | `#4fc3c9`   | #4fc3c9   | chip: portal                                                  |
| `--color-act-notes` (`activity`)        | `#f2e06a`   | #f2e06a   | chip: notes                                                   |
| `--color-act-tavern` (`activity`)       | `#c98a52`   | #c98a52   | chip: tavern                                                  |
| `--color-act-grey` (`activity`)         | `#b3aa97`   | #b3aa97   | chip: idle/grey                                               |
| `--color-shade-edge` (`shade`)          | `#0003`     | #0003     | chip and verdict borders                                      |
| `--color-shade-faint` (`shade`)         | `#0005`     | #0005     | stage frame drop shadow                                       |
| `--color-shade-soft` (`shade`)          | `#0006`     | #0006     | pressed-edge shadow under cards and buttons                   |
| `--color-shade-inset` (`shade`)         | `#0007`     | #0007     | inset shadow of inputs                                        |
| `--color-shade` (`shade`)               | `#0008`     | #0008     | header/panel edge shadows                                     |
| `--color-shade-hard` (`shade`)          | `#000a`     | #000a     | title text shadow, large frame shadow                         |

## Fonts

| Token          | Stack                                            | Used for        |
| -------------- | ------------------------------------------------ | --------------- |
| `--font-serif` | Georgia, Palatino, Book Antiqua + Thai fallbacks | headings, names |
| `--font-mono`  | ui-monospace, Menlo + Thai fallbacks             | body text       |
| `--font-ui`    | system-ui + Thai fallbacks                       | filter bar      |

## Font sizes

| Token        | Value        |
| ------------ | ------------ |
| `--text-2xs` | 11px         |
| `--text-xs`  | 12px         |
| `--text-sm`  | 13px (body)  |
| `--text-md`  | 14px         |
| `--text-lg`  | 15px         |
| `--text-xl`  | 17px (title) |

## Radii

| Token           | Value |
| --------------- | ----- |
| `--radius-xs`   | 2px   |
| `--radius-sm`   | 3px   |
| `--radius-md`   | 4px   |
| `--radius-lg`   | 6px   |
| `--radius-xl`   | 10px  |
| `--radius-pill` | 99px  |

## Shadows

| Token            | Value                             | Used for                                                   |
| ---------------- | --------------------------------- | ---------------------------------------------------------- |
| `--shadow-raise` | `0 2px 0 var(--color-shade-soft)` | pixel-style pressed edge under buttons, cards, queue items |

Other shadows are composed inline from the `shade-*` and `gold-*` color tokens.
