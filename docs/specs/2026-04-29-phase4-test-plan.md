# Phase 4: Component Interaction Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add render/smoke tests for ~30 components and deep interaction tests for 8 critical components, bringing total tests from ~2,049 to ~2,250+.

**Architecture:** Two tiers — Tier 1 smoke tests grouped by domain (6 batch files), Tier 2 deep interaction tests (8 individual files). All components are prop-driven; tests pass mock data and `vi.fn()` callbacks. No store mocking needed.

**Tech Stack:** Vitest 4, jsdom, @testing-library/react (render, screen, fireEvent), @testing-library/jest-dom matchers.

---

## File Structure

**Tier 1 — Smoke tests (new files):**
- `src/components/__tests__/character-smoke.test.tsx` — 9 character components
- `src/components/__tests__/combat-smoke.test.tsx` — 3 combat components
- `src/components/__tests__/spells-smoke.test.tsx` — 2 spell components
- `src/components/__tests__/equipment-smoke.test.tsx` — 5 equipment components
- `src/components/__tests__/campaign-smoke.test.tsx` — 4 campaign components
- `src/components/__tests__/encounter-smoke.test.tsx` — 3 encounter components

**Tier 2 — Deep interaction tests (new files):**
- `src/components/shared/combat/__tests__/HitPointTracker.test.tsx`
- `src/components/shared/spells/__tests__/SpellSlotTracker.test.tsx`
- `src/components/shared/character/__tests__/TraitTracker.test.tsx`
- `src/components/shared/character/__tests__/CurrencyManager.test.tsx`
- `src/components/shared/character/__tests__/XPTracker.test.tsx`
- `src/components/shared/character/__tests__/InventoryManager.test.tsx`
- `src/components/ui/game/__tests__/DiceRoller.test.tsx`
- `src/components/shared/character/__tests__/HeroicInspirationTracker.test.tsx`

---

### Task 1: Character smoke tests

**Files:**
- Create: `src/components/__tests__/character-smoke.test.tsx`

- [ ] **Step 1: Write the test file**

Read each component file to verify props and rendering before writing. Components to test:

1. `CharacterHUD` at `src/components/ui/character/CharacterHUD.tsx` — needs `character: CharacterState` + multiple callbacks
2. `CharacterHeader` at `src/components/shared/character/CharacterHeader.tsx` — needs `name` + uses `next/image`
3. `CharacterBasicInfo` at `src/components/ui/character/CharacterBasicInfo.tsx`
4. `MulticlassManager` at `src/components/ui/character/MulticlassManager.tsx`
5. `ArmorClassManager` at `src/components/ui/character/ArmorClassManager.tsx`
6. `CombatStats` at `src/components/ui/character/CombatStats.tsx` — default export
7. `Skills` at `src/components/ui/character/Skills.tsx` — default export
8. `AbilityScoreDisplay` at `src/components/shared/stats/AbilityScoreDisplay.tsx`
9. `DaysSpentTracker` at `src/components/ui/character/DaysSpentTracker.tsx` — default export

For each component write:
- `it('renders without crashing')` — render with minimal required props, expect no throw
- `it('displays expected content')` — check for key text/labels using `screen.getByText` or `screen.getByRole`

Use `makeCharacter()` from `src/utils/__tests__/test-utils.ts` for `CharacterState` fixtures. Mock `next/image` at the top:

```typescript
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props as Record<string, unknown>;
    return <img {...rest} />;
  },
}));
```

Read each component's props interface and imports before writing — some use default exports, some named exports. Verify the exact import path.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/__tests__/character-smoke.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/character-smoke.test.tsx
git commit -m "test: add character component smoke tests"
```

---

### Task 2: Combat smoke tests

**Files:**
- Create: `src/components/__tests__/combat-smoke.test.tsx`

- [ ] **Step 1: Write the test file**

Components to test:

1. `HitDiceTracker` at `src/components/ui/character/HitDiceTracker.tsx` — props: `hitDicePools: HitDicePools`, `onUseHitDie`, `onRestoreHitDice`, `onResetAllHitDice`
2. `ConditionBadge` at `src/components/shared/combat/ConditionBadge.tsx` — props: `name: string`, optional `stackCount`, `sourceSpell`, `onRemove`, `size`
3. `HPBar` at `src/components/shared/combat/HPBar.tsx` — props: `current: number`, `max: number`, optional `temp`, `showLabel`, `size`

Types needed:
```typescript
import { HitDicePools } from '@/types/character';

const mockHitDicePools: HitDicePools = {
  d10: { max: 5, used: 2 },
  d6: { max: 3, used: 0 },
};
```

Tests:
- `HitDiceTracker` renders die types ("d10", "d6"), shows remaining counts
- `ConditionBadge` renders condition name; calls `onRemove` when X button clicked
- `HPBar` renders HP bar; shows label when `showLabel: true`

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/__tests__/combat-smoke.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/combat-smoke.test.tsx
git commit -m "test: add combat component smoke tests"
```

---

### Task 3: Spells smoke tests

**Files:**
- Create: `src/components/__tests__/spells-smoke.test.tsx`

- [ ] **Step 1: Write the test file**

Components to test:

1. `SpellFormFields` at `src/components/shared/spells/SpellFormFields.tsx` — props: `formData: SpellFormData`, `onChange`
2. `SpellDetailsModal` at `src/components/ui/game/SpellDetailsModal.tsx` — **default export**, props: `spell: Spell`, `isOpen`, `onClose`

Read `src/utils/spellConversion.ts` for the `SpellFormData` type shape. You'll need a minimal fixture.

Mock `RichTextEditor` since `SpellFormFields` imports it:
```typescript
vi.mock('@/components/ui/forms/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
```

For `SpellDetailsModal`, mock `@/components/ui/feedback/dialog` if it causes portal issues in jsdom, or use `screen.getByRole('dialog')`.

Spell fixture:
```typescript
const mockSpell: Spell = {
  id: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  castingTime: '1 action',
  range: '150 feet',
  components: { verbal: true, somatic: true, material: true, materialDescription: 'a tiny ball of bat guano' },
  duration: 'Instantaneous',
  description: 'A bright streak flashes from your finger...',
  concentration: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

Tests:
- `SpellFormFields` renders with formData; calls `onChange` when a field is changed
- `SpellDetailsModal` renders spell name and level when `isOpen: true`

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/__tests__/spells-smoke.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/spells-smoke.test.tsx
git commit -m "test: add spell component smoke tests"
```

---

### Task 4: Equipment smoke tests

**Files:**
- Create: `src/components/__tests__/equipment-smoke.test.tsx`

- [ ] **Step 1: Write the test file**

Components to test:

1. `WeaponCard` at `src/components/ui/game/equipment/WeaponCard.tsx` — props: `weapon: Weapon`, `onEdit`, `onDelete`, `onToggleEquip`
2. `MagicItemRow` at `src/components/ui/character/equipment/MagicItemRow.tsx` — props: `item: MagicItem`, `characterLevel`, `onEdit`, `onDelete`, `onToggleAttunement`
3. `ItemCard` at `src/components/ui/game/inventory/ItemCard.tsx` — props: `item: InventoryItem`
4. `ChargePoolDisplay` at `src/components/ui/character/equipment/ChargePoolDisplay.tsx` — props: `pool: ChargePool`, `onExpendAbility`, `onRestorePool`, `onSetPoolUsed`
5. `MagicItemCard` at `src/components/ui/game/equipment/MagicItemCard.tsx`

Read each component file first to verify exact prop interfaces and required fields. Build minimal fixtures for `Weapon`, `MagicItem`, `InventoryItem`, and `ChargePool` types from `src/types/character.ts`.

Tests per component:
- Renders without crashing with minimal required props
- Displays expected content (weapon name/damage, item name/quantity, etc.)

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/__tests__/equipment-smoke.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/equipment-smoke.test.tsx
git commit -m "test: add equipment component smoke tests"
```

---

### Task 5: Campaign smoke tests

**Files:**
- Create: `src/components/__tests__/campaign-smoke.test.tsx`

- [ ] **Step 1: Write the test file**

Components to test:

1. `PlayerSummaryCard` at `src/components/ui/campaign/PlayerSummaryCard.tsx` — props: `CampaignPlayerData` (uses `next/image`)
2. `DmMessageNotification` at `src/components/ui/campaign/DmMessageNotification.tsx` — props: `messages: DmMessage[]`, `onAccept`, `onDismiss`
3. `CreateCampaignDialog` at `src/components/ui/campaign/CreateCampaignDialog.tsx` — props: `open`, `onOpenChange`, `onCampaignCreated`, `dmId`
4. `SendMessageDialog` at `src/components/ui/campaign/SendMessageDialog.tsx` — props: `open`, `onClose`, `players`, `campaignCode`, `dmId`

Mock `next/image` for `PlayerSummaryCard`. Mock `RichTextEditor` for `SendMessageDialog`.

Read `src/types/campaign.ts` for `CampaignPlayerData` shape and `src/types/sharedState.ts` for `DmMessage` shape. Build minimal fixtures.

Tests:
- `PlayerSummaryCard` renders player name, class, HP info
- `DmMessageNotification` renders messages; calls `onDismiss` when dismiss button clicked
- `CreateCampaignDialog` renders when `open: true`, shows name input
- `SendMessageDialog` renders when `open: true`, shows player list

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/__tests__/campaign-smoke.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/campaign-smoke.test.tsx
git commit -m "test: add campaign component smoke tests"
```

---

### Task 6: Encounter smoke tests

**Files:**
- Create: `src/components/__tests__/encounter-smoke.test.tsx`

- [ ] **Step 1: Write the test file**

Components to test:

1. `EntityCard` at `src/components/ui/encounter/EntityCard.tsx` — props: `entity: EncounterEntity`, `isCurrentTurn`, + many callbacks
2. `InitiativeTracker` at `src/components/ui/encounter/InitiativeTracker.tsx` — props: `encounter: Encounter`, + many callbacks
3. `MonsterStatBlockPanel` at `src/components/ui/encounter/MonsterStatBlockPanel.tsx` — props: `statBlock: MonsterStatBlock`

Build minimal fixtures from `src/types/encounter.ts`:
```typescript
import { EncounterEntity, Encounter, MonsterStatBlock } from '@/types/encounter';

const mockEntity: EncounterEntity = {
  id: 'e1',
  type: 'monster',
  name: 'Goblin',
  initiative: 15,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
};

const mockEncounter: Encounter = {
  id: 'enc1',
  name: 'Test Encounter',
  entities: [mockEntity],
  currentTurn: 0,
  round: 1,
  isActive: true,
  sortOrder: 'initiative',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockStatBlock: MonsterStatBlock = {
  str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
  saves: '', skills: 'Stealth +6', speed: '30 ft.',
  resistances: '', immunities: '', vulnerabilities: '',
  conditionImmunities: [],
  senses: 'darkvision 60 ft.', passivePerception: 9,
  traits: [], actions: [{ name: 'Scimitar', text: 'Melee Weapon Attack: +4 to hit, 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.' }],
  reactions: [], bonusActions: [], lairActions: [],
  cr: '1/4', type: 'humanoid', size: 'Small',
  languages: 'Common, Goblin', alignment: 'neutral evil', hpFormula: '2d6',
};
```

Tests:
- `EntityCard` renders entity name, HP bar
- `InitiativeTracker` renders encounter entities, turn controls
- `MonsterStatBlockPanel` renders stat block info (abilities, AC type, etc.)

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/__tests__/encounter-smoke.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/encounter-smoke.test.tsx
git commit -m "test: add encounter component smoke tests"
```

---

### Task 7: HitPointTracker deep interaction tests

**Files:**
- Create: `src/components/shared/combat/__tests__/HitPointTracker.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/combat/HitPointTracker.tsx`.

Props interface:
```typescript
interface HitPointTrackerProps {
  hitPoints: HitPoints;
  classInfo?: ClassInfo;
  level?: number;
  constitutionScore?: number;
  onApplyDamage?: (damage: number) => void;
  onApplyHealing?: (healing: number) => void;
  onAddTemporaryHP?: (tempHP: number) => void;
  onMakeDeathSave?: (isSuccess: boolean, isCritical?: boolean) => void;
  onResetDeathSaves?: () => void;
  onToggleCalculationMode?: () => void;
  onRecalculateMaxHP?: () => void;
  onUpdateHitPoints?: (updates: Partial<HitPoints>) => void;
  readonly?: boolean;
  compact?: boolean;
  showControls?: boolean;
  showDeathSaves?: boolean;
  showCalculationInfo?: boolean;
  hideLabels?: boolean;
}
```

Fixture:
```typescript
const baseHitPoints: HitPoints = {
  current: 25,
  max: 40,
  temporary: 5,
  calculationMode: 'auto',
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};
```

Tests (~15):
1. Renders current HP (25), max HP (40), temp HP (5)
2. Shows "Alive" status text for healthy character
3. Damage: type "10" into damage input, click "Dmg" button → `onApplyDamage(10)` called
4. Healing: type "5" into healing input, click "Heal" button → `onApplyHealing(5)` called
5. Temp HP: type "8" into temp HP input, click "Temp" button → `onAddTemporaryHP(8)` called
6. Damage input clears after apply
7. Death saves section appears when `current: 0` + `deathSaves` present — character is dying (uses `isDying` from hpCalculations)
8. Click success death save circle → `onMakeDeathSave(true, false)` called
9. Click failure death save circle → `onMakeDeathSave(false, false)` called
10. "Natural 20!" button → `onMakeDeathSave(true, true)` called
11. Dead state: 3 failures shows "Dead" text
12. Stabilized state: 3 successes shows "Stabilized" text
13. Reset death saves button → `onResetDeathSaves()` called
14. `readonly: true` hides damage/healing/temp HP controls
15. Renders "Hit Points" title with Heart icon

The damage/healing/temp inputs are plain `<input type="number">` elements with placeholder "Amount". Use `screen.getByPlaceholderText('Amount')` — but there are 3 of them, so use `within` on the parent section or `getAllByPlaceholderText` and index by position (damage=0, healing=1, tempHP=2).

The buttons have text content "Dmg", "Heal", "Temp" respectively. Use `screen.getByRole('button', { name: /Dmg/ })` etc.

Death save circles are `<button>` elements with titles like "Click to add success" / "Click to add failure". Use `screen.getByTitle('Click to add success')` to find the first clickable success circle.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/combat/__tests__/HitPointTracker.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/combat/__tests__/HitPointTracker.test.tsx
git commit -m "test: add HitPointTracker interaction tests"
```

---

### Task 8: SpellSlotTracker deep interaction tests

**Files:**
- Create: `src/components/shared/spells/__tests__/SpellSlotTracker.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/spells/SpellSlotTracker.tsx`.

Fixture:
```typescript
const mockSpellSlots: SpellSlots = {
  1: { max: 4, used: 1 },
  2: { max: 3, used: 0 },
  3: { max: 2, used: 2 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

const mockPactMagic: PactMagic = {
  slots: { max: 2, used: 1 },
  level: 3,
};
```

Tests (~12):
1. Renders "Spell Slots" title
2. Shows Level 1 with "3/4" remaining badge (max 4, used 1 → 3 remaining)
3. Shows Level 2 with "3/3" remaining badge
4. Shows Level 3 with "0/2" remaining badge (all used)
5. Does NOT render Level 4-9 (max: 0)
6. Clicking a slot checkbox calls `onSpellSlotChange` — the slot buttons have title like "Spell slot 1 - Available". Click an available slot to mark used.
7. "Reset Slots" button calls `onResetSpellSlots`
8. Pact Magic section renders with "Pact Magic" heading when `pactMagic` provided
9. Pact Magic shows remaining "1/2" badge
10. "Reset Pact" button calls `onResetPactMagic`
11. Returns `null` when all spell slots have max=0 and no pact magic — render, assert `container.firstChild` is null
12. `readonly: true` disables slot checkboxes (buttons have `disabled` attribute)

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/spells/__tests__/SpellSlotTracker.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/spells/__tests__/SpellSlotTracker.test.tsx
git commit -m "test: add SpellSlotTracker interaction tests"
```

---

### Task 9: TraitTracker deep interaction tests

**Files:**
- Create: `src/components/shared/character/__tests__/TraitTracker.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/character/TraitTracker.tsx`.

Fixture:
```typescript
const mockTraits: TrackableTrait[] = [
  {
    id: 't1',
    name: 'Action Surge',
    description: 'Take one additional action.',
    maxUses: 1,
    usedUses: 0,
    restType: 'short',
    source: 'Fighter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2',
    name: 'Second Wind',
    description: 'Regain hit points equal to 1d10 + fighter level.',
    maxUses: 1,
    usedUses: 1,
    restType: 'short',
    source: 'Fighter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't3',
    name: 'Indomitable',
    description: 'Reroll a failed saving throw.',
    maxUses: 1,
    usedUses: 0,
    restType: 'long',
    source: 'Fighter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
```

Tests (~12):
1. Renders trait names ("Action Surge", "Second Wind", "Indomitable")
2. Shows usage badges — "1/1 Uses" for Action Surge (0 used of 1 max)
3. Use button (Zap icon) calls `onUseTrait` with trait id when clicked — the button has title "Use ability"
4. Delete button (Trash2 icon) calls `onDeleteTrait` with trait id — title "Delete ability"
5. View button (Eye icon) calls `onTraitClick` with trait — title "View ability details"
6. Short Rest button calls `onResetTraits('short')` — button text "Short Rest"
7. Long Rest button calls `onResetTraits('long')` — button text "Long Rest"
8. Search input filters traits — type "Action" in search input (placeholder "Search abilities..."), only "Action Surge" visible
9. `readonly: true` hides Use/Delete buttons
10. Shows "No special abilities yet" for empty traits array
11. `showOnlyUsed: true` shows only traits with `usedUses > 0` (only Second Wind)
12. `maxTraitsToShow: 1` shows only first trait

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/character/__tests__/TraitTracker.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/__tests__/TraitTracker.test.tsx
git commit -m "test: add TraitTracker interaction tests"
```

---

### Task 10: CurrencyManager deep interaction tests

**Files:**
- Create: `src/components/shared/character/__tests__/CurrencyManager.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/character/CurrencyManager.tsx`.

Fixture:
```typescript
const mockCurrency: Currency = {
  copper: 50,
  silver: 20,
  electrum: 5,
  gold: 100,
  platinum: 2,
};
```

The component uses internal state for the input amounts (`currencyAmounts`). The Add/Spend buttons for each currency type have labels "Add" and "Spend". Each currency section has the type name as a label (e.g., "Platinum", "Gold").

Total wealth display: 100gp + 20sp + 50cp + 5ep + 2pp = 100*100 + 20*10 + 50 + 5*50 + 2*1000 = 10000 + 200 + 50 + 250 + 2000 = 12,500 cp. Shows "125 gp" in breakdown.

Tests (~10):
1. Renders all 5 currency types (pp, gp, ep, sp, cp badges)
2. Shows current amounts (50, 20, 5, 100, 2)
3. Shows total wealth badge ("12,500 cp")
4. Shows wealth breakdown ("125 gp")
5. Add gold: type "50" in Gold's input, click "Add" → `onAddCurrency('gold', 50)` called
6. Spend silver: type "10" in Silver's input, click "Spend" → `onSubtractCurrency('silver', 10)` called
7. Add button disabled when amount input is 0 or empty
8. `readonly: true` hides Manage Currency section
9. Currency conversion info section shows when `hideConversionInfo: false` (default)
10. Compact mode hides currency names (only shows abbreviations)

To target the correct currency input, find by label text: `screen.getByLabelText('Gold')` gets the input under the "Gold" label. Multiple "Add"/"Spend" buttons exist — use `within` on each currency's section, or find the button by its closest label.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/character/__tests__/CurrencyManager.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/__tests__/CurrencyManager.test.tsx
git commit -m "test: add CurrencyManager interaction tests"
```

---

### Task 11: XPTracker deep interaction tests

**Files:**
- Create: `src/components/shared/character/__tests__/XPTracker.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/character/XPTracker.tsx`.

The component uses `getXPForLevel`, `getXPToNextLevel`, `getXPProgress`, `shouldLevelUp` from `@/utils/calculations`. For a Level 5 character:
- XP for Level 5: 6,500
- XP for Level 6: 14,000
- So with 10,000 XP at Level 5: `xpToNext = 14000 - 10000 = 4000`, `progress = (10000-6500)/(14000-6500)*100 ≈ 46.7%`

The form has an `<Input>` with placeholder "XP to add..." (add mode) or "Total XP..." (set mode), and a submit button "Add" or "Set".

Tests (~10):
1. Renders current XP "10,000" and "Level 5"
2. Shows "To Next Level:" with "4,000 XP"
3. Shows progress bar (style width ~46.7%)
4. Add XP: type "500" in input, submit form → `onAddXP(500)` called
5. Input clears after submit
6. Shows level-up alert when `shouldLevelUp` would return true — use `currentXP: 14000` for Level 5 (equals Level 6 threshold). The component checks `shouldLevelUp(currentXP + value, currentLevel)` on submit. So pass `currentXP: 13500, currentLevel: 5`, add 500. Uses `vi.useFakeTimers()` since alert auto-dismisses via `setTimeout`.
7. No level-up alert when below threshold
8. `readonly: true` hides the form
9. Shows level thresholds ("Level 5: 6,500 XP", "Level 6: 14,000 XP") by default
10. `hideThresholds: true` hides level thresholds

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/character/__tests__/XPTracker.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/__tests__/XPTracker.test.tsx
git commit -m "test: add XPTracker interaction tests"
```

---

### Task 12: InventoryManager deep interaction tests

**Files:**
- Create: `src/components/shared/character/__tests__/InventoryManager.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/character/InventoryManager.tsx` (561 lines).

This component uses `useItemsData` and `useMagicItemsData` hooks internally for item autofill. Mock both:
```typescript
vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({ items: [], loading: false, error: null }),
}));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({ magicItems: [], loading: false, error: null }),
}));
```

Also mock the `DragDropList` component since it uses drag-and-drop:
```typescript
vi.mock('@/components/ui/layout/DragDropList', () => ({
  default: ({ items, renderItem }: { items: unknown[]; renderItem: (item: unknown) => React.ReactNode }) => (
    <div data-testid="drag-drop-list">{items.map((item, i) => <div key={i}>{renderItem(item)}</div>)}</div>
  ),
}));
```

Read the component to verify the exact UI flow for adding items, filtering, etc.

Fixture:
```typescript
const mockItems: InventoryItem[] = [
  {
    id: 'i1', name: 'Rope', category: 'misc', quantity: 1,
    weight: 10, value: 100, location: 'Backpack', tags: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'i2', name: 'Torch', category: 'consumable', quantity: 5,
    weight: 1, value: 1, location: 'Belt', tags: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'i3', name: 'Health Potion', category: 'consumable', quantity: 2,
    weight: 0.5, value: 50, location: 'Backpack', tags: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];
```

Tests (~10):
1. Renders item names ("Rope", "Torch", "Health Potion")
2. Shows item quantities
3. Shows total weight and value in quick stats area
4. Search filtering: type in search input → only matching items shown
5. Add button exists (Plus icon or "Add Item" text) — click opens form
6. Delete item: clicking delete on an item calls `onDeleteItem` with item id
7. Quantity change calls `onQuantityChange`
8. `readonly: true` hides add/delete/edit controls
9. `overrideTotalWeight` and `overrideTotalValue` replace calculated totals
10. `maxItemsToShow: 2` caps displayed items to 2

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/character/__tests__/InventoryManager.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/__tests__/InventoryManager.test.tsx
git commit -m "test: add InventoryManager interaction tests"
```

---

### Task 13: DiceRoller deep interaction tests

**Files:**
- Create: `src/components/ui/game/__tests__/DiceRoller.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/ui/game/DiceRoller.tsx`.

This component uses `useDiceRoller` hook which imports `@3d-dice/dice-box` (WebGL 3D library). The entire hook must be mocked since jsdom has no WebGL:

```typescript
const mockRoll = vi.fn();
const mockClearDice = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('@/hooks/useDiceRoller', () => ({
  useDiceRoller: () => ({
    isInitialized: true,
    isRolling: false,
    rollHistory: [],
    roll: mockRoll,
    clearDice: mockClearDice,
    clearHistory: mockClearHistory,
    setAutoClearDelay: vi.fn(),
    autoClearDelay: 10000,
  }),
}));
```

Also mock the `DiceResultDisplay` to simplify testing:
```typescript
vi.mock('../DiceResultDisplay', () => ({
  DiceResultDisplay: ({ rollHistory }: { rollHistory: unknown[] }) => (
    <div data-testid="dice-results">History: {rollHistory.length}</div>
  ),
}));
```

Tests (~8):
1. Renders "Dice Roller" heading
2. Shows "Ready" status indicator (green dot)
3. Renders quick roll buttons: "1d20", "2d6", "1d12", "4d6"
4. Clicking "1d20" button calls `mockRoll('1d20')`
5. Custom notation: type "3d8+2" in input, press Enter → `mockRoll('3d8+2')` called
6. Custom Roll button calls `mockRoll` with input value
7. `showQuickButtons: false` hides quick buttons section
8. Custom quick buttons: pass custom `quickButtons` array, verify custom labels rendered

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/ui/game/__tests__/DiceRoller.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/game/__tests__/DiceRoller.test.tsx
git commit -m "test: add DiceRoller interaction tests"
```

---

### Task 14: HeroicInspirationTracker deep interaction tests

**Files:**
- Create: `src/components/shared/character/__tests__/HeroicInspirationTracker.test.tsx`

- [ ] **Step 1: Write the test file**

Component at `src/components/shared/character/HeroicInspirationTracker.tsx`.

Fixture:
```typescript
const baseInspiration: HeroicInspiration = {
  count: 2,
  maxCount: 5,
};
```

Tests (~8):
1. Renders current count "2" and max "/ 5"
2. Shows "2 inspiration dice" text
3. Add button calls `onAddInspiration(1)` — button text "Add"
4. Use button calls `onUseInspiration` — button text "Use"
5. Use button disabled when `count: 0` — rerender with `{ count: 0 }`
6. Add button disabled when count equals maxCount — render with `{ count: 5, maxCount: 5 }`
7. Reset button (RotateCcw icon) calls `onResetInspiration` — button title "Reset to 0"
8. Settings button (Settings icon) toggles settings panel — click to show, verify "Max Inspiration:" label appears

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/components/shared/character/__tests__/HeroicInspirationTracker.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/__tests__/HeroicInspirationTracker.test.tsx
git commit -m "test: add HeroicInspirationTracker interaction tests"
```

---

### Task 15: Full suite verification

- [ ] **Step 1: Run all unit tests**

Run: `npm run test -- --reporter=verbose`

Expected: All tests pass.

- [ ] **Step 2: Run type checking**

Run: `npm run type-check`

Expected: No new type errors in test files.

- [ ] **Step 3: Fix any issues and commit**

If any test needed fixing:

```bash
git add -u
git commit -m "fix: resolve type errors in Phase 4 test files"
```

- [ ] **Step 4: Verify test count**

Run: `npm run test -- --reporter=verbose 2>&1 | tail -5`

Expected: Test count increased from ~2,049 to ~2,250+ total.
