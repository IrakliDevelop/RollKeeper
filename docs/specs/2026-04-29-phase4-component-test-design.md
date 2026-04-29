# Phase 4: Component Interaction Tests — Design Spec

## Goal

Add render/smoke tests for ~30 components and deep interaction tests for 8 critical components, bringing total test count from ~2,049 to ~2,300+. All components are prop-driven (no direct store imports), so tests pass mock data and `vi.fn()` callbacks.

## Architecture

Two tiers of tests:

- **Tier 1 (smoke)**: Verify components render without crashing, show expected content, and respect display options (`readonly`, `compact`). Grouped into batch files by domain (~6 files, ~3–5 tests per component).
- **Tier 2 (deep)**: Full interaction flows — click buttons, type in inputs, assert on callback invocations and DOM changes. One test file per component (~8 files, ~8–15 tests each).

All tests use `@testing-library/react` with `render`, `screen`, `fireEvent`/`userEvent`, and `within`. No store mocking needed — components receive everything via props.

## Infrastructure

- **Vitest 4 + jsdom** already configured in `unit` project
- **`@testing-library/jest-dom`** matchers available via `src/test/setup.ts`
- **`next/image` mock** needed for `CharacterHeader` and `PlayerSummaryCard` — mock at top of those test files with `vi.mock('next/image', ...)`
- **Radix Dialog** components (SpellCastModal, SpellDetailsModal, CreateCampaignDialog, SendMessageDialog) render into portals — use `screen.getByRole('dialog')` to query inside them
- **`RichTextEditor`** used by SendMessageDialog and SpellFormFields — mock as a simple textarea

## Tier 1: Smoke/Render Tests

### File: `src/components/__tests__/character-smoke.test.tsx`

Components (~9):
- `CharacterHUD` — renders HP, AC, level, rest buttons; props: `character: CharacterState`, callbacks
- `CharacterHeader` — renders name, race, class; props: `name`, `race`, `classInfo`, `level` (uses `next/image`)
- `CharacterBasicInfo` — renders basic character info
- `MulticlassManager` — renders class list with levels
- `ArmorClassManager` — renders AC breakdown
- `CombatStats` — renders initiative, speed, AC summary
- `Skills` — renders skill list with modifiers
- `AbilityScoreDisplay` — renders 6 ability scores with modifiers
- `DaysSpentTracker` — renders day counter

Tests per component:
1. Renders without crashing with minimal required props
2. Displays expected key content (name, value, label)
3. Respects `readonly` or `compact` prop where applicable

### File: `src/components/__tests__/combat-smoke.test.tsx`

Components (~3):
- `HitDiceTracker` — renders hit dice pools with use/restore buttons; props: `hitDicePools`, callbacks
- `ConditionBadge` — renders condition name with optional stack count and remove button
- `HPBar` — renders colored HP bar based on percentage

Tests per component:
1. Renders with required props
2. Shows expected content (die types, condition name, HP values)
3. `ConditionBadge` calls `onRemove` when X clicked

### File: `src/components/__tests__/spells-smoke.test.tsx`

Components (~3):
- `SpellFormFields` — renders spell form with school, level, casting time selects; props: `formData`, `onChange`
- `SpellDetailsModal` — renders spell details in dialog; props: `spell`, `isOpen`, `onClose`
- `SpellCastModal` — renders spell casting options with slot selection; props: `spell`, `spellSlots`, `concentration`, `onCastSpell`

Tests per component:
1. Renders with required props (dialog ones need `isOpen: true`)
2. Shows expected spell info
3. SpellFormFields calls `onChange` when field edited

### File: `src/components/__tests__/equipment-smoke.test.tsx`

Components (~5):
- `WeaponCard` — renders weapon name, damage, attack bonus
- `MagicItemRow` — renders magic item with rarity, attunement
- `ItemCard` — renders inventory item with quantity, location
- `ChargePoolDisplay` — renders charge dots/bar
- `MagicItemCard` — renders expanded magic item details

Tests per component:
1. Renders with required props
2. Shows expected content

### File: `src/components/__tests__/campaign-smoke.test.tsx`

Components (~5):
- `PlayerSummaryCard` — renders player HP, AC, class info (uses `next/image`)
- `SyncIndicator` — renders sync status badge
- `DmMessageNotification` — renders message list with accept/dismiss buttons
- `CreateCampaignDialog` — renders name input and create button
- `SendMessageDialog` — renders recipient selector and message input

Tests per component:
1. Renders with required props
2. Shows expected content
3. `DmMessageNotification` calls `onDismiss` when dismiss clicked

### File: `src/components/__tests__/encounter-smoke.test.tsx`

Components (~3):
- `EntityCard` — renders entity name, HP bar, conditions, initiative
- `InitiativeTracker` — renders entity list sorted by initiative, turn controls
- `MonsterStatBlockPanel` — renders monster stats (abilities, AC, HP, features)

Tests per component:
1. Renders with required props
2. Shows expected entity/monster info

## Tier 2: Deep Interaction Tests

### File: `src/components/shared/combat/__tests__/HitPointTracker.test.tsx`

Tests (~15):
- Renders current/max/temp HP values
- Damage input: type number, click apply, calls `onApplyDamage` with correct value
- Healing input: type number, click apply, calls `onApplyHealing` with correct value
- Temp HP input: type number, click apply, calls `onAddTemporaryHP` with correct value
- Clears input after applying damage/healing
- Death saves: shows when HP is 0; click success/failure calls `onMakeDeathSave`
- Death save critical success (nat 20) behavior
- Dead state: shows skull/dead indicator when 3 failures
- Stabilized state: shows when 3 successes
- Reset death saves button calls `onResetDeathSaves`
- Calculation mode toggle calls `onToggleCalculationMode`
- Readonly mode hides controls
- Compact mode renders smaller layout
- Shows level/class/constitution info when provided
- Direct HP edit via `onUpdateHitPoints`

### File: `src/components/shared/spells/__tests__/SpellSlotTracker.test.tsx`

Tests (~12):
- Renders spell slots for each level that has max > 0
- Slot checkboxes: clicking toggles used/available, calls `onSpellSlotChange`
- Does not render levels with 0 max slots
- Pact magic section renders when `pactMagic` provided
- Pact magic checkbox calls `onPactMagicChange`
- Reset button calls `onResetSpellSlots`
- Pact magic reset calls `onResetPactMagic`
- `readonly` hides controls
- `compact` renders smaller layout
- `showOnlyUsed` filters to only partially-used levels
- `maxLevelToShow` caps the displayed levels
- Returns null when no spell slots and no pact magic

### File: `src/components/shared/character/__tests__/TraitTracker.test.tsx`

Tests (~12):
- Renders list of traits with name and usage count
- Use button calls `onUseTrait` with trait ID
- Displays max uses (including level-scaling via `calculateTraitMaxUses`)
- Trait click calls `onTraitClick`
- Delete button calls `onDeleteTrait`
- Short rest reset calls `onResetTraits('short')`
- Long rest reset calls `onResetTraits('long')`
- Search filtering narrows displayed traits
- `readonly` hides action buttons
- `compact` layout
- `showOnlyUsed` filters to traits with remaining uses
- `maxTraitsToShow` caps list

### File: `src/components/shared/character/__tests__/CurrencyManager.test.tsx`

Tests (~10):
- Renders all 5 currency types (pp, gp, ep, sp, cp)
- Displays current amounts
- Add button: type amount, click add, calls callback with correct type and amount
- Subtract button: type amount, click subtract, calls callback
- Shows total value in gold equivalent
- Handles zero amounts
- Handles large amounts
- Readonly mode hides add/subtract controls
- Compact layout
- Currency type abbreviations displayed correctly

### File: `src/components/shared/character/__tests__/XPTracker.test.tsx`

Tests (~10):
- Renders current XP and level
- Shows XP progress bar with correct percentage
- Shows XP needed for next level
- Add XP: type amount, click add, calls `onAddXP`
- Set XP: type amount, set directly, calls `onSetXP`
- Level-up alert shows when `shouldLevelUp` returns true
- No level-up alert when below threshold
- Readonly hides controls
- Compact layout
- Hides thresholds when `hideThresholds` is true

### File: `src/components/shared/character/__tests__/InventoryManager.test.tsx`

Tests (~12):
- Renders list of items with names and quantities
- Add item flow: click add, fill form, submit, calls `onAddItem`
- Delete item calls `onDeleteItem`
- Quantity change calls `onQuantityChange`
- Search filtering narrows items
- Location grouping collapses/expands
- Category filter works
- Quick stats show total weight and value
- Override weight/value props replace calculated totals
- Readonly hides add/delete/edit controls
- Compact layout
- `maxItemsToShow` caps displayed items

### File: `src/components/ui/game/__tests__/DiceRoller.test.tsx`

Tests (~10):
- Renders quick roll buttons (1d20, 2d6, etc.)
- Clicking quick button triggers roll and calls `onRollResult`
- Custom notation input: type "3d8+2", submit, triggers roll
- Invalid notation shows error
- Roll history displays previous results
- History respects `maxHistoryResults`
- `showControls: false` hides controls
- `showHistory: false` hides history
- `showQuickButtons: false` hides quick buttons
- Custom quick buttons render with provided labels

### File: `src/components/shared/character/__tests__/HeroicInspirationTracker.test.tsx`

Tests (~8):
- Renders current inspiration count
- Add button calls `onAddInspiration`
- Use button calls `onUseInspiration`
- Use button disabled when inspiration is 0
- Reset button calls `onResetInspiration`
- Settings toggle shows/hides configuration
- Readonly hides controls
- Compact layout

## Mock Patterns

### next/image mock (for CharacterHeader, PlayerSummaryCard)
```typescript
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));
```

### RichTextEditor mock (for SendMessageDialog, SpellFormFields)
```typescript
vi.mock('@/components/ui/forms/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
```

### Minimal type fixtures
Reuse `makeCharacter()` from `src/utils/__tests__/test-utils.ts` for `CharacterState`. Build minimal fixtures for other types (Spell, EncounterEntity, etc.) directly in test files — keep them as small as possible, only filling required fields.

## Test File Locations

Smoke tests go in `src/components/__tests__/` (domain-grouped batch files).
Deep tests go alongside their component: `src/components/shared/combat/__tests__/HitPointTracker.test.tsx`, etc.

## Expected Outcome

- ~28 smoke tests across 6 files (~30 components, ~3 tests each = ~90 assertions but grouped as ~28 describe blocks)
- ~89 deep interaction tests across 8 files
- Total new tests: ~200+
- Grand total: ~2,250+
