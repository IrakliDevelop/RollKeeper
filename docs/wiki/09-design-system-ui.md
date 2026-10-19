# Design System & UI

Full component-usage rules (which import to use, variant names, naming
conventions) are already documented in `/CLAUDE.md` — **read that, don't
duplicate it here.** This file covers what CLAUDE.md doesn't: the actual
directory layout and where things deviate from the documented pattern.

## `src/components/ui/` subdirectories

| Dir | Contents |
|---|---|
| `forms/` | `Button`, `Input`, `Textarea`, `Checkbox`, `SelectField`, `Switch`, `RadioGroupField`, `Autocomplete` + domain variants (`ArmorAutocomplete`, `SpellAutocomplete`, `WeaponAutocomplete`, `MagicItemAutocomplete`, `FeatureAutocomplete`, `ItemAutocomplete`), `NumberInput`, `RichTextEditor` / `CompactRichTextEditor`. Also `CustomCheckbox`, `CustomDropdown`, `CustomSwitcher`, `FancySelect` — older, pre-design-system components; **prefer the documented primitives** (`Checkbox`, `SelectField`, `Switch`) for new code rather than the `Custom*`/`Fancy*` ones. |
| `layout/` | `card`, `badge`, `Tabs`, `BookmarkTabs` (the tab-persistence mechanism behind `TabbedCharacterSheet`), `DragDropList` / `DragHandle`, `VirtualizedList`, `ExperimentalFeaturesSection` / `FeaturesNavigationSection` (user-facing experimental-feature toggles) |
| `feedback/` | `dialog` (Radix-based, `dialog-new` internally), `confirm-dialog` (`confirmDialog`/`alertDialog`/`promptDialog` + one `ConfirmDialogHost` in the root layout; `ConfirmationModal` wraps the same view), `ConfirmationModal`, `Toast`, `ErrorBoundary` / `ErrorPage`, `ImageLightbox`, `LevelUpOverlay`, `YouDiedOverlay`, `NotHydrated`, `SaveIndicator`. Also several storage-migration/recovery components that live here despite not being generic feedback primitives: `CharacterRecoveryExportControls`, `CharacterStorageMigrationControls`, `CombatStartBanner`, `DataSafetyBanner`, `DeviceRecoveryControls` — see [03](03-persistence-and-storage-migration.md). |
| `primitives/` | `design-tokens.ts`, `animations.ts`, `variants.ts`, `Tooltip.tsx` — the actual token source `CLAUDE.md` refers to |
| `game/` | Core D&D mechanics widgets: dice roller, conditions manager, currency, equipment, inventory (with `conditions/`, `equipment/`, `inventory/` subfolders) |
| `character/` | Character-sheet-specific composite components: ability scores, HUD, HP/hit-dice managers, class resources, level-up wizard, player-backup UI ([06](06-player-backup-wizard.md)), automatic-sync controls |
| `campaign/` | DM/session-oriented: membership controls, cloud workspace controls, initiative panel, NPC editors, battle-map/VTT (`dm-vtt/`, `player-vtt/`, `location-map/`, `battle-map/`, `token-overlay/`), sync-status controls per domain (`*SyncControls`) |
| `calendar/` | Campaign calendar UI |
| `icons/` | Icon components |
| `utils/` | UI-layer utility functions |

There is no separate top-level `stats/`, `conditions/`, `combat/`, or
`spells/` directory — those live inside `game/` and `character/` as
subfolders/files, not as their own `ui/` category. If you see a reference to
one elsewhere, check the actual current tree rather than assuming it's a
sibling of `forms/`/`layout/`/etc.

## Dark mode

Theme is `data-theme="dark"` on `<html>`, set pre-hydration from `localStorage`
key `rollkeeper-theme`, toggled via `useTheme`. **Always use semantic tokens**
(`bg-surface`, `text-heading`, `border-divider`, and the role
tokens `text-brass-text`, `bg-blood-fill`, …) — never raw Tailwind color classes. Full token list is in `AGENTS.md` (which `CLAUDE.md` imports).

Colour comes from six roles, each with one job: brass (primary action, focus,
proficiency), blood (harm, destructive), verdigris (healing, success), lapis
(magic), ember (conditions, warnings) and frost (temporary HP). The old
hue-named `accent-*` tokens and `--gradient-*` variables are deprecated
aliases that point at the nearest role until the Phase 3 sweeps remove them.
`npm run design:contrast` checks every role and neutral pairing against WCAG
AA in both themes.

## Design ratchet

`npm run design:ci` (run in CI) counts retired visual patterns per file:
gradients, hover scale, large shadows, backdrop blur, hue-named accents, raw
Tailwind hues, uppercase labels, `Sparkles`, and `type="number"`. A file's count
may only go down. After removing patterns, run `npm run design:baseline` to lock
in the lower counts.

These patterns are being retired by the Felt and Brass redesign: decoration
should encode meaning, colour comes from role tokens rather than hue names, and
numbers use the in-place number field instead of native number inputs. The exact
pattern list and regexes live in `PATTERNS` in `scripts/design-ratchet.mjs`.
`src/utils/hpColor.ts` is allow-listed for raw hue classes (its raw fills are
intentional).
