import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';

import { CreatureDrawer } from '.';
import {
  FULL_CREATURE_STANDING,
  GOBLIN,
  LAIR,
  LEGENDARY_MONSTER,
  SUMMON,
} from './CreatureDrawer.fixtures';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

const actions: EntityActions = {
  onUpdate: fn(),
  onRemove: fn(),
  onDamage: fn(),
  onHeal: fn(),
  onAddTempHp: fn(),
  onSetMaxHp: fn(),
  onAddCondition: fn(),
  onRemoveCondition: fn(),
  onSetConditionRounds: fn(),
  onUseAbility: fn(),
  onUseInventoryEntry: fn(() => true),
  onRestoreAbility: fn(),
  onSpendResource: fn(() => true),
  onRestoreResource: fn(),
  onUseLegendaryAction: fn(),
  onResetLegendaryActions: fn(),
  onSetConcentration: fn(),
  onUseLairAction: fn(),
  onSetInitiative: fn(),
  onLongRest: fn(),
  onShortRest: fn(),
  onViewNPC: fn(),
};

function body() {
  // The drawer portals to document.body via Radix — query the whole document,
  // not the Storybook canvas element.
  return within(document.body);
}

async function expectDrawer(name: RegExp) {
  await waitFor(() =>
    expect(body().getByRole('dialog', { name })).toBeInTheDocument()
  );
}

/** The switch's ::after hit box, centred on the track. */
function switchHitBox(toggle: HTMLElement) {
  const box = toggle.getBoundingClientRect();
  const after = getComputedStyle(toggle, '::after');
  const width = parseFloat(after.width);
  const height = parseFloat(after.height);
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
    width,
    height,
  };
}

function intersects(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number }
) {
  return (
    Math.round(a.left) < Math.round(b.right) &&
    Math.round(b.left) < Math.round(a.right) &&
    Math.round(a.top) < Math.round(b.bottom) &&
    Math.round(b.top) < Math.round(a.bottom)
  );
}

const meta: Meta<typeof CreatureDrawer> = {
  title: 'DmVtt/CreatureDrawer',
  component: CreatureDrawer,
  args: {
    entity: LEGENDARY_MONSTER,
    actions,
    isTurn: false,
    onClose: fn(),
    onTokenIdentityChange: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof CreatureDrawer>;

/** Legendary monster on its turn — Play mode. */
export const Monster: Story = {
  args: { entity: LEGENDARY_MONSTER, isTurn: true },
  play: async () => {
    await expectDrawer(/young red dragon sheet/i);
    await expect(body().getByText('Their turn')).toBeInTheDocument();

    // Touch: the tabs reach 44px and the strip does not scroll.
    const drawer = body().getByRole('dialog');
    const restore = emulateCoarsePointer();
    try {
      for (const tab of within(drawer).getAllByRole('tab')) {
        await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(
          44
        );
      }
      // The 44px tabs fit the strip without it scrolling sideways.
      const tablist = within(drawer).getByRole('tablist');
      await expect(tablist.scrollWidth).toBeLessThanOrEqual(
        tablist.clientWidth
      );
    } finally {
      restore();
    }
  },
};

// Dark mode is the `theme` global (see `.storybook/preview.tsx`'s `withTheme`).
export const MonsterDark: Story = {
  args: { entity: LEGENDARY_MONSTER, isTurn: true },
  globals: { theme: 'dark' },
  play: async () => {
    await expectDrawer(/young red dragon sheet/i);
  },
};

export const Goblin: Story = {
  args: { entity: GOBLIN },
  play: async () => {
    await expectDrawer(/goblin sheet/i);
  },
};

/** Library NPC: eye button, resources, costed entries, spellcasting, hit dice. */
export const LibraryNpc: Story = {
  args: { entity: FULL_CREATURE_STANDING },
  play: async () => {
    await expectDrawer(/captain vex sheet/i);
    await expect(
      body().getByRole('button', { name: 'View Captain Vex in NPC library' })
    ).toBeInTheDocument();
  },
};

export const LibraryNpcDark: Story = {
  args: { entity: FULL_CREATURE_STANDING },
  globals: { theme: 'dark' },
  play: async () => {
    await expectDrawer(/captain vex sheet/i);
  },
};

/** Lair entity: reduced layout with a single Lair tab. */
export const Lair: Story = {
  args: { entity: LAIR },
  play: async () => {
    await expectDrawer(/dragon's lair sheet/i);
    await expect(body().getAllByRole('tab')).toHaveLength(1);
  },
};

/** Player summon: HP card without Damage/Heal (player-managed). */
export const Summon: Story = {
  args: { entity: SUMMON },
  play: async () => {
    await expectDrawer(/spirit wolf sheet/i);
    await expect(
      body().queryByRole('button', { name: /^damage$/i })
    ).not.toBeInTheDocument();
  },
};

/** Turns on Edit sheet: inputs appear and the banner shows. */
export const Editing: Story = {
  args: { entity: FULL_CREATURE_STANDING },
  play: async () => {
    await expectDrawer(/captain vex sheet/i);
    await userEvent.click(body().getByRole('switch', { name: 'Edit sheet' }));
    await expect(body().getByLabelText('Max HP')).toBeInTheDocument();
    await expect(
      body().getByText(/editing this combatant/i)
    ).toBeInTheDocument();
  },
};

/**
 * On a touch screen the Edit sheet switch reaches 44×44 and its hit box
 * touches neither Close nor any rest button.
 */
export const TouchTargets: Story = {
  args: { entity: FULL_CREATURE_STANDING },
  beforeEach: () => emulateCoarsePointer(),
  play: async () => {
    await expectDrawer(/captain vex sheet/i);
    const drawer = within(body().getByRole('dialog'));
    const area = switchHitBox(
      drawer.getByRole('switch', { name: 'Edit sheet' })
    );
    await expect(area.width).toBeGreaterThanOrEqual(44);
    await expect(area.height).toBeGreaterThanOrEqual(44);
    for (const name of [
      'Close sheet',
      'Short rest',
      'Long rest',
      'Remove Captain Vex from combat',
      'View Captain Vex in NPC library',
    ]) {
      const box = drawer.getByRole('button', { name }).getBoundingClientRect();
      await expect(intersects(area, box)).toBe(false);
    }
  },
};

export const EditingDark: Story = {
  ...Editing,
  globals: { theme: 'dark' },
};
