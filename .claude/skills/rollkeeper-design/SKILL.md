---
name: rollkeeper-design
description: Use when building, restyling or reviewing any RollKeeper UI (components, panels, rows, empty states, settings, dialogs, edit controls, icons, colours, layout), or a diff that touches className, Tailwind classes or src/components. Symptoms it catches - generic AI-styled UI such as gradients, glass blur, cards in cards, icons in tinted tiles, a hue per section, tracked uppercase labels, hover lift, a second primary button, decorative colour.
---

# RollKeeper design (Felt and Brass)

RollKeeper is the game table at night: neutral felt or paper does the work,
brass marks the one action that matters, blood marks harm. Anything that
looks like a SaaS template kit (gradients, glass, coloured tiles, cards
everywhere) is wrong here, even when it is tidy and uses the right tokens.

Rules and the full component table: `docs/DESIGN_SYSTEM.md`. Visual
reference: Storybook → Foundations. Where things live: `docs/wiki/09-design-system-ui.md`.
Every string you write also goes through the `rollkeeper-copy` skill.

## The colour question

Before giving anything a role colour, finish this sentence: "this is
{role} because it shows ___". The blank must be game state or the action the
colour names. If it's a topic ("it's about spells", "it's a warning-ish
area") or decoration, use neutrals.

| Colour | Only for |
|---|---|
| brass | The view's one primary action, focus, proficiency, inspiration, an on state |
| blood | Harm, damage, a destructive action, critical HP |
| verdigris | Healing, restored, success, healthy HP |
| lapis | Spell slots, concentration, spell attacks |
| ember | Conditions, warnings, exhaustion, bloodied HP |
| frost | Temporary HP |
| neutrals | Everything else: icons, headings, panels, rows, empty states |

Never write `accent-{hue}-*` (even in a file that already has some), raw
Tailwind hues, `text-white`, or `text-faint` on text someone needs to read.
An existing `accent-*` can stay when you only move code; restyling it is a
visible change, so list it for the owner instead of slipping it in.

## Recipes

**Group content: a section, not a box.** A group, a row or an empty state
gets no border, background or radius of its own.

```tsx
<Section heading="Spell slots" level={3} trailing={<Button size="sm">…</Button>}>
  <ul className="divide-divider divide-y">…rows…</ul>
</Section>
```

`Card` is only for one discrete object (a character, monster, spell, item,
campaign), never inside another Card, never for a settings row.

**Icons sit bare.** `<AppIcon name="spell" className="text-muted size-5" />`
(the app's icon registry, `ui/icons/AppIcon`; plain lucide for generic
glyphs) next to text that needs scanning, or alone in an icon button with an
`aria-label`. No tile, circle or tinted square behind an icon, neutral or
coloured. No `Sparkles`.

**One brass action per view.** Before adding `variant="primary"`, search the
whole view (header, toolbar, body, footer) for an existing one. If there is
one, your button is a plain `Button` (secondary outline).

**Empty state.** Plain centred text and one action; see `rollkeeper-copy`
for the wording.

```tsx
<div className="py-12 text-center">
  <p className="type-subheading text-heading">Add your first spell</p>
  <p className="type-body text-muted mt-2">{one line on what appears here}</p>
  <Button className="mt-4" onClick={openAddSpell}>Add spell</Button>
</div>
```

The button is `primary` only if the view has no other brass button.

**Destructive action.** The trigger is a blood outline; the confirm is the
shared dialog, which gives its confirm button the blood fill.

```tsx
<Button variant="danger" onClick={handleDelete}>Delete character</Button>

const confirmed = await confirmDialog({
  title: `Delete ${character.name}?`,
  message: 'The sheet is removed from this device.',
  confirmLabel: 'Delete character',
  tone: 'danger',
});
```

Never `ghost` for the trigger, never `danger-solid` outside the dialog, never
`window.confirm`.

**A setting with an explanation.** Use the primitive's own props; the
explanation is visible text, not a tooltip.

```tsx
<Switch label="{Setting name}" description="{What it does, one line}"
  checked={value} onCheckedChange={setValue} />
```

Don't wrap `Switch`, `Checkbox` or `Button` in a new "row" component.

**Editing a number: play or build?** Play values (current HP, slots, hit
dice, conditions, rolled initiative) get always-on controls: steppers, pips,
`InPlaceField`. Build values (max HP, ability scores, base AC, speed) are
plain text until edit mode, so take an `editing` prop and pass it through:

```tsx
// Plain text with room for its width:
<InPlaceField label="Speed" value={speed} onCommit={setSpeed} editing={editing} min={0} />

// Inside an ornament or a tight spot (popover from 640px, bottom sheet below):
<AnchoredEditor label="Max HP" value={maxHp} onSave={setMaxHp} editing={editing} min={1}>
  {editing ? (
    <button type="button" className="type-num-lg pointer-coarse:min-h-11 pointer-coarse:min-w-11">
    {maxHp}
  </button>
  ) : (
    <span className="type-num-lg">{maxHp}</span>
  )}
</AnchoredEditor>
```

A play value edited in place (rolled initiative) passes `editing` as always
true. Other number fields use `NumberInput`/`NumberField` (from
`@/components/ui/forms/NumberInput`). Never `type="number"` or
`parseInt(e.target.value) || 0`.

**HP status.** Take the tier from `hpTier()` (`src/utils/hpState.ts`):
`high` → healthy (verdigris bar, number stays `heading`), `mid`/`low` →
bloodied (ember), `critical` → critical (blood; "Down" at 0 HP). Write the
tier name as text. No other thresholds, and no `getHp*Color` in new UI.

**Touch (iPad players).** Primitives already reach 44px on coarse pointers.
For anything you build, add `pointer-coarse:min-h-11` (and `min-w-11` on
icon buttons); never always-on oversizing or negative-margin hacks. Rows
with a tappable control: `pointer-coarse:min-h-11`. Nothing hover-only:
if a tooltip says it, visible text says it too. No double-click,
right-click or long-press-only actions.

**Floating layers.** Dialogs: `Dialog` parts or `confirmDialog` /
`alertDialog` / `promptDialog`. Menus and popovers: `OVERLAY_SURFACE` (from
`@/components/ui/primitives/variants`).
Toasts: the page's `addToast({ type, title, message })`, passed down (a new
`useToast()` shows nothing without its own `ToastContainer`). Nothing else gets a shadow.

**Numbers and text.** One `type-*` utility per text element (`type-heading`,
`type-ui`, `type-num-lg` …). Sentence case; no `uppercase`, no
`tracking-*` on labels.

## Review checklist

Read every changed className and component. Flag:

1. Gradients (`bg-gradient-*`, `from-*`, gradient text), `backdrop-blur`, `shadow-lg/xl/2xl`, any shadow in page flow.
2. `hover:scale`, hover translate, shimmer, pulsing or floating decoration.
3. A box around a group, row or empty state; a Card in a Card; radius other than 0 / 4px (`rounded-sm`) / 6px (`rounded-md`) (full circles only for dots, pips, medallions and switches; Badge is 3px); pill buttons.
4. An icon in a tile or circle; `Sparkles`; a decorative icon beside a heading.
5. A role colour that fails the colour question; `accent-*`; raw hues; `text-white`; readable `text-faint`.
6. More than one `primary` Button in the view, counting existing ones.
7. A destructive trigger that isn't `danger`; a destructive action without `confirmDialog({ tone: 'danger' })`.
8. A new primitive that duplicates one in `src/components/ui/`.
9. A build value editable without an `editing` gate; `type="number"`; `parseInt(…) || 0`.
10. Hover-only information; targets under 44px on coarse pointers; inputs under 16px on touch; `title` as the only label.
11. `uppercase`, letter-spacing, Title Case, emoji or `!` (then run the copy skill).
12. `key={index}` on a dynamic list.

Then run `npm run design:ci` and `npm run design:contrast`; a raised count in
any file fails CI. Any visible change to existing UI (colour, layout, copy)
needs the owner's explicit yes: list each one in the PR.
