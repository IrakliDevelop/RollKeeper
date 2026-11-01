# Design System & UI

Full component-usage rules (which import to use, variant names, naming
conventions) are in `AGENTS.md` (which `CLAUDE.md` imports) — **read that,
don't duplicate it here.** The design rules (colour roles, type scale, shape,
motion, touch, the editing model) are in
[`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md), Storybook → Foundations
renders the tokens, and agents load the `rollkeeper-design` skill
(`.claude/skills/rollkeeper-design/SKILL.md`, mirrored in `.agents/skills/`)
before building or reviewing UI. This file covers the actual directory layout
and where things deviate from the documented pattern.

## `src/components/ui/` subdirectories

| Dir | Contents |
|---|---|
| `forms/` | `Button`, `Input`, `Textarea`, `Checkbox`, `SelectField`, `Switch`, `RadioGroupField`, `Autocomplete` + domain variants (`ArmorAutocomplete`, `SpellAutocomplete`, `WeaponAutocomplete`, `MagicItemAutocomplete`, `FeatureAutocomplete`, `ItemAutocomplete`), `NumberInput`, `InPlaceField` and `AnchoredEditor` (see [Editing numbers](#editing-numbers)), `RichTextEditor` / `CompactRichTextEditor`. Also `CustomCheckbox`, `CustomSwitcher`, `FancySelect` — older, pre-design-system components; **prefer the documented primitives** (`Checkbox`, `SelectField`, `Switch`) for new code rather than the `Custom*`/`Fancy*` ones. |
| `layout/` | `card`, `section` (heading + rule + content, for layout; `Card` is for discrete objects), `badge`, `BookmarkTabs` (the tab-persistence mechanism behind `TabbedCharacterSheet`), `DragDropList` / `DragHandle`, `VirtualizedList`, `ExperimentalFeaturesSection` / `FeaturesNavigationSection` (user-facing experimental-feature toggles) |
| `feedback/` | `dialog` (Radix-based), `confirm-dialog` (`confirmDialog`/`alertDialog`/`promptDialog` + one `ConfirmDialogHost` in the root layout; `ConfirmationModal` wraps the same view), `ConfirmationModal`, `Toast`, `SideDrawer`, `ErrorBoundary` / `ErrorPage`, `ImageLightbox`, `LevelUpOverlay`, `YouDiedOverlay`, `NotHydrated`, `SaveIndicator`, `StorageBlockedBanner` (shown when the browser blocks storage). Also several storage-migration/recovery components that live here despite not being generic feedback primitives: `CharacterRecoveryExportControls`, `CharacterStorageMigrationControls`, `CombatStartBanner`, `DataSafetyBanner`, `DeviceRecoveryControls` — see [03](03-persistence-and-storage-migration.md). |
| `primitives/` | `variants.ts` (the CVA class recipes, plus `OVERLAY_SURFACE` for floating layers), `animations.ts`, `Tooltip.tsx`, and the Foundations/Type scale story. The tokens themselves are CSS variables in `src/app/globals.css`; Storybook's Foundations pages render them |
| `foundations/` | Storybook Foundations pages (Colour, Shape and elevation, Motion, Touch) and their helpers: `themeTokens.ts` reads the tokens out of `globals.css`, `useComputedValue.ts` measures rendered values, `remountOnTheme.tsx` re-measures when the toolbar theme changes |
| `game/` | Core D&D mechanics widgets: dice roller, conditions manager, currency, equipment, inventory (with `conditions/`, `equipment/`, `inventory/` subfolders), and the Felt and Brass game marks (`ProficiencyDot`, `SlotPips`, `AcShield`, `ConditionChip`, `Medallion`, `LedgerRow`; see `docs/DESIGN_SYSTEM.md` → Game patterns) |
| `character/` | Character-sheet-specific composite components: ability scores, HUD, HP/hit-dice managers, class resources, level-up wizard, player-backup UI ([06](06-player-backup-wizard.md)), automatic-sync controls |
| `campaign/` | DM/session-oriented: membership controls, cloud workspace controls, initiative panel, NPC editors, battle-map/VTT (`dm-vtt/`, `player-vtt/`, `location-map/`, `battle-map/`, `token-overlay/`), the NPC shop (`NPCShopTab/`) and the player's view of it (`player-shop/`), sync-status controls per domain (`*SyncControls`) |
| `encounter/` | The DM encounter tracker: `EncounterList`, `EncounterView`, the `combat-screen/` layouts, `CombatConfigDialog`, `custom-conditions/`, `MonsterStatBlockPanel` |
| `calendar/` | Campaign calendar UI |
| `icons/` | Icon components |
| `utils/` | UI-layer utility functions |
| `ThemeToggle.tsx` | Appearance settings link; targets the active character or app settings |
| `index.ts` | Barrel that re-exports `character`, `feedback`, `forms`, `game`, `layout` and `utils` |

There is no separate top-level `stats/`, `conditions/`, `combat/`, or
`spells/` directory — those live inside `game/` and `character/` as
subfolders/files, not as their own `ui/` category. If you see a reference to
one elsewhere, check the actual current tree rather than assuming it's a
sibling of `forms/`/`layout/`/etc.

## Dark mode

Dark palettes use `data-theme="dark"` or `data-theme="blue"` on `<html>`, set pre-hydration from `localStorage`
key `rollkeeper-theme`, selected at `/player/appearance` via `useTheme`. **Always use semantic tokens**
(`bg-surface`, `text-heading`, `border-divider`, and the role
tokens `text-brass-text`, `bg-blood-fill`, …) — never raw Tailwind color classes. Full token list is in `AGENTS.md` (which `CLAUDE.md` imports).

Colour comes from six roles, each with one job: brass (primary action, focus,
proficiency), blood (harm, destructive), verdigris (healing, success), lapis
(magic), ember (conditions, warnings) and frost (temporary HP). The old
hue-named `accent-*` tokens and `--gradient-*` variables are deprecated
aliases that point at the nearest role until the Phase 3 sweeps remove them.
`npm run design:contrast` checks every role and neutral pairing against WCAG
AA in all three palettes. The blue palette maps the primary/on-state
`brass` role to blue and the magic `lapis` role to violet. Light, dark and
blue are explicit persisted choices; system resolves to light or dark.

Production builds disable Turbopack's persistent build compiler cache; the
separate development cache remains enabled. `npm run build` also runs
`scripts/verify-theme-css.mjs` after compilation. It follows the stylesheet
links in the emitted app appearance HTML and checks representative light,
dark and blue palette values. Correct orphaned CSS cannot satisfy the check.
A failure stops the build: discard that build output, rebuild without restoring
`.next/cache`, and rerun the verifier before deploying. Update the verifier's
expected values when intentionally changing those palette tokens.

This guards an observed deployment that offered Blue dark while its referenced
stylesheet lacked the blue palette. A local warm rebuild regenerated the
correct stylesheet, so persistent build cache reuse remains a suspected cause,
not a reproduced one. A long-running local development server also served an
older stylesheet until restarted; when the selected theme and colors disagree,
inspect the emitted CSS and restart the development server before changing
stored preferences.

## App and character appearance

`/player/appearance` selects the app default. A character can override it at
`/player/characters/[characterId]/appearance` or Character → Appearance on the
sheet. `CharacterState.themePreference` is optional: missing means Use app
theme; light, dark, blue and system are explicit choices. The normal character
update, autosave, export/import and sync paths carry this JSON field. Unknown
values safely follow the app without writing a migration.

The character route layout owns `CharacterThemeScope`. It accepts an override
only when the hydrated live character matches the route id. Owner tokens prevent
a departing route's cleanup from clearing a newer scope. Leaving character
routes restores the latest app preference; choosing a character theme never
writes `rollkeeper-theme`. `theme` in `useTheme` remains the app choice, while
`resolvedTheme` describes the displayed palette. Explicit system on a character
follows OS light/dark independently of the app default.

## Character sheet presentation preferences

`TabbedCharacterSheet` opts into `SectionFramesProvider` from `layout/section`.
Only outer sections receive neutral rectangular frames; each Section resets
the context for descendants. This intentional sheet exception does not change
the unframed Section default elsewhere. `CharacterBasicInfo` gives its
read-only `dd` values clear borders while retaining description-list semantics.

`AbilitiesSection` reads `abilityLayout: 'classic' | '2014' | '2024'` from `useUiPrefs`
(default classic), independently of `abilityDisplay`. The Layout selector labels
these Compact, 2014 sheet and 2024 sheet. The 2014 presentation separates ability scores, saving throws and one alphabetical skill
list; it reuses the same medallions, proficiency controls and computed bonuses.
The 2024 presentation reuses `AbilityBlock`, `Medallion`, `SkillRow`,
proficiency controls and all existing character calculations and handlers. It does not select a rules edition.

## Type scale

Text sizes come from composite `type-*` utilities in `globals.css`: `type-title`,
`type-heading`, `type-subheading`, `type-label-heading` (Vollkorn),
`type-body`, `type-ui`, `type-small`, `type-caption` (Barlow) and
`type-num-xl`/`-lg`/`-md` (Barlow Condensed, lining tabular figures). Each one
sets family, size, line height and weight; the sizes are `--type-*-size`
variables. They are not under `--text-*`, which would clash with the
`text-heading` colour. `cn()` knows the group: a later `type-*` replaces an
earlier one (and any earlier size, line height, weight or family), while a later `text-lg`
or `font-semibold` only overrides that property.

## Touch rules for fields

On a coarse pointer (`@media (pointer: coarse)`), text fields must render at
16px or more, or iOS Safari zooms in on focus. `globals.css` does this without
touching large numbers: inside text-like `input`, `textarea` and `select`
elements it redefines `--text-xs`, `--text-sm` and the small `--type-*-size`
variables as `1rem`, and a base rule sets `font-size: max(16px, 1em)` on fields
without a size utility. A field with `text-2xl` keeps 24px. Arbitrary sizes such
as `text-[13px]` are not covered, so don't put them on inputs. `Input` and the
`Select` trigger also reach 44px tall; `Checkbox`, `Switch` and `RadioGroupItem`
keep their size and grow a 44px hit area instead. `Textarea` keeps its 80px
minimum height on coarse pointers; it does not drop to 44px. With a label,
their row is at least 44px and holds the hit area (a one-line row centres the
control, a described row pads its top), so stacked rows' hit areas don't
overlap. A bare `Checkbox`, `Switch` or `RadioGroupItem` (no `label` prop)
stacked in a list needs its row to be at least 44px on coarse pointers at the
call site (`pointer-coarse:min-h-11`), or neighbouring hit areas overlap.

Storybook can't switch to a coarse pointer or to reduced motion, so stories
call `emulateCoarsePointer()` or `emulateReducedMotion()`
(`src/test/storybook/emulateCoarsePointer.ts`) to copy those media rules in and
read computed styles.

## Floating layers

Only things that float over the page get a shadow: menus, popovers, tooltips,
dialogs, drawers and toasts. They share `OVERLAY_SURFACE` from
`src/components/ui/primitives/variants.ts`: `surface-elevated`, a 1px `divider`
border, the 6px object radius and `shadow-overlay` (the one overlay shadow,
defined per theme as `--overlay-shadow` in `globals.css`). `SideDrawer` is
attached to the screen edge, so it takes the same surface, border and shadow
without the radius. Dialogs dim the page with a plain `surface-overlay` scrim,
no blur, and open and close over 180ms. Raised blocks inside an elevated layer
look sunken until the screen sweeps flatten them; don't add new ones.

When a `DialogContent` closes, focus goes back to whatever had it when the
dialog opened, so controlled dialogs opened from a plain button (no
`DialogTrigger`) don't drop focus on the page. A caller's `onCloseAutoFocus`
that calls `preventDefault()` takes over.

A `SelectItem` shows the keyboard highlight as `surface-hover` plus a 2px brass
outline inside the row, because `surface-hover` alone barely shows on felt's
elevated surface. Toasts add a 3px left rule in their role colour (verdigris for
success and rests, blood for errors and damage, a neutral rule otherwise), a
countdown bar that reduced motion hides, and a `role="status"` region that stays
mounted so each new toast is announced. The region holds a text-only copy
(title, message, details) for one second, so screen readers don't read the
dismiss button and browsing the page doesn't meet the toast twice; the
visible toast sits outside it.

`BookmarkTabs` (the character sheet) and the VTT drawer tab bars are text tabs
on a 1px divider rule; the active tab has heading text and a 2px brass
underline. In `BookmarkTabs`, the arrow keys, Home and End move to a tab and
open it. Its strip hides the scrollbar (`scrollbar-hide`, a `globals.css`
utility) because the chevrons are its scroll cue. Toolbars that scroll
sideways without chevrons keep a thin native scrollbar (`scrollbar-thin`).
Tabs in all three strips are at least 44px tall on coarse pointers.

## Editing numbers

Number fields don't show spin buttons: a global rule in `globals.css` hides
them on the remaining native `type="number"` inputs (arrow keys still step).
New number fields use `NumberInput`/`NumberField`, or one of the two editing
primitives below. Both keep a draft through `useNumberField({ live: false })`
(`commit()`, `cancel()`, `step()`, `validity`), clamp to `min`/`max` when the
value is saved, and announce out-of-range drafts with the same messages
(`src/utils/numberFieldMessage.ts`).

- `InPlaceField` (`forms/InPlaceField`) edits a number where it is shown, in
  the surrounding text's font. The cue is an underline inside the box (1.5px
  `input-border` at rest, 2px brass on focus, 2px blood while the draft is
  empty or out of range); it is two digits wide at least and grows with the
  value. Enter saves, blur saves what was typed or stepped (tabbing through
  changes nothing), Escape puts the old value back, ↑/↓ step by 1 and
  Shift+↑/↓ by 10. With `editing={false}` it is plain text with no tab stop.
  On touch it is at least 16px in edit mode. A wrapping `<label>` gives it a
  tap target of at least 24px (44px on touch) without changing its box. That
  target reaches past the digits and sits above plain neighbours, so keep
  other tap targets (buttons, another field's digits) about 12px clear of it
  on touch layouts.
- `AnchoredEditor` (`forms/AnchoredEditor`) edits a number inside an
  ornament (a medallion, the AC shield) or in too little room. It wraps the
  ornament as its trigger and, in edit mode, gives it a dashed outline
  (`EDITABLE_ORNAMENT`). From 640px it opens a popover next to the trigger,
  below that, a bottom sheet that clears the home indicator and rises above
  the on-screen keyboard. It holds the field, −/+ steppers (44px on touch), an
  optional `context` (a node, or a function of the number being typed) and
  Save/Cancel. Enter saves; Escape, Cancel or a tap outside drops the draft;
  focus goes back to the trigger. The popover is modal, so Tab stays inside
  and a tap outside doesn't also press what is under it. It works inside a
  dialog: Radix Dialog and Popover are pinned to the same exact version (a
  test checks this), or a nested popover closes itself.

Neither is used by a screen yet; they arrive with the sheet's play and edit
modes.

## Design ratchet

`npm run design:ci` (run in CI) counts retired visual patterns per file:
gradients, hover scale, large shadows, backdrop blur, hue-named accents, raw
Tailwind hues, uppercase labels, `Sparkles`, `type="number"`, and
`shadow-overlay` outside the floating-layer primitives. A file's count
may only go down. After removing patterns, run `npm run design:baseline` to lock
in the lower counts.

These patterns are being retired by the Felt and Brass redesign: decoration
should encode meaning, colour comes from role tokens rather than hue names, and
numbers use the in-place number field instead of native number inputs. The exact
pattern list and regexes live in `PATTERNS` in `scripts/design-ratchet.mjs`.
`variants.ts` (`OVERLAY_SURFACE`) and `SideDrawer.tsx` are allow-listed for
`shadow-overlay`.
