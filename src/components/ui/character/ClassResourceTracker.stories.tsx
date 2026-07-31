import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

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
  const ctx = {
    classLevel,
    abilities,
    proficiencyBonus: 2,
  };
  const maxUses = definition.getMaxUses(ctx);
  return {
    definition,
    classLevel,
    maxUses,
    die: definition.getDie?.(classLevel),
    usesExpended,
    usesRemaining: maxUses - usesExpended,
    description: definition.getDescription?.(ctx),
  };
}

const meta: Meta<typeof ClassResourceTracker> = {
  title: 'Character/ClassResourceTracker',
  component: ClassResourceTracker,
  tags: ['autodocs'],
  args: {
    onUse: fn(),
    onRestore: fn(),
    onReset: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ClassResourceTracker>;

export const BardicInspiration: Story = {
  args: { resource: activeResource('bardic-inspiration', 5, 1) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const id = args.resource.definition.id;

    await userEvent.click(canvas.getAllByTitle('Click to expend')[0]);
    await expect(args.onUse).toHaveBeenCalledWith(id, 1);

    await userEvent.click(canvas.getByTitle('Click to restore'));
    await expect(args.onRestore).toHaveBeenCalledWith(id, 1);

    await userEvent.click(canvas.getByTitle('Reset (Long Rest)'));
    await expect(args.onReset).toHaveBeenCalledWith(id);
  },
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
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const id = args.resource.definition.id;

    await userEvent.click(canvas.getByTitle('Spend 1'));
    await expect(args.onUse).toHaveBeenCalledWith(id, 1);

    await userEvent.click(canvas.getByTitle('Restore 1'));
    await expect(args.onRestore).toHaveBeenCalledWith(id, 1);
  },
};

export const LayOnHandsBigPool: Story = {
  args: { resource: activeResource('lay-on-hands', 9, 12) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const id = args.resource.definition.id;

    await userEvent.click(canvas.getByTitle('Spend 5'));
    await expect(args.onUse).toHaveBeenCalledWith(id, 5);

    await userEvent.click(canvas.getByTitle('Restore 5'));
    await expect(args.onRestore).toHaveBeenCalledWith(id, 5);
  },
};

export const LayOnHandsAtFloor: Story = {
  args: {
    resource: (() => {
      const resource = activeResource('lay-on-hands', 9, 0);
      return { ...resource, usesExpended: resource.maxUses, usesRemaining: 0 };
    })(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTitle('Spend 1')).toBeDisabled();
    await expect(canvas.getByTitle('Spend 5')).toBeDisabled();
  },
};

export const LayOnHandsAtCeiling: Story = {
  args: { resource: activeResource('lay-on-hands', 9, 0) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTitle('Restore 1')).toBeDisabled();
    await expect(canvas.getByTitle('Restore 5')).toBeDisabled();
  },
};
