# Phase 5: Visual Regression Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storybook stories with screenshot baselines for 14 critical components in both light and dark themes, catching CSS/layout regressions that interaction tests miss.

**Architecture:** Each component gets a `.stories.tsx` file alongside it. Stories render visual states with props. Every story has a dark variant via `globals: { theme: 'dark' }`. Screenshots captured via `page.imageSnapshot()` inside `play` functions. Baselines stored in `__screenshots__/` directories committed to git.

**Tech Stack:** Storybook 10 (`@storybook/nextjs-vite`), `@storybook/addon-vitest`, `@vitest/browser-playwright` (Chromium), `pixelmatch` comparator.

---

## File Structure

**New story files (14):**
- `src/components/shared/combat/HitPointTracker.stories.tsx`
- `src/components/shared/spells/SpellSlotTracker.stories.tsx`
- `src/components/shared/character/TraitTracker.stories.tsx`
- `src/components/shared/character/CurrencyManager.stories.tsx`
- `src/components/shared/character/XPTracker.stories.tsx`
- `src/components/shared/character/InventoryManager.stories.tsx`
- `src/components/ui/game/DiceRoller.stories.tsx`
- `src/components/shared/character/HeroicInspirationTracker.stories.tsx`
- `src/components/ui/character/CharacterHUD.stories.tsx`
- `src/components/shared/combat/HPBar.stories.tsx`
- `src/components/ui/encounter/EntityCard.stories.tsx`
- `src/components/ui/campaign/PlayerSummaryCard.stories.tsx`
- `src/components/ui/encounter/MonsterStatBlockPanel.stories.tsx`
- `src/components/shared/combat/ConditionBadge.stories.tsx`

**Modified files:**
- `package.json` — add `test:visual` and `test:all` scripts

**Auto-generated (by first test run):**
- `__screenshots__/` directories next to each story file with `.png` baselines

---

### Task 1: Add npm scripts and verify storybook project runs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add test:visual and test:all scripts**

In `package.json`, add two new scripts after the existing `test:watch` line:

```json
"test:visual": "vitest run --project storybook",
"test:all": "vitest run",
```

The final scripts block should include:
```json
"test": "vitest run --project unit",
"test:watch": "vitest --project unit",
"test:visual": "vitest run --project storybook",
"test:all": "vitest run",
```

- [ ] **Step 2: Verify the storybook project runs with existing stories**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: The 3 existing story files (button, input, select) should run as tests. They may pass or fail — the important thing is that the storybook vitest project boots Chromium and processes `.stories.tsx` files.

If it errors on browser launch, check that `playwright` browsers are installed:
```bash
npx playwright install chromium
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test:visual and test:all npm scripts"
```

---

### Task 2: HPBar stories (simplest component — validates the pattern)

**Files:**
- Create: `src/components/shared/combat/HPBar.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/combat/HPBar.tsx` to confirm the props interface before writing.

The component has this interface:
```typescript
interface HPBarProps {
  current: number;
  max: number;
  temp?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

Create the story file:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HPBar } from './HPBar';

const meta: Meta<typeof HPBar> = {
  component: HPBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: { current: 40, max: 40, showLabel: true },
};

export const FullDark: Story = {
  ...Full,
  globals: { theme: 'dark' },
};

export const Half: Story = {
  args: { current: 20, max: 40, showLabel: true },
};

export const HalfDark: Story = {
  ...Half,
  globals: { theme: 'dark' },
};

export const Critical: Story = {
  args: { current: 8, max: 40, showLabel: true },
};

export const CriticalDark: Story = {
  ...Critical,
  globals: { theme: 'dark' },
};

export const WithTempHP: Story = {
  args: { current: 30, max: 40, temp: 10, showLabel: true },
};

export const WithTempHPDark: Story = {
  ...WithTempHP,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run the visual test for this story**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -30`

Expected: 8 stories render as tests and pass. No screenshot assertions yet — this validates the story renders correctly in Chromium.

If any story fails (missing import, render error), fix it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/combat/HPBar.stories.tsx
git commit -m "test: add HPBar visual stories (light + dark)"
```

---

### Task 3: ConditionBadge stories

**Files:**
- Create: `src/components/shared/combat/ConditionBadge.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/combat/ConditionBadge.tsx` to confirm the props interface.

The component has this interface:
```typescript
interface ConditionBadgeProps {
  name: string;
  stackCount?: number;
  sourceSpell?: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}
```

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ConditionBadge } from './ConditionBadge';

const meta: Meta<typeof ConditionBadge> = {
  component: ConditionBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: { name: 'Poisoned', onRemove: fn() },
};

export const BasicDark: Story = {
  ...Basic,
  globals: { theme: 'dark' },
};

export const WithStackCount: Story = {
  args: { name: 'Exhaustion', stackCount: 3, onRemove: fn() },
};

export const WithStackCountDark: Story = {
  ...WithStackCount,
  globals: { theme: 'dark' },
};

export const WithSourceSpell: Story = {
  args: { name: 'Frightened', sourceSpell: 'Fear', onRemove: fn() },
};

export const WithSourceSpellDark: Story = {
  ...WithSourceSpell,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All ConditionBadge stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/combat/ConditionBadge.stories.tsx
git commit -m "test: add ConditionBadge visual stories (light + dark)"
```

---

### Task 4: HitPointTracker stories

**Files:**
- Create: `src/components/shared/combat/HitPointTracker.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/combat/HitPointTracker.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { HitPointTracker } from './HitPointTracker';
import type { HitPoints } from '@/types/character';

const baseHitPoints: HitPoints = {
  current: 25,
  max: 40,
  temporary: 5,
  calculationMode: 'auto' as const,
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

const meta: Meta<typeof HitPointTracker> = {
  component: HitPointTracker,
  tags: ['autodocs'],
  args: {
    hitPoints: baseHitPoints,
    onApplyDamage: fn(),
    onApplyHealing: fn(),
    onAddTemporaryHP: fn(),
    onMakeDeathSave: fn(),
    onResetDeathSaves: fn(),
    onToggleCalculationMode: fn(),
    onUpdateHitPoints: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const HealthyDark: Story = {
  globals: { theme: 'dark' },
};

export const Dying: Story = {
  args: {
    hitPoints: {
      ...baseHitPoints,
      current: 0,
      temporary: 0,
    },
  },
};

export const DyingDark: Story = {
  ...Dying,
  globals: { theme: 'dark' },
};

export const Dead: Story = {
  args: {
    hitPoints: {
      ...baseHitPoints,
      current: 0,
      temporary: 0,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    },
  },
};

export const DeadDark: Story = {
  ...Dead,
  globals: { theme: 'dark' },
};

export const Stabilized: Story = {
  args: {
    hitPoints: {
      ...baseHitPoints,
      current: 0,
      temporary: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    },
  },
};

export const StabilizedDark: Story = {
  ...Stabilized,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactDark: Story = {
  ...Compact,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 12 HitPointTracker stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/combat/HitPointTracker.stories.tsx
git commit -m "test: add HitPointTracker visual stories (light + dark)"
```

---

### Task 5: SpellSlotTracker stories

**Files:**
- Create: `src/components/shared/spells/SpellSlotTracker.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/spells/SpellSlotTracker.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SpellSlotTracker } from './SpellSlotTracker';
import type { SpellSlots, PactMagic } from '@/types/character';

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

const allUsedSlots: SpellSlots = {
  1: { max: 4, used: 4 },
  2: { max: 3, used: 3 },
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

const meta: Meta<typeof SpellSlotTracker> = {
  component: SpellSlotTracker,
  tags: ['autodocs'],
  args: {
    spellSlots: mockSpellSlots,
    onSpellSlotChange: fn(),
    onResetSpellSlots: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedSlots: Story = {};

export const MixedSlotsDark: Story = {
  globals: { theme: 'dark' },
};

export const AllUsed: Story = {
  args: { spellSlots: allUsedSlots },
};

export const AllUsedDark: Story = {
  ...AllUsed,
  globals: { theme: 'dark' },
};

export const WithPactMagic: Story = {
  args: {
    pactMagic: mockPactMagic,
    onPactMagicChange: fn(),
    onResetPactMagic: fn(),
  },
};

export const WithPactMagicDark: Story = {
  ...WithPactMagic,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactDark: Story = {
  ...Compact,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 10 SpellSlotTracker stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/spells/SpellSlotTracker.stories.tsx
git commit -m "test: add SpellSlotTracker visual stories (light + dark)"
```

---

### Task 6: TraitTracker stories

**Files:**
- Create: `src/components/shared/character/TraitTracker.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/character/TraitTracker.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TraitTracker } from './TraitTracker';
import type { TrackableTrait } from '@/types/character';

const mockTraits: TrackableTrait[] = [
  {
    id: 't1',
    name: 'Action Surge',
    description: 'Take one additional action.',
    maxUses: 1,
    usedUses: 0,
    restType: 'short',
    source: 'Fighter',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 't2',
    name: 'Second Wind',
    description: 'Regain hit points equal to 1d10 + fighter level.',
    maxUses: 1,
    usedUses: 1,
    restType: 'short',
    source: 'Fighter',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 't3',
    name: 'Indomitable',
    description: 'Reroll a failed saving throw.',
    maxUses: 2,
    usedUses: 0,
    restType: 'long',
    source: 'Fighter',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const meta: Meta<typeof TraitTracker> = {
  component: TraitTracker,
  tags: ['autodocs'],
  args: {
    traits: mockTraits,
    onUseTrait: fn(),
    onDeleteTrait: fn(),
    onTraitClick: fn(),
    onResetTraits: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTraits: Story = {};

export const WithTraitsDark: Story = {
  globals: { theme: 'dark' },
};

export const Empty: Story = {
  args: { traits: [] },
};

export const EmptyDark: Story = {
  ...Empty,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactDark: Story = {
  ...Compact,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 8 TraitTracker stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/TraitTracker.stories.tsx
git commit -m "test: add TraitTracker visual stories (light + dark)"
```

---

### Task 7: CurrencyManager stories

**Files:**
- Create: `src/components/shared/character/CurrencyManager.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/character/CurrencyManager.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CurrencyManager } from './CurrencyManager';
import type { Currency } from '@/types/character';

const mockCurrency: Currency = {
  copper: 50,
  silver: 20,
  electrum: 5,
  gold: 100,
  platinum: 2,
};

const meta: Meta<typeof CurrencyManager> = {
  component: CurrencyManager,
  tags: ['autodocs'],
  args: {
    currency: mockCurrency,
    onAddCurrency: fn(),
    onSubtractCurrency: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCurrency: Story = {};

export const WithCurrencyDark: Story = {
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactDark: Story = {
  ...Compact,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 6 CurrencyManager stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/CurrencyManager.stories.tsx
git commit -m "test: add CurrencyManager visual stories (light + dark)"
```

---

### Task 8: XPTracker stories

**Files:**
- Create: `src/components/shared/character/XPTracker.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/character/XPTracker.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { XPTracker } from './XPTracker';

const meta: Meta<typeof XPTracker> = {
  component: XPTracker,
  tags: ['autodocs'],
  args: {
    currentXP: 10000,
    currentLevel: 5,
    onAddXP: fn(),
    onSetXP: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MidLevel: Story = {};

export const MidLevelDark: Story = {
  globals: { theme: 'dark' },
};

export const NearLevelUp: Story = {
  args: { currentXP: 13500 },
};

export const NearLevelUpDark: Story = {
  ...NearLevelUp,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 6 XPTracker stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/XPTracker.stories.tsx
git commit -m "test: add XPTracker visual stories (light + dark)"
```

---

### Task 9: InventoryManager stories

**Files:**
- Create: `src/components/shared/character/InventoryManager.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/character/InventoryManager.tsx` to confirm the full props interface. This component imports `useItemsData`, `useMagicItemsData`, and uses `DragDropList`. In Storybook, module mocking works via `beforeEach` in parameters or via Storybook's module mock API. Read the existing stories and the Storybook 10 docs for the correct pattern.

The simplest approach: use `parameters.moduleMock` or Storybook's `fn()` to mock at the meta level. If the component fails to render due to the hooks, you may need to create a wrapper component that passes the data as props instead.

Alternative: Storybook 10 supports `beforeEach` on the meta for setup. Try this pattern first:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { InventoryManager } from './InventoryManager';
import type { InventoryItem } from '@/types/character';

const mockItems: InventoryItem[] = [
  {
    id: 'i1', name: 'Rope', category: 'misc', quantity: 1,
    weight: 10, value: 100, location: 'Backpack', tags: [],
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'i2', name: 'Torch', category: 'consumable', quantity: 5,
    weight: 1, value: 1, location: 'Belt', tags: [],
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'i3', name: 'Health Potion', category: 'consumable', quantity: 2,
    weight: 0.5, value: 50, location: 'Backpack', tags: [],
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
];

const meta: Meta<typeof InventoryManager> = {
  component: InventoryManager,
  tags: ['autodocs'],
  args: {
    items: mockItems,
    onAddItem: fn(),
    onDeleteItem: fn(),
    onUpdateItem: fn(),
    onQuantityChange: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {};

export const WithItemsDark: Story = {
  globals: { theme: 'dark' },
};

export const Empty: Story = {
  args: { items: [] },
};

export const EmptyDark: Story = {
  ...Empty,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};
```

**Important:** If the component fails to render because `useItemsData` or `useMagicItemsData` makes fetch calls, you will need to mock those modules. In Storybook 10 with `@storybook/addon-vitest`, use the `beforeEach` hook on the meta to set up mocks, or use Storybook's `parameters.mockData` pattern. Read the Storybook docs and adapt as needed — the key is that all 6 stories render without error.

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 6 InventoryManager stories pass. If hooks cause errors, add mocking and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/InventoryManager.stories.tsx
git commit -m "test: add InventoryManager visual stories (light + dark)"
```

---

### Task 10: DiceRoller stories

**Files:**
- Create: `src/components/ui/game/DiceRoller.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/ui/game/DiceRoller.tsx` to confirm the full props interface. This component uses `useDiceRoller` which imports `@3d-dice/dice-box` (WebGL). The hook must be mocked since Chromium in headless mode may not support WebGL canvas for dice rendering.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { DiceRoller } from './DiceRoller';

const meta: Meta<typeof DiceRoller> = {
  component: DiceRoller,
  tags: ['autodocs'],
  args: {
    onRollResult: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const ReadyDark: Story = {
  globals: { theme: 'dark' },
};

export const CustomButtons: Story = {
  args: {
    quickButtons: [
      { label: 'Attack', notation: '1d20+5' },
      { label: 'Damage', notation: '2d6+3' },
      { label: 'Save', notation: '1d20+2' },
    ],
  },
};

export const CustomButtonsDark: Story = {
  ...CustomButtons,
  globals: { theme: 'dark' },
};
```

**Important:** If `useDiceRoller` fails due to WebGL, you'll need to mock it. In Storybook 10, you can use `beforeEach` on the meta or Storybook's module mocking. The mock should return `{ isInitialized: true, isRolling: false, rollHistory: [], roll: fn(), clearDice: fn(), clearHistory: fn(), setAutoClearDelay: fn(), autoClearDelay: 10000 }`. Adapt the mocking approach based on what the Storybook addon-vitest integration supports.

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 4 DiceRoller stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/game/DiceRoller.stories.tsx
git commit -m "test: add DiceRoller visual stories (light + dark)"
```

---

### Task 11: HeroicInspirationTracker stories

**Files:**
- Create: `src/components/shared/character/HeroicInspirationTracker.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/shared/character/HeroicInspirationTracker.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { HeroicInspirationTracker } from './HeroicInspirationTracker';
import type { HeroicInspiration } from '@/types/character';

const meta: Meta<typeof HeroicInspirationTracker> = {
  component: HeroicInspirationTracker,
  tags: ['autodocs'],
  args: {
    inspiration: { count: 2, maxCount: 5 },
    onAddInspiration: fn(),
    onUseInspiration: fn(),
    onResetInspiration: fn(),
    onUpdateMaxCount: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDice: Story = {};

export const WithDiceDark: Story = {
  globals: { theme: 'dark' },
};

export const Empty: Story = {
  args: { inspiration: { count: 0, maxCount: 5 } },
};

export const EmptyDark: Story = {
  ...Empty,
  globals: { theme: 'dark' },
};

export const AtMax: Story = {
  args: { inspiration: { count: 5, maxCount: 5 } },
};

export const AtMaxDark: Story = {
  ...AtMax,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 6 HeroicInspirationTracker stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/character/HeroicInspirationTracker.stories.tsx
git commit -m "test: add HeroicInspirationTracker visual stories (light + dark)"
```

---

### Task 12: CharacterHUD stories

**Files:**
- Create: `src/components/ui/character/CharacterHUD.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/ui/character/CharacterHUD.tsx` to confirm the full props interface. This component takes a full `CharacterState` object and imports calculation utilities. Use `makeCharacter()` from `src/utils/__tests__/test-utils.ts` for fixtures.

The component also uses `useClassData` internally — you may need to mock it. It also uses `calculateCharacterArmorClass`, `calculateModifier`, etc. from `@/utils/calculations` — these are pure functions and should work fine.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import CharacterHUD from './CharacterHUD';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const healthyCharacter = makeCharacter({
  hitPoints: { current: 35, max: 40, temporary: 5, calculationMode: 'auto' as const },
});

const lowHPCharacter = makeCharacter({
  hitPoints: { current: 5, max: 40, temporary: 0, calculationMode: 'auto' as const },
});

const withTempHPCharacter = makeCharacter({
  hitPoints: { current: 40, max: 40, temporary: 15, calculationMode: 'auto' as const },
});

const meta: Meta<typeof CharacterHUD> = {
  component: CharacterHUD,
  tags: ['autodocs'],
  args: {
    onShortRest: fn(),
    onLongRest: fn(),
    onIncrementDays: fn(),
    onDecrementDays: fn(),
    onToggleInspiration: fn(),
    onToggleReaction: fn(),
    onStopConcentration: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: { character: healthyCharacter },
};

export const HealthyDark: Story = {
  ...Healthy,
  globals: { theme: 'dark' },
};

export const LowHP: Story = {
  args: { character: lowHPCharacter },
};

export const LowHPDark: Story = {
  ...LowHP,
  globals: { theme: 'dark' },
};

export const WithTempHP: Story = {
  args: { character: withTempHPCharacter },
};

export const WithTempHPDark: Story = {
  ...WithTempHP,
  globals: { theme: 'dark' },
};
```

**Important:** If `useClassData` causes errors, mock it. The component may also import other hooks — read the component carefully and mock anything that makes network calls.

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 6 CharacterHUD stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/character/CharacterHUD.stories.tsx
git commit -m "test: add CharacterHUD visual stories (light + dark)"
```

---

### Task 13: EntityCard stories

**Files:**
- Create: `src/components/ui/encounter/EntityCard.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/ui/encounter/EntityCard.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { EntityCard } from './EntityCard';
import type { EncounterEntity } from '@/types/encounter';

const monsterEntity: EncounterEntity = {
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

const playerEntity: EncounterEntity = {
  id: 'e2',
  type: 'player',
  name: 'Elara Brightblade',
  initiative: 18,
  initiativeModifier: 3,
  currentHp: 35,
  maxHp: 45,
  tempHp: 5,
  armorClass: 18,
  conditions: [{ id: 'c1', name: 'Blessed', description: '+1d4 to attacks' }],
};

const callbacks = {
  onUpdate: fn(),
  onRemove: fn(),
  onDamage: fn(),
  onHeal: fn(),
  onAddCondition: fn(),
  onRemoveCondition: fn(),
  onUseAbility: fn(),
  onRestoreAbility: fn(),
  onUseLegendaryAction: fn(),
  onResetLegendaryActions: fn(),
  onSetConcentration: fn(),
  onSetInitiative: fn(),
};

const meta: Meta<typeof EntityCard> = {
  component: EntityCard,
  tags: ['autodocs'],
  args: {
    ...callbacks,
    isCurrentTurn: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Monster: Story = {
  args: { entity: monsterEntity },
};

export const MonsterDark: Story = {
  ...Monster,
  globals: { theme: 'dark' },
};

export const Player: Story = {
  args: { entity: playerEntity },
};

export const PlayerDark: Story = {
  ...Player,
  globals: { theme: 'dark' },
};

export const CurrentTurn: Story = {
  args: { entity: playerEntity, isCurrentTurn: true },
};

export const CurrentTurnDark: Story = {
  ...CurrentTurn,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 6 EntityCard stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/encounter/EntityCard.stories.tsx
git commit -m "test: add EntityCard visual stories (light + dark)"
```

---

### Task 14: PlayerSummaryCard stories

**Files:**
- Create: `src/components/ui/campaign/PlayerSummaryCard.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/ui/campaign/PlayerSummaryCard.tsx` to confirm the full props interface. This component uses `next/image` — Storybook's `@storybook/nextjs-vite` framework should handle the Next.js image component automatically, but verify.

The component takes `CampaignPlayerData` which contains a full `characterData: CharacterState`. Use `makeCharacter()` for the fixture.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlayerSummaryCard } from './PlayerSummaryCard';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';

const basePlayer: CampaignPlayerData = {
  playerId: 'p1',
  playerName: 'Alex',
  characterId: 'c1',
  characterName: 'Gandalf the Grey',
  characterData: makeCharacter({
    name: 'Gandalf the Grey',
    race: 'Human',
    hitPoints: { current: 30, max: 45, temporary: 0, calculationMode: 'auto' as const },
  }),
  lastSynced: new Date().toISOString(),
};

const meta: Meta<typeof PlayerSummaryCard> = {
  component: PlayerSummaryCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 350 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { player: basePlayer },
};

export const DefaultDark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const LowHP: Story = {
  args: {
    player: {
      ...basePlayer,
      characterData: makeCharacter({
        name: 'Gandalf the Grey',
        race: 'Human',
        hitPoints: { current: 5, max: 45, temporary: 0, calculationMode: 'auto' as const },
      }),
    },
  },
};

export const LowHPDark: Story = {
  ...LowHP,
  globals: { theme: 'dark' },
};
```

**Important:** Check if `PlayerSummaryCard` is a named or default export. Also verify `next/image` works in the Storybook context — `@storybook/nextjs-vite` should handle it, but if not, mock it the same way as in unit tests.

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 4 PlayerSummaryCard stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/campaign/PlayerSummaryCard.stories.tsx
git commit -m "test: add PlayerSummaryCard visual stories (light + dark)"
```

---

### Task 15: MonsterStatBlockPanel stories

**Files:**
- Create: `src/components/ui/encounter/MonsterStatBlockPanel.stories.tsx`

- [ ] **Step 1: Write the story file**

Read `src/components/ui/encounter/MonsterStatBlockPanel.tsx` to confirm the full props interface.

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { MonsterStatBlockPanel } from './MonsterStatBlockPanel';
import type { MonsterStatBlock } from '@/types/encounter';

const simpleStatBlock: MonsterStatBlock = {
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

const complexStatBlock: MonsterStatBlock = {
  str: 26, dex: 10, con: 24, int: 16, wis: 15, cha: 19,
  saves: 'Dex +6, Con +13, Wis +8, Cha +10', skills: 'Perception +14, Stealth +6',
  speed: '40 ft., fly 80 ft., swim 40 ft.',
  resistances: '', immunities: 'fire', vulnerabilities: '',
  conditionImmunities: ['charmed', 'frightened'],
  senses: 'blindsight 60 ft., darkvision 120 ft.', passivePerception: 24,
  traits: [
    { name: 'Legendary Resistance (3/Day)', text: 'If the dragon fails a saving throw, it can choose to succeed instead.' },
    { name: 'Amphibious', text: 'The dragon can breathe air and water.' },
  ],
  actions: [
    { name: 'Multiattack', text: 'The dragon makes three attacks: one with its bite and two with its claws.' },
    { name: 'Bite', text: 'Melee Weapon Attack: +14 to hit, 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus 9 (2d8) fire damage.' },
    { name: 'Fire Breath (Recharge 5-6)', text: 'The dragon exhales fire in a 60-foot cone. DC 21 Dexterity saving throw, 63 (18d6) fire damage on a failed save.' },
  ],
  reactions: [{ name: 'Tail Attack', text: 'When a creature the dragon can see within 10 feet hits it with a melee attack, the dragon makes a tail attack.' }],
  bonusActions: [], lairActions: [],
  cr: '17', type: 'dragon', size: 'Huge',
  languages: 'Common, Draconic', alignment: 'lawful evil', hpFormula: '17d12+119',
};

const meta: Meta<typeof MonsterStatBlockPanel> = {
  component: MonsterStatBlockPanel,
  tags: ['autodocs'],
  args: {
    onUpdate: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleMonster: Story = {
  args: { statBlock: simpleStatBlock },
};

export const SimpleMonsterDark: Story = {
  ...SimpleMonster,
  globals: { theme: 'dark' },
};

export const ComplexMonster: Story = {
  args: { statBlock: complexStatBlock },
};

export const ComplexMonsterDark: Story = {
  ...ComplexMonster,
  globals: { theme: 'dark' },
};
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -20`

Expected: All 4 MonsterStatBlockPanel stories pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/encounter/MonsterStatBlockPanel.stories.tsx
git commit -m "test: add MonsterStatBlockPanel visual stories (light + dark)"
```

---

### Task 16: Full suite verification

- [ ] **Step 1: Run all visual tests**

Run: `npm run test:visual -- --reporter=verbose 2>&1 | tail -30`

Expected: All stories pass across all 14 new story files + 3 existing story files.

- [ ] **Step 2: Run unit tests to verify no regressions**

Run: `npm run test -- --reporter=verbose 2>&1 | tail -10`

Expected: All 2,231 unit tests still pass.

- [ ] **Step 3: Run type checking**

Run: `npm run type-check 2>&1 | tail -10`

Expected: No new type errors.

- [ ] **Step 4: Count total stories**

Run: `grep -r "^export const" src/components/**/*.stories.tsx | wc -l`

Expected: ~92+ story exports across all story files.

- [ ] **Step 5: Fix any issues and commit**

If any test needed fixing:

```bash
git add -u
git commit -m "fix: resolve issues in Phase 5 visual story files"
```
