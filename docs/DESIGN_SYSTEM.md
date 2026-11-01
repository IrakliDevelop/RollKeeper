# RollKeeper design system: Felt and Brass

The game table at night: green-black baize, bone-coloured text, brass for the
one action that matters, blood red for harm. The light theme is pale
green-grey map paper with ink text. Blue dark is an additional navy palette
with a blue primary action and violet magic marks; the existing light and
dark palettes retain their colours. The semantic `brass` tokens still name
primary actions and on-states in every palette.

This file states the rules. To see them, open Storybook → **Foundations**
(Colour, Type scale, Shape and elevation, Motion, Touch), which renders the
real tokens and components in both themes. Where things live in the code is
in [wiki 09](wiki/09-design-system-ui.md). Agents building or reviewing UI
also load the `rollkeeper-design` skill
(`.claude/skills/rollkeeper-design/SKILL.md`, mirrored in `.agents/skills/`).

The source of truth is `src/app/globals.css` (tokens) and
`src/components/ui/` (components). If this file disagrees with them, the
code wins; fix this file.

## Colour

Neutrals do the structural work. Each chromatic colour has exactly one job,
so a player can say what a colour means. Colour is never the only carrier of
meaning: text, shape or position backs it up.

### Neutrals

| Token | Job |
|---|---|
| `surface` (= `background`) | The page canvas |
| `surface-secondary` | An alternate band, a table header, a subtle well |
| `surface-raised` | A card: a character, monster, spell, item or campaign |
| `surface-elevated` | Floating layers: popovers, menus, dialogs, drawers, toasts |
| `surface-inset` | Inputs and wells |
| `surface-hover` | Row and ghost-button hover |
| `surface-overlay` | The dialog scrim |
| `heading` | Primary text |
| `body` | Secondary text |
| `muted` | Captions, metadata, placeholders |
| `faint` | Decorative and disabled only; never the only place readable information appears |
| `divider` / `divider-strong` | Hairlines / emphasis rules |
| `input-border` | Control boundaries (at least 3:1 against surfaces) |

Use them through Tailwind utilities: `bg-surface-raised`, `text-muted`,
`border-divider`. Never raw Tailwind colours (`bg-gray-800`, `text-white`).

### Roles

Each role has `text-{role}-text`, `bg-{role}-fill`, `border-{role}-border`
and a rare tinted wash `bg-{role}-bg`. Brass and blood also have
`text-on-brass` / `text-on-blood` for text on their fill.

| Role | Means |
|---|---|
| `brass` | The primary action, focus, proficiency, inspiration, an on-state |
| `blood` | Harm, damage, destructive actions, critical HP |
| `verdigris` | Healing, restored, success, healthy HP |
| `lapis` | Magic: spell slots, concentration, spell attacks |
| `ember` | Conditions, warnings, exhaustion, bloodied HP |
| `frost` | Temporary HP |

Rules:

- **One brass action per view.** At most one brass-filled button
  (`variant="primary"`). Small state marks (a proficiency dot, a switch's on
  state, the active tab's underline) are not actions and don't count.
- **Blood fill** only for the confirm button of a destructive dialog
  (`danger-solid`) and for meters at critical. Any other destructive control
  is a blood outline (`danger`).
- **A role colour is game state, not decoration.** A spell book icon is not
  lapis because it's about magic; spell slots are lapis because they are
  magic you spend. When nothing on the screen has the role's meaning, use
  neutrals.
- **HP tiers:** `hpTier(hpPercent(current, max))` in `src/utils/hpState.ts`
  gives `high` from 75%, `mid` from 50%, `low` from 25% and `critical`
  below (each threshold inclusive). `high` is "Healthy" (verdigris bar, the
  number stays `heading`), `mid` and `low` are "Bloodied" (ember), `critical`
  is "Critical" (blood), and 0 HP is "Down". Take the word from
  `HP_STATUS_LABELS[hpStatus(current, max)]` and every colour from
  `src/utils/hpColor.ts`: `getHpBarColor` and `getHpNumberColor` take
  current and max HP; with a tier already in hand, use `getHpTierBarColor`,
  `getHpTierNumberColor` and `getHpTierTextColor`. Show the word wherever
  there's room. Don't invent other thresholds or write HP colours by hand.
  Two exceptions: the words players see for enemies come from the DM's
  editable bands (`hpStateLabel` with the combat config's `hpStateBands`,
  defaults in `DEFAULT_HP_STATE_BANDS`), never `hpStatus`; and until the
  Phase 3 sweeps, the dock `HpCard` keeps its old tint, with its thresholds on the tiers.
- **No gradients**: not on fills, text, page backgrounds or meters. Meters
  use a solid role colour.
- **Retired:** the hue-named `accent-{emerald,blue,amber,red,purple,indigo,green,orange,yellow,violet}-*`
  tokens and the `--gradient-*` variables. They still exist as aliases of the
  nearest role until the screen sweeps remove them. Don't write new uses,
  even in a file that already has some. An existing use can stay when code
  only moves; restyling it is a visible change, listed for the owner.
- Canvas and VTT data colours (marker and token colours stored in data) are
  out of scope.

`npm run design:contrast` checks every role and neutral pairing against WCAG
AA (4.5:1 text, 3:1 marks) in all three palettes.

## Appearance settings

The header's palette control opens appearance settings for the active character,
or app appearance elsewhere. App appearance sets the device default. A character
can select its own theme under Character → Appearance; Use app theme clears the
override. Character choices travel with exported and synced character JSON and
apply across its sheet and settings routes. Leaving those routes restores the
app default. System uses OS light/dark in either scope.

## Character sheet presentation

The character sheet deliberately uses clear rectangular outlines around its
sections and read-only character information. `TabbedCharacterSheet` opts
into `SectionFramesProvider`; each Section resets that context for its
children so nested sections keep a heading rule without a second frame.
Outside the sheet, Section retains its usual unframed layout. Read-only
information stays a semantic description list, without input roles or tab stops.

The Stats tab offers an independent **2024 sheet layout** switch. It arranges
abilities in outlined units with the score/modifier assembly above a saving
throw band and ruled skill rows, inspired by the [official 2024 character
sheet](https://media.dndbeyond.com/compendium-images/free-rules/downloads/2024-character-sheet.pdf). It changes presentation only: character rules, totals, proficiency
and roll/edit handlers stay shared with the classic layout. **Scores large**
continues to control number emphasis in either layout. Both choices persist
per device in `rollkeeper-ui-prefs`, separately from character data.

Prepared spell rows use a narrow primary-role rule and a subtle on-state
wash, backed by visible Prepared or Always prepared text. Favorites,
concentration and free casts keep their own indicators.

## Type

Three families, each with one job, self-hosted in `src/app/fonts/`:

- **Vollkorn**: headings and entity names (a character, monster or spell).
- **Barlow**: everything else, including rules text, labels and controls.
- **Barlow Condensed**: display numbers of 20px and more (HP, AC, initiative,
  speed, proficiency, ability scores and modifiers, CR), with lining tabular
  figures.

Set text with one `type-*` utility, which sets family, size, line height and
weight together:

| Utility | Size / line height | Use |
|---|---|---|
| `type-title` | 28 / 1.2, Vollkorn 700 | Page titles |
| `type-heading` | 22 / 1.25, Vollkorn 700 | Section headings |
| `type-subheading` | 18 / 1.3, Vollkorn 600 | Sub-sections, entity names |
| `type-label-heading` | 16 / 1.35, Vollkorn 600 | Small group headings |
| `type-body` | 15 / 1.55, Barlow 400 | Prose |
| `type-ui` | 14 / 1.4, Barlow 500 | Controls and labels |
| `type-small` | 13 / 1.45, Barlow 400 | Secondary lines |
| `type-caption` | 12 / 1.4, Barlow 400 | Captions under numbers |
| `type-num-xl` | 34 / 1, Barlow Condensed 600 | HP |
| `type-num-lg` | 26 / 1, Barlow Condensed 600 | Vitals, medallions |
| `type-num-md` | 20 / 1, Barlow Condensed 600 | Other display numbers |

Small numbers (a skill bonus, a table cell) stay in Barlow with
`tabular-nums`. Campaign codes and one-time codes use `font-mono`.

Rules:

- Sentence case everywhere. No uppercase or letter-spaced labels.
- AC, HP, CR, DC and XP are plain capitals, never letter-spaced.
- No highlighted word in a heading: no gradient, colour or italic accent.

## Shape, space and elevation

- **Sections, not boxes.** Group content with `Section`: a Vollkorn heading on
  a 1px `divider` rule, no background, border or radius. A `Card` is only for
  a discrete object (a character, monster, spell, item or campaign). Cards
  never nest.
- **Radius:** 0 for sections, 4px for controls (buttons, inputs), 3px for a
  `Badge`, 6px for objects (cards, dialogs, popovers). Full circles only for
  dots, pips, medallions and switches. No pill buttons.
- **Elevation:** nothing in the page flow has a shadow. Floating layers
  (popover, menu, tooltip, dialog, drawer, toast) on `surface-elevated` take
  the one `shadow-overlay`, through `OVERLAY_SURFACE` or `SideDrawer`. No
  `backdrop-blur`.
- **Spacing:** Tailwind's 4px grid. 8px within rows, 16px between blocks,
  24–32px between sections.
- **Icons:** `AppIcon` (the app's registry in `ui/icons/`) or plain lucide,
  only where they help scanning (tab labels, icon-only buttons with an
  `aria-label`). No icon in a tinted tile or circle, no
  `Sparkles`, no decorative icon beside a heading.

## Motion

- Motion answers a user action: opening or closing, expanding, confirming a
  change, taking damage. 120ms for state changes and 180ms for enter and
  exit, ease-out.
- Never: hover lift or scale, scroll-reveal, floating orbs, shimmer, an
  endless `animate-pulse` on anything that isn't loading.
- Reduced motion turns it off: `globals.css` cuts CSS transitions and
  animations to near zero, and the app root's `MotionConfig
  reducedMotion="user"` covers framer-motion.
- The opt-in celebratory overlays (`YouDiedOverlay`, `LevelUpOverlay`,
  `CombatStartBanner`) are exempt and still respect reduced motion.

## Components

Use the primitives in `src/components/ui/`; never build your own button,
input, card, dialog or toggle. Most have stories in both themes.

| Need | Use |
|---|---|
| The view's main action | `Button variant="primary"` (brass fill), once per view |
| Any other action | `Button` with no variant (`secondary`: 1px outline), or `ghost` (text only) for low-weight and icon buttons |
| A destructive action | `Button variant="danger"` (blood outline), then a confirm |
| The confirm in a destructive dialog | `danger-solid` (blood fill). `confirmDialog({ tone: 'danger' })` uses it for you |
| A toggle button's on state | `selected` on an outline or ghost Button. Add `aria-pressed` only when the label stays the same in both states. `success` and `warning` are deprecated aliases of `secondary` |
| A text link | `variant="link"` (brass text) |
| A status label | `Badge`: `primary` brass, `success` verdigris, `warning` ember, `danger` blood, `magic` lapis (concentration), `neutral` (the default). `secondary`, `info` and `outline` render neutral |
| Grouping on a page or tab | `Section` (`heading`, `level` 2–4, `trailing` for a heading-row control) |
| A discrete object | `Card` (`interactive` when the whole card opens it) |
| A question before acting | `confirmDialog`, `alertDialog`, `promptDialog` from `feedback/confirm-dialog`. Never `window.confirm`, `alert` or `prompt` (ESLint blocks them) |
| A form or detail view over the page | `Dialog` (`DialogContent`, `DialogHeader` with a `DialogTitle`, `DialogBody`, `DialogFooter`) |
| A panel from the screen edge | `SideDrawer` |
| Feedback after an action | A toast through the page's `addToast` (passed down; a new `useToast()` also needs its own `ToastContainer`): verdigris rule for success and rests, blood for errors and damage, neutral otherwise |
| Tabs | `BookmarkTabs` (text tabs, 2px brass underline on the active tab, arrow keys move and open) |
| A labelled on/off setting | `Switch` with `label` and `description`. `Checkbox` for a choice in a form |
| A number field | `NumberInput` / `NumberField`. Never `type="number"` or `parseInt(e.target.value) \|\| 0` |
| A number edited where it's shown | `InPlaceField` |
| A number inside an ornament or in a tight spot | `AnchoredEditor` (a popover from 640px, a bottom sheet below) |
| A hint on hover | `Tooltip`, never the only place the information appears |

The older `CustomCheckbox`, `CustomSwitcher` and `FancySelect` still exist;
don't use them in new code.

## Editing model

Values are sorted by when they change:

| Kind | Examples | How it's edited |
|---|---|---|
| **Play values** (change during a session) | Current and temporary HP, spell slots, hit dice, class resources, death saves, inspiration, conditions, currency, rolled initiative | Always-active controls built for the job: pips, steppers, the HP damage and heal control, `InPlaceField` for rolled initiative. Never a text-to-input swap with different chrome |
| **Build values** (change at level-up or setup) | Ability scores, max HP, base AC, speed, proficiencies, names | Plain text in play mode; editable only in edit mode |
| **Structured edits** | Multiclassing, spell lists, stat blocks, armor and weapons | The existing dialogs and drawers |

A value is edited in place (`InPlaceField`) only when it sits in plain text
with room for its usual width. Anything inside an ornament (a medallion, the
AC shield) or too cramped opens an `AnchoredEditor`.

Direct current HP, level and per-class level edits commit on Enter or blur. Escape cancels the draft; inside a dialog, a second Escape closes the dialog. Direct current-HP targets use `setCurrentHitPoints`, preserving temporary HP and applying the damage/healing death-save transitions.

### Play and edit modes

The character sheet is in play mode by default. The mode lives in
`src/components/ui/character/SheetMode.tsx`: the page calls
`useSheetModeState(characterId)`, hands the result to `SheetModeProvider`, and
descendants read it with `useSheetMode()` (it throws outside a provider). The
mode is UI state only. It is never persisted and resets to play on load and
when the character changes.

The "Edit sheet" `Switch` is first in the right cluster of the sticky bar, and
an "Editing sheet" row shows inside the sticky header while editing. The bar
never hides on scroll. Below `sm` the switch label, the save text and the
back-link text are visually hidden but stay as accessible names.

Build-value components take `editing?: boolean` (default `true`) and the page
passes the mode. 02d gates the name, avatar, HUD speed, Combat max HP (and its
calculation mode), base AC, and walk, fly, climb and swim speeds; 02e gates
the Stats tab's abilities (see "Abilities on the Stats tab"). A play value
edited with `InPlaceField` (rolled initiative) passes `editing` as always
true. The map dock's armor class dialog keeps the default, so it stays
editable.

The map sheet drawer and the DM creature drawer use the same "Edit sheet"
`Switch`, each with its own local state.

### Escape and in-place edits

An `InPlaceField` with a draft marks its input `data-in-place-dirty`.
`DialogContent` and `SideDrawer` compose `keepOpenForInPlaceEdit`
(`src/components/ui/forms/InPlaceField/keepOpenForInPlaceEdit.ts`) into
`onEscapeKeyDown`: the first Escape cancels the draft and keeps the dialog or
drawer open, the next Escape closes it. A custom Radix dialog that doesn't use
`DialogContent` or `SideDrawer` must compose the helper itself. See the story
Forms/InPlaceField, InDialog.

## Game patterns

The game's own marks live in `src/components/ui/game/`, each with stories in
both themes (Storybook → Game). Import them by path; don't draw your own.

| Need | Use |
|---|---|
| Proficiency on a skill, tool or save | `ProficiencyDot` (`level`: `none` hollow, `half` for Jack of All Trades, `proficient` brass, `expertise` brass with an outer ring). It names its state for screen readers; pass `decorative` when nearby text already says it |
| A proficiency toggle in edit mode | `ProficiencyDotButton`, labelled with `skillDotLabel` (cycles with `nextSkillProficiency`) or `saveDotLabel` plus `pressed`. Same look, 24px hit area (44px on touch), so keep any other tappable control at least 22px from the dot's centre and the row `pointer-coarse:min-h-11` |
| Spell slots left | `SlotPips` (`total`, `available`, `level` 1–9 or `'pact'`): 10px lapis pips, filled while available. Display only; one label for the row; bad counts clamp and at most `MAX_PIPS` (20) are drawn |
| Armor class | `AcShield`: the number in a brass shield outline, the only icon-shaped container in the system. Add the "AC" caption or label yourself |
| An ability on the Stats tab | `Medallion` (`ability`, `score`, `modifier`, `saveProficient`, `abilityDisplay`): a 48px ring with the large number inside and the small one on a tab over the bottom edge. The ring is brass when the save is proficient, `divider-strong` when not; it is never decorative. One label in both modes ("Strength: modifier +3, score 16"). With `editing` and `onScoreChange` it becomes a button that opens the "Strength score" editor (1–30, live "Modifier +3"); otherwise it is plain, with no tab stop. The tab hangs 10px below the ring, so leave that much room under it. Don't pass outline classes in `className`: in edit mode they clash with, and can hide, the editor's dashed cue and focus ring |
| Abilities in a drawer or the DM's view of a player | `LedgerRow` (`cells`: six `{ ability, score, modifier, save, saveProficient }`, `abilityDisplay`): name, the two numbers and a save line ("Save +5" with a decorative dot) per cell, `divider` hairlines between cells, six across from 32rem of its own width and 3×2 below. Give it a block parent: as a flex item with auto width it shrinks to nothing. `editing` + `onScoreChange` open the same score editor. `onRollCheck` / `onRollSave` turn the name and save line into roll buttons, "Roll Strength check" and "Roll Strength Save +5, proficient" (`saveRollLabel`: named by its content, so the name holds the visible "Save +5"); without them they stay text, and while editing rolls are off. The map sheet drawer and the DM's player dialog use it: the DM's has no rolls, and the drawer's stay off behind `SHEET_DICE_ROLLS_ENABLED` |
| A condition on a creature | `ConditionChip`: an ember `Badge` with the name, or `kind="concentration"` in lapis. `onRemove` adds a remove button; pass `removeLabel` when a list shows several creatures ("Remove Poisoned from Goblin 2"). The name is never cut short. It renders a `div`, so not inside a `<button>` or `<p>`. On touch, give a wrapping list `pointer-coarse:gap-x-3 pointer-coarse:gap-y-6` so remove buttons cover nothing else |
| A character's vitals (the sheet's HUD, row 1) | `CharacterHUD` (`ui/character/`). HP is `HudHitPoints`: the current value in `type-num-xl` coloured by tier, "/ max" in `body`, "+5 temp" in frost, a 4px tier bar on a `divider` track and the tier word under it; with no max HP, a plain number and an empty track. Each drop in current HP flashes the tile blood for 180ms (`useHpDamageFlash`, from state, so a hit from another tab or the DM flashes too). The other stats are `HudStat` tiles: `type-num-lg` over a caption at every width ("Initiative", "Spell save DC"), AC in `AcShield`; a tile with `onClick` is a button named by its text. Concentration is a `ConditionChip`, the conditions count an ember badge-style button with no pulse |

The older `ConditionBadge` stays on the encounter rows and the map's status
tray until their sweep moves them to `ConditionChip`.

### Modifier or score large

Which number an ability shows large is the viewer's choice, per device:
`useUiPrefs()` (`src/hooks/useUiPrefs.ts`) returns `prefs.abilityDisplay`
(`'modifier'`, the default, or `'score'`), `setPref` and `localChange`.

- It lives in its own `localStorage` key, `rollkeeper-ui-prefs`, a JSON
  object merged with the defaults on read. It is not part of
  `PlayerSettings`, not per character and not cloud-synced. Put later UI
  preferences there too.
- Bad stored values fall back to the defaults, keys this version doesn't
  know are kept on write, and a write the browser refuses still applies for
  the visit. Other open tabs follow at once.
- Pass `prefs.abilityDisplay` as `abilityDisplay` and `localChange` as
  `animateSwap` to `Medallion` and `LedgerRow`. Then a change made in this
  tab swaps the two numbers in 180ms (instant under reduced motion), while
  the first render, the stored value replacing the default after hydration
  and a change from another tab snap into place.
- Keep swap consumers on the same visible page as the switch. A consumer
  that is hidden (`display: none`) when the display changes never runs the
  animation or fires animationend, so it plays the swap once when it is
  shown. One in another, hidden `BookmarkTabs` panel should pass
  `animateSwap={localChange && visible}` (or `false`).

The "Scores large" `Switch` (size small, no description) sits at the right
of the Stats tab's "Abilities" heading and of the DM player dialog's
"Abilities" heading, and calls `setPref('abilityDisplay', on ? 'score' :
'modifier')`. The map sheet drawer has no switch; it follows the device's
setting.

### Abilities on the Stats tab

`AbilitiesSection` (`src/components/ui/character/AbilitiesSection/`, import
by path) is the tab's abilities: a `Section` "Abilities" with the "Scores
large" switch, then six blocks in one column, two from `sm` and three from
`lg`. A block is a `Medallion`, the ability name (`h3`) over its save line,
and its skills (dot, name, bonus); Constitution says "No skills". It takes
`editing?: boolean` (default `true`); only the character page passes the
sheet mode.

- **Play mode:** the name rolls the check ("Roll Strength check"; the
  heading stays "Strength"), the save line rolls the save ("Roll Strength
  Save +5, proficient"), the skill name rolls the skill ("Roll Stealth
  check"). Dots are images that say their state. These rolls are live, as
  they always were on this tab.
- **Edit mode:** no rolls. The medallion opens the score editor; the save
  dot toggles the save (`pressed`); the skill dot cycles none → proficient
  → expertise → none (expertise is cleared before proficiency); "+WIS"
  badges show bonus abilities, chosen in a popover ("Choose ability
  modifiers for Stealth"); a "Jack of All Trades" `Switch` with its
  description sits at the foot of the section. Half dots show Jack of All
  Trades in both modes.

## Touch and iPad

Some players use iPads at the table. Everything works by touch alone:

- **Nothing hover-only.** Hover styles are only an extra. A tooltip is never
  the only place information appears; put it in visible text (a `Switch`
  `description`, a caption) instead.
- **Targets:** at least 44×44px on coarse pointers
  (`pointer-coarse:min-h-11`, plus `pointer-coarse:min-w-11` for icon
  buttons), 24×24px otherwise. Small visuals (8px dots, 10px pips, a switch)
  keep their size and get a larger hit area. A row with a tappable control is
  at least 44px tall on coarse pointers.
- **No double-click, right-click or long-press-only actions.** Every action
  has a visible tap path.
- **Every keyboard shortcut has a touch equivalent:** arrow-key stepping has
  steppers, Escape has Cancel, Enter has Save.
- **Inputs are at least 16px on coarse pointers**, or iOS Safari zooms in on
  focus. `globals.css` handles `text-xs`, `text-sm` and the small `type-*`
  steps; don't put arbitrary sizes such as `text-[13px]` on a field.
- Check layouts at iPad portrait (820×1180) and landscape (1180×820).

Storybook → Foundations → Touch shows the measured sizes.

## Copy

Every user-visible string, including the example strings in this file,
follows the `rollkeeper-copy` skill (`.claude/skills/rollkeeper-copy/SKILL.md`):
sentence case, verb-first buttons that name the outcome ("Take a long rest",
then the toast "Long rest taken"), empty states that invite the action
("Create your first character" with a "Create character" button), and
destructive confirms that name the thing and the consequence ("Delete Thalia
Vane? The sheet is removed from this device." with "Delete character").

## Guardrails

- `npm run design:ci` (CI) counts retired patterns per file and fails if any
  file's count rises: gradients and gradient stops, hover scale or translate,
  `shadow-lg`/`xl`/`2xl`, `backdrop-blur`, hue-named `accent-*` tokens, raw
  Tailwind hue classes, `uppercase`, `Sparkles` imports, `type="number"`, and
  `shadow-overlay` outside `variants.ts` and `SideDrawer.tsx`. After removing
  patterns, `npm run design:baseline` locks in the lower counts.
- `npm run design:contrast` (CI) fails if a role or neutral pairing drops
  below WCAG AA in either theme.
- `npm run copy:changed` lists the strings a branch adds for the copy review.


## Shared app header and sub-tabs

`AppHeader` (`ui/layout/AppHeader`) supplies the brass keyhole home link and
Vollkorn wordmark (`sm+`), then a `leading` crumb, `title`, optional `nav`
(`md+`), `actions`, built-in `HeaderTrailing` and optional `subbar`. `sticky`
keeps it at the top. It publishes its complete observed height as
`--app-header-height`; sheet jump targets use that value. The sheet is its
first adopter. Its identity card remains for 03b.

Account and theme triggers are ghost icon buttons; Sign in is secondary.
The theme cycle defaults to light → system → dark → light on every page.
The campaign chip shows just its dot and link icon below `sm`, with its
campaign and time still available to screen readers.

`SubTabs` (`ui/layout/SubTabs`) uses Radix text tabs and a 2px brass active
underline. Callers supply stable ids and values, contents, and a list label;
selection may be controlled or uncontrolled and is never persisted here.
It is unwired until 03b.

`Section` accepts `collapsible="stable-key"` to make its heading a disclosure.
The right chevron and `aria-expanded` show state; trailing controls stay
outside the disclosure. The per-device boolean map `collapsed` lives in
`rollkeeper-ui-prefs`, merged with defaults and validated on read. It has no
production adopter in 03a.

### Sheet frame (Phase 3, part 03b)

The identity head is an unboxed section with a single identity line. Its name
uses `InPlaceTextField`: a local text draft commits on Enter or blur and
Escape cancels. In play mode it is plain text. Avatar actions live in the
avatar popover, and the Character menu holds export, QR sharing, import and
reset. HUD speeds use four local `NumberInput` drafts in the shared editor
shells; Save commits changed speeds together, and dismissal discards them.
Inventory, Character, Combat and Features use `SubTabs`; their caller-owned
values stay unchanged. Sheet section errors use `SheetLoadError` with a
player-facing noun and a Reload page action.
