import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import Skills from './Skills';

/**
 * The Stats tab skill list. Each row has a proficiency (P) and an expertise
 * (E) checkbox; on touch both grow to 44px hit areas that must not overlap.
 */
const meta: Meta<typeof Skills> = {
  title: 'Character/Skills',
  component: Skills,
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  args: {
    skills: {
      ...DEFAULT_CHARACTER_STATE.skills,
      athletics: { proficient: true, expertise: true },
      stealth: { proficient: true, expertise: false },
    },
    jackOfAllTrades: false,
    proficiencyBonus: 2,
    getSkillModifier: () => 2,
    onUpdateSkillProficiency: fn(),
    onUpdateSkillExpertise: fn(),
    onToggleJackOfAllTrades: fn(),
    onRollSkillCheck: fn(),
  },
  decorators: [
    Story => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const HIT_AREA = 44;

function centre(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export const ProficiencyPair: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const proficient = canvas.getAllByRole('checkbox', { name: 'Proficient' });
    const expertise = canvas.getAllByRole('checkbox', {
      name: 'Expertise (Double Proficiency)',
    });

    const restore = emulateCoarsePointer();
    try {
      // Same row: the P and E hit areas sit side by side.
      const p = centre(proficient[0]);
      const e = centre(expertise[0]);
      await expect(Math.abs(e.x - p.x)).toBeGreaterThanOrEqual(HIT_AREA);
      // Next row: the P hit areas stack without overlapping.
      const below = centre(proficient[1]);
      await expect(Math.abs(below.y - p.y)).toBeGreaterThanOrEqual(HIT_AREA);
      // The box itself keeps its size.
      await expect(proficient[0].getBoundingClientRect().width).toBe(16);
    } finally {
      restore();
    }
  },
};

export const ProficiencyPairDark: Story = {
  globals: { theme: 'dark' },
};
