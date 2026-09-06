# Game Data (`/json`)

Static D&D 5e (2024) reference data, loaded via API routes
([08](08-api-routes.md)) and consumed client-side through hooks
(`src/hooks/use*Data.ts`).

## Layout

| Path | Contents |
|---|---|
| `backgrounds.json`, `feats.json`, `races.json`, `senses.json`, `conditionsdiseases.json`, `books.json` | Single-file reference tables |
| `items.json`, `items-base.json` | Equipment/item data |
| `class/` | One file per class: `class-artificer.json`, `class-barbarian.json`, `class-bard.json`, `class-cleric.json`, `class-druid.json`, `class-fighter.json`, `class-monk.json`, `class-mystic.json`, `class-paladin.json`, `class-ranger.json`, `class-rogue.json`, `class-sorcerer.json`, `class-warlock.json`, `class-wizard.json` |
| `bestiary/` | 108 files — monster stat blocks, split per source |
| `spells/` | One file per sourcebook: `spells-phb.json`, `spells-xphb.json`, `spells-tce.json`, `spells-xge.json`, `spells-egw.json`, `spells-ftd.json`, `spells-scc.json`, `spells-aag.json`, `spells-ai.json`, `spells-aitfr-avt.json`, `spells-bmt.json`, `spells-efa.json`, `spells-frhof.json`, `spells-ggr.json`, `spells-idrotf.json`, `spells-llk.json`, `spells-sato.json`, `spells-tdcsr.json` |

## Pipeline pattern

Raw JSON → `src/utils/*DataLoader.ts` (parses raw JSON) → `src/utils/*Conversion.ts`
(maps raw shape to internal TypeScript types in `src/types/`) → API route in
`src/app/api/` serves/filters it → client hook in `src/hooks/use*Data.ts`
fetches and returns typed results.

When adding a new data source or field, follow this same
loader → conversion → route → hook chain rather than reading raw JSON
directly in a component.

## Note on scope

This is reference/rules data (read-only from the app's perspective). It's
distinct from DM-authored content, which lives in Zustand stores instead:
`magicItemLibraryStore` (custom magic items), `npcStore` (custom NPCs) — see
[02](02-state-management.md).
