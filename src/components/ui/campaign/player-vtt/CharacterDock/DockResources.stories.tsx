import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { DockResources } from './DockResources';
import { getResourceDefinitionById } from '@/utils/classResources';
import type { CharacterAbilities } from '@/types/character';

const abilities: CharacterAbilities = {
  strength: 16,
  dexterity: 14,
  constitution: 14,
  intelligence: 8,
  wisdom: 12,
  charisma: 10,
};

function activeResource(id: string, classLevel: number, usesExpended = 0) {
  const definition = getResourceDefinitionById(id)!;
  const ctx = { classLevel, abilities, proficiencyBonus: 2 };
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

const meta: Meta<typeof DockResources> = {
  title: 'Campaign/PlayerVtt/DockResources',
  component: DockResources,
  args: { onSpend: fn(), onRestore: fn() },
};
export default meta;

type Story = StoryObj<typeof DockResources>;

export const RageWithSpendAndRestore: Story = {
  args: { resources: [activeResource('rage', 3, 1)] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /spend rage/i }));
    await expect(args.onSpend).toHaveBeenCalledWith('rage');
    await userEvent.click(
      canvas.getByRole('button', { name: /restore rage/i })
    );
    await expect(args.onRestore).toHaveBeenCalledWith('rage');
  },
};

export const ExhaustedDisablesSpend: Story = {
  args: {
    resources: [
      (() => {
        const r = activeResource('rage', 3);
        return { ...r, usesExpended: r.maxUses, usesRemaining: 0 };
      })(),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: /spend rage/i })
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: /restore rage/i })
    ).toBeEnabled();
  },
};

export const FullDisablesRestore: Story = {
  args: { resources: [activeResource('bardic-inspiration', 5)] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: /restore bardic inspiration/i })
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: /spend bardic inspiration/i })
    ).toBeEnabled();
  },
};

export const EmptyRendersNothing: Story = {
  args: { resources: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('button')).toBeNull();
  },
};
