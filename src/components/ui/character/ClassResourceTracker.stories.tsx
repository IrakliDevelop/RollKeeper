import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import ClassResourceTracker from './ClassResourceTracker';
import { getResourceDefinitionById } from '@/utils/classResources';
import { CharacterAbilities } from '@/types/character';

const abilities: CharacterAbilities = {
  strength: 10,
  dexterity: 14,
  constitution: 12,
  intelligence: 10,
  wisdom: 10,
  charisma: 16,
};

function activeResource(id: string, classLevel: number, usesExpended = 0) {
  const definition = getResourceDefinitionById(id)!;
  const maxUses = definition.getMaxUses({
    classLevel,
    abilities,
    proficiencyBonus: 2,
  });
  return {
    definition,
    classLevel,
    maxUses,
    die: definition.getDie?.(classLevel),
    usesExpended,
    usesRemaining: maxUses - usesExpended,
  };
}

const meta: Meta<typeof ClassResourceTracker> = {
  title: 'Character/ClassResourceTracker',
  component: ClassResourceTracker,
  args: {
    abilities,
    onUse: fn(),
    onRestore: fn(),
    onReset: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ClassResourceTracker>;

export const BardicInspiration: Story = {
  args: { resource: activeResource('bardic-inspiration', 5, 1) },
};

export const Rage: Story = {
  args: { resource: activeResource('rage', 3, 2) },
};

export const WildShape: Story = {
  args: { resource: activeResource('wild-shape', 6) },
};

export const ChannelDivinityCleric: Story = {
  args: { resource: activeResource('channel-divinity-cleric', 6, 1) },
};

export const FocusPointsPool: Story = {
  args: { resource: activeResource('focus-points', 11, 4) },
};

export const LayOnHandsBigPool: Story = {
  args: { resource: activeResource('lay-on-hands', 9, 12) },
};
