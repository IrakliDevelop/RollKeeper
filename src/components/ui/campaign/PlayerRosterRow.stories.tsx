import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CharacterState } from '@/types/character';
import { PlayerRosterRow } from './PlayerRosterRow';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

function makePlayer(
  patch: Partial<CharacterState> = {},
  lastSynced = new Date().toISOString()
): CampaignPlayerData {
  return {
    playerId: 'player-1',
    playerName: 'Alice',
    characterId: 'char-1',
    characterName: 'Thorin',
    characterData: makeCharacter({
      name: 'Thorin',
      race: 'Dwarf',
      class: {
        name: 'Fighter',
        isCustom: false,
        spellcaster: 'none',
        hitDie: 10,
      },
      level: 5,
      totalLevel: 5,
      hitPoints: {
        current: 44,
        max: 44,
        temporary: 0,
        calculationMode: 'auto',
      },
      ...patch,
    }),
    lastSynced,
  };
}

const meta: Meta<typeof PlayerRosterRow> = {
  title: 'Campaign/PlayerRosterRow',
  component: PlayerRosterRow,
  tags: ['autodocs'],
  parameters: {
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  decorators: [
    Story => (
      <ul className="divide-divider max-w-3xl divide-y">
        <Story />
      </ul>
    ),
  ],
  args: {
    player: makePlayer(),
    onView: fn(),
    onAdjustCounter: fn(),
    onRemove: fn(),
    customCounterLabel: 'Desperation',
    counterValue: 2,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const Bloodied: Story = {
  args: {
    player: makePlayer({
      hitPoints: {
        current: 18,
        max: 44,
        temporary: 5,
        calculationMode: 'auto',
      },
      concentration: { isConcentrating: true, spellName: 'Bless' },
      conditionsAndDiseases: {
        activeConditions: [
          {
            id: 'c1',
            name: 'Exhaustion',
            source: 'XPHB',
            description: '',
            stackable: true,
            count: 2,
            appliedAt: '2026-11-04T00:00:00.000Z',
          },
        ],
        activeDiseases: [],
        exhaustionVariant: '2024',
      },
      heroicInspiration: { count: 3 },
    }),
  },
};

export const Down: Story = {
  args: {
    player: makePlayer(
      {
        hitPoints: {
          current: 0,
          max: 44,
          temporary: 0,
          calculationMode: 'auto',
        },
      },
      new Date(Date.now() - 5 * 60_000).toISOString()
    ),
  },
};

export const NoRaceNoClass: Story = {
  args: {
    player: makePlayer({
      race: '',
      class: { name: '', isCustom: false, spellcaster: 'none', hitDie: 8 },
    }),
  },
};

export const Phone: Story = {
  args: Bloodied.args,
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByTestId('player-row-player-1');
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    const restore = emulateCoarsePointer();
    try {
      for (const name of [
        'Remove 1 Desperation from Thorin',
        'Add 1 Desperation to Thorin',
        'Remove Thorin from campaign',
      ]) {
        const button = canvas.getByRole('button', { name });
        await expect(
          button.getBoundingClientRect().height
        ).toBeGreaterThanOrEqual(44);
      }
    } finally {
      restore();
    }
  },
};

export const PhoneDark: Story = {
  ...Phone,
  globals: { ...Phone.globals, theme: 'dark' },
};

export const BloodiedBlue: Story = {
  ...Bloodied,
  globals: { theme: 'blue' },
};
