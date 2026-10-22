# RollKeeper design system: Felt and Brass

The game table at night: green-black baize, bone-coloured text, brass for the
one action that matters, blood red for harm. The light theme is pale
green-grey map paper with ink text.

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
- **HP tiers:** take the tier from `hpTier(hpPercent(current, max))` in
  `src/utils/hpState.ts` and map it to a role: `high` is "Healthy"
  (verdigris bar, the number stays `heading`), `mid` and `low` are
  "Bloodied" (ember), `critical` is "Critical" (blood; "Down" at 0 HP). Show
  the tier word wherever there's room. Don't invent other thresholds.
- **No gradients**: not on fills, text, page backgrounds or meters. Meters
  use a solid role colour.
- **Retired:** the hue-named `accent-{emerald,blue,amber,red,purple,indigo,green,orange,yellow,violet}-*`
  tokens and the `--gradient-*` variables. They still exist as aliases of the
  nearest role until the screen sweeps remove them. Don't write new uses,
  even in a file that already has some. An existing use can stay when code
  only moves; restyling it is a visible change, listed for the owner.
- Canvas and VTT data colours (marker and token colours stored in data) are
  out of scope. `hpColor.ts` keeps its raw fills for its existing callers;
  new UI doesn't call `getHp*Color`, it maps `hpTier()` to the roles.

`npm run design:contrast` checks every role and neutral pairing against WCAG
AA (4.5:1 text, 3:1 marks) in both themes.

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
| A status label | `Badge`: `primary` brass, `success` verdigris, `warning` ember, `danger` blood, `neutral` (the default). `secondary`, `info` and `outline` render neutral |
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

Play and edit modes arrive in Phase 2: the character sheet's Edit/View button
becomes an "Edit sheet" switch, play mode is the default, and the creature
drawer's `editing` flag follows the same rules. Until then, new build-value
controls take an `editing` prop (as `InPlaceField` and `AnchoredEditor` do)
instead of being always live. A play value edited with `InPlaceField`
(rolled initiative) passes `editing` as always true.

## Coming in Phase 2

The game patterns land as components in `src/components/ui/game/`. Until
they exist, don't build your own versions:

- **Vitals strip** (`CharacterHUD`): HP in `type-num-xl` coloured by tier,
  temporary HP as "+5 temp" in frost, a 4px tier bar; AC inside a brass shield
  outline, the only icon-shaped container in the system.
- **Medallion:** an ability's large number in a ring; a brass ring means a
  proficient save.
- **Proficiency dots:** 8px; hollow, half brass (Jack of All Trades), brass,
  brass with an outer ring (expertise).
- **Spell slot pips:** 10px lapis circles, filled when available, hollow when
  spent.
- **Condition chips:** an ember `Badge` with the condition's name;
  concentration is lapis.
- **Large-number switch:** a "Scores large" `Switch` that swaps modifier and
  score in every ring.

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
