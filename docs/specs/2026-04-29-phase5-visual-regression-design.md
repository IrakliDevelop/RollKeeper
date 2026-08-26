# Phase 5: Visual Regression Tests — Design Spec

## Goal

Add Storybook stories with screenshot baselines for ~14 critical components, capturing both light and dark themes. Catches CSS/layout regressions that interaction tests miss. Expected output: ~60-80 stories, ~120-160 screenshot baselines (~3-5 MB committed to git).

## Architecture

Each target component gets a `.stories.tsx` file alongside it. Stories render the component in isolation with various visual states (default, readonly, compact, empty, edge cases). Every story gets a dark-mode variant via Storybook's `globals: { theme: 'dark' }` mechanism — the existing `preview.tsx` decorator handles `data-theme` attribute toggling.

Screenshots are captured via Vitest Browser's `expect.element(locator).toMatchScreenshot()` inside each story's `play` function. Baselines are stored in `__screenshots__/` directories next to the story files and committed to git. Pixel comparison uses `pixelmatch` with a 1% mismatch threshold to absorb anti-aliasing differences.

The existing `storybook` vitest project (Chromium via `@vitest/browser-playwright`) runs stories as tests. A new `test:visual` npm script runs only the storybook project. The default `npm run test` continues to run unit tests only.

## Screenshot API

```typescript
import { expect } from '@storybook/test';

// Inside play function:
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  // Wait for content
  await canvas.findByText('Hit Points');
  // Capture screenshot
  await expect(document.querySelector('.sb-main-padded') ?? canvasElement)
    .toMatchScreenshot({ failureThreshold: 0.01, failureThresholdType: 'percent' });
}
```

## Dark Mode Variants

Each story gets a dark twin using Storybook globals:

```typescript
export const Default: Story = {
  args: { /* ... */ },
  play: screenshotPlay,
};

export const DefaultDark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};
```

The `preview.tsx` decorator already reads `context.globals.theme` and sets `data-theme` on `document.documentElement`, so this works automatically.

## Target Components (~14)

### From Tier 2 deep-tested (8)

| Component | Stories (light + dark = 2x) | Key visual states |
|---|---|---|
| HitPointTracker | 6 states x 2 = 12 | healthy, dying (death saves visible), dead, stabilized, readonly, compact |
| SpellSlotTracker | 5 states x 2 = 10 | mixed slots, all used, with pact magic, readonly, compact |
| TraitTracker | 4 states x 2 = 8 | with traits, empty, search active, readonly |
| CurrencyManager | 3 states x 2 = 6 | with currency, readonly, compact |
| XPTracker | 3 states x 2 = 6 | mid-level, near level-up, readonly |
| InventoryManager | 3 states x 2 = 6 | with items, empty, readonly |
| DiceRoller | 2 states x 2 = 4 | ready, custom buttons |
| HeroicInspirationTracker | 3 states x 2 = 6 | with dice, empty, at max |

### High-visual-risk additions (6)

| Component | Stories (light + dark = 2x) | Key visual states |
|---|---|---|
| CharacterHUD | 3 states x 2 = 6 | healthy, low HP, with temp HP |
| HPBar | 4 states x 2 = 8 | full, half, critical (< 25%), with temp HP |
| EntityCard | 3 states x 2 = 6 | monster, player, current turn highlight |
| PlayerSummaryCard | 2 states x 2 = 4 | with avatar, without avatar |
| MonsterStatBlockPanel | 2 states x 2 = 4 | simple monster, complex monster (legendary) |
| ConditionBadge | 3 states x 2 = 6 | basic, with stack count, with source spell |

**Totals: ~46 base stories x 2 themes = ~92 screenshots**

## Mocking Requirements

Same mocks as Phase 4 interaction tests:
- `next/image` — for CharacterHUD, PlayerSummaryCard (strip `fill`/`priority` props)
- `useDiceRoller` — for DiceRoller (WebGL hook)
- `useItemsData` + `useMagicItemsData` + `DragDropList` — for InventoryManager
- `useClassData` — for CharacterHUD

Storybook mocks go in story-level `parameters.moduleMocks` or top-level `vi.mock()` in story files, depending on what the addon-vitest integration supports. Read the Storybook 10 docs for the correct mock pattern — it may differ from the vitest unit project approach.

## Story File Pattern

```typescript
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { within } from 'storybook/test';
import { HitPointTracker } from './HitPointTracker';
import type { HitPoints } from '@/types/character';

const screenshotPlay = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByText('Hit Points');
  // toMatchScreenshot on the story root
};

const baseHitPoints: HitPoints = {
  current: 25, max: 40, temporary: 5,
  calculationMode: 'auto',
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

const meta: Meta<typeof HitPointTracker> = {
  component: HitPointTracker,
  tags: ['autodocs'],
  args: {
    hitPoints: baseHitPoints,
    onApplyDamage: () => {},
    onApplyHealing: () => {},
    // ...callbacks
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = { play: screenshotPlay };
export const HealthyDark: Story = { ...Healthy, globals: { theme: 'dark' } };

export const Dying: Story = {
  args: {
    hitPoints: { ...baseHitPoints, current: 0 },
  },
  play: screenshotPlay,
};
export const DyingDark: Story = { ...Dying, globals: { theme: 'dark' } };
```

## File Locations

Stories alongside components:
```
src/components/shared/combat/HitPointTracker.stories.tsx
src/components/shared/combat/__screenshots__/   (auto-generated)
src/components/shared/spells/SpellSlotTracker.stories.tsx
src/components/shared/character/TraitTracker.stories.tsx
src/components/shared/character/CurrencyManager.stories.tsx
src/components/shared/character/XPTracker.stories.tsx
src/components/shared/character/InventoryManager.stories.tsx
src/components/shared/character/HeroicInspirationTracker.stories.tsx
src/components/ui/game/DiceRoller.stories.tsx
src/components/ui/character/CharacterHUD.stories.tsx
src/components/shared/combat/HPBar.stories.tsx
src/components/ui/encounter/EntityCard.stories.tsx
src/components/ui/campaign/PlayerSummaryCard.stories.tsx
src/components/ui/encounter/MonsterStatBlockPanel.stories.tsx
src/components/shared/combat/ConditionBadge.stories.tsx
```

## npm Scripts

```json
{
  "test": "vitest --project unit",
  "test:visual": "vitest --project storybook",
  "test:all": "vitest"
}
```

## Expected Outcome

- 14 story files with ~46 base stories + ~46 dark variants = ~92 stories total
- ~92 screenshot baselines in `__screenshots__/` directories
- New `test:visual` and `test:all` npm scripts
- Grand total: 2,231 unit tests + ~92 visual tests = ~2,323 tests
