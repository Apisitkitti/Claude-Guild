---
name: guild-i18n
description: Add or change UI text in Claude Guild in both Thai and English (Paraglide messages). Use for "แปล", "ข้อความไทย", "เพิ่มข้อความ", "ภาษาไทย", "ทับศัพท์", "translation", "i18n", "paraglide", "messages/th.json", or when a component needs a new label, title, tooltip or status text.
---

# Claude Guild i18n (Paraglide 2.29.3, th + en)

## Where things live
- `project.inlang/settings.json`: `baseLocale: "th"`, `locales: ["th","en"]`, plugin-message-format, `pathPattern: ./messages/{locale}.json`.
- `messages/th.json` (base) and `messages/en.json`: flat `key: "text"` maps; first key is `$schema` (leave it untouched). A few en keys that need English plurals (`queue_loop`, `card_claims_title`, `card_interns`, `receipt_calls`, `receipt_calls_none`, `receipt_squires`) are Paraglide variant arrays (`declarations` / `selectors` / `match` with `countPlural=one` and `countPlural=*`); copy that shape, and keep the same `{params}` in every variant. Thai stays a plain string.
- `paraglide/` is compiled output (`npm run paraglide`). Never edit it by hand.
- Components import messages as `import { m } from "@/paraglide/messages";` and call `m.some_key()` or `m.some_key({ count })`.
- Wording of structured server rows is done client-side in `lib/office/attentionText.ts` (`attentionText`, `attentionDetail`, `attentionCopy`). The server sends data only, so add new row wording as `queue_*` messages and switch on `row.kind` there.

## Steps to add or change text
1. Pick a snake_case key with the existing prefix of its area: `header_*`, `queue_*`, `receipt_*` (`receipt_label_*` for labels), `status_*`, `dungeon_*`, `act_*`, `card_*`, `roster_*`, `intern_*`, `terr_*`, `age_*`, `log_*`, `class_*`, `stats_*`, `mana_*`, `notify_*`, `banner_*`, `stage_*`, `source_*`, `demo_*`, `cheers_*`. Reuse a prefix instead of inventing one.
2. Add the key to BOTH `messages/th.json` and `messages/en.json` with the same `{placeholders}` (e.g. `"queue_loop": "วน loop: {what} ล้มซ้ำ {count} ครั้ง"`). Thai is the base, so write Thai first.
3. Run `npm run paraglide` so `@/paraglide/messages` exposes the key. `npm run dev` (`scripts/dev.mjs`) runs `paraglide:watch` and recompiles on save, but a dev server that was started another way may not watch. Run it yourself before `npm run typecheck`. `prebuild`, `pretypecheck` and `prelint` already run it.
4. Use it in the component: `{m.header_pause()}`. Never hard-code visible strings or concatenate sentence fragments. Use a placeholder instead.
5. Run `npm test`. `tests/messages.test.ts` enforces: th and en have exactly the same keys, the same `{param}` set per key, and no empty messages. It also expects locales to stay exactly `["th","en"]`.
6. Run `npm run typecheck` and `npm run lint` when components changed.

## Locale behavior (do not break)
- `lib/detectLocale.ts`: `pickLocale(stored, languages)` returns the cookie locale if valid, else Thai when the browser's first language is `th` or `th-*`, else English. `detectLocale()` is read-only; only the header language toggle may write the cookie (Paraglide's own resolver would freeze the browser language into it).
- `lib/i18n.ts`: `/` is prerendered in the base locale (Thai). Until `activateLocale()` runs, every `m.*()` call answers Thai through `overwriteGetLocale`, so hydration matches. After hydration it switches to the detected locale and sets `<html lang>`.
- `components/guild/hooks/useLocale.ts`: `useLocale()` (called once at the app top) triggers `activateLocale()` in an effect and re-renders subscribers. Call `m.*()` inside components under it, not in module-level constants (they would freeze the Thai text).

## Thai wording rules
Words Thai speakers normally write as transliteration (ทับศัพท์) stay in English inside Thai sentences: guild, quest, session, file, boss, monster, queue, loop, beer, card, portal, dungeon, review, run, squire, code, reload, mode, commit, test, context, error, permission, etc. Do not force a Thai translation of them.

| Key (th.json) | Thai text | Note |
|---|---|---|
| `queue_heading` | 🔔 Queue ของคุณ | queue stays English |
| `queue_loop` | วน loop: {what} ล้มซ้ำ {count} ครั้ง | loop stays, placeholders match en |
| `queue_done` | เสร็จแล้ว รอ review | review stays |
| `status_boss` | สู้ boss 👹 | boss stays |
| `status_agent` | เรียก squire ช่วยรบ 🛡️ | squire stays |
| `status_bash` | ฟัน monster ⚔️ | monster stays |
| `status_at_tavern_rest` | นั่งดื่ม beer ที่โรงเตี๊ยม 🍺 | beer stays |
| `status_typing` | ร่ายเวท (แก้ code) ✨ | code stays |
| `header_mode_label` | Mode | mode stays |
| `header_treasury` | คลัง Guild | guild stays |
| `card_claims_title` | ถือครอง {count} file | file stays |
| `dungeon_boss_alive` | ตอนนี้มี boss {count} ตัวบนสนาม 👹 | |
| `header_mode_live` / `header_pill_demo` | Live / Demo | never translated |

- "Live" and "Demo" are never translated (`header_mode_live`, `header_mode_demo`, `header_pill_demo`), in any message that mentions them (e.g. `dungeon_since`: "สลับ Live/Demo").
- Keep lowercase where it must be lowercase. `receipt_label_files` / `receipt_label_commits` / `receipt_label_amends` are `file` / `commit` / `amend` in th, and lowercase words in en (`files`, `commits`, `amends`). A past bulk capitalization pass broke them. Never auto-capitalize messages, and leave the `$schema` URL untouched.
- Readability: any new text must have enough contrast and a legible size on its background (pixel-art stage, tooltips, banners). Do not shrink or dim text to make it fit. Shorten the wording instead.
- Privacy: never put the user's real names, emails or project names into messages or demo data. Use generic names (fictional adventurers, "my-project" style placeholders).
- English (`en.json`) is natural English, not transliteration. Keep the same emoji and placeholders as Thai.

## Checklist before finishing
- Both JSON files edited, same key and `{params}`, no trailing-comma errors.
- `npm run paraglide` then `npm test` pass.
- No hard-coded user-visible strings left in the component.
- Part of a bigger change? Follow the `guild-feature` skill for the full gate (lint, typecheck, test) and the live check.
