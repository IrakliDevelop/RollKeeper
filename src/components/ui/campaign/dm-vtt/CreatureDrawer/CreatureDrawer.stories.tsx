import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

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
      body().getByRole('button', { name: 'View NPC details' })
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

/** Clicks the lock into Editing mode: inputs appear and the banner shows. */
export const Editing: Story = {
  args: { entity: FULL_CREATURE_STANDING },
  play: async () => {
    await expectDrawer(/captain vex sheet/i);
    await userEvent.click(body().getByRole('button', { name: /^play$/i }));
    await expect(body().getByLabelText('Max HP')).toBeInTheDocument();
    await expect(
      body().getByText(/editing this combatant/i)
    ).toBeInTheDocument();
  },
};

export const EditingDark: Story = {
  ...Editing,
  globals: { theme: 'dark' },
};
