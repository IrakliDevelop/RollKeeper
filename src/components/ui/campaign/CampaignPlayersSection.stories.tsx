import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CharacterState } from '@/types/character';
import { CampaignPlayersSection } from './CampaignPlayersSection';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

function makePlayer(
  playerId: string,
  name: string,
  playerName: string,
  patch: Partial<CharacterState> = {}
): CampaignPlayerData {
  return {
    playerId,
    playerName,
    characterId: `char-${playerId}`,
    characterName: name,
    characterData: makeCharacter({
      id: `char-${playerId}`,
      name,
      ...patch,
    }),
    lastSynced: new Date().toISOString(),
  };
}

function hp(current: number, max: number, temporary = 0) {
  return { current, max, temporary, calculationMode: 'auto' as const };
}

const PLAYERS: CampaignPlayerData[] = [
  makePlayer('p1', 'Thorin', 'Alice', {
    race: 'Dwarf',
    hitPoints: hp(44, 44),
  }),
  makePlayer('p2', 'Lyra', 'Bob', {
    race: 'Elf',
    class: { name: 'Cleric', isCustom: false, spellcaster: 'full', hitDie: 8 },
    hitPoints: hp(18, 38, 5),
    concentration: { isConcentrating: true, spellName: 'Bless' },
  }),
  makePlayer('p3', 'Garrick', 'Cara', {
    race: 'Human',
    class: { name: 'Rogue', isCustom: false, spellcaster: 'none', hitDie: 8 },
    hitPoints: hp(5, 33),
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
  }),
  makePlayer('p4', 'Mirela', 'Dan', {
    race: 'Tiefling',
    class: {
      name: 'Warlock',
      isCustom: false,
      spellcaster: 'warlock',
      hitDie: 8,
    },
    hitPoints: hp(0, 31),
  }),
  makePlayer('p5', 'Bram', 'Eve', {
    race: 'Halfling',
    class: { name: 'Bard', isCustom: false, spellcaster: 'full', hitDie: 8 },
    hitPoints: hp(30, 35),
    heroicInspiration: { count: 3 },
  }),
];

const meta: Meta<typeof CampaignPlayersSection> = {
  title: 'Campaign/CampaignPlayersSection',
  component: CampaignPlayersSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  decorators: [
    Story => (
      <div className="p-4 sm:p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    code: 'K7QX2M',
    players: PLAYERS,
    loading: false,
    error: null,
    lastFetched: new Date(2026, 10, 4, 19, 4),
    onRefresh: fn(async () => {}),
    open: true,
    onOpenChange: fn(),
    customCounterLabel: 'Desperation',
    playerCounters: { p1: 1, p3: 2 },
    onAdjustCounter: fn(),
    onViewPlayer: fn(),
    onRemovePlayer: fn(),
    onMessageAll: fn(),
    onAwardXp: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Roster: Story = {
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Players (5)' })
    ).toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem').length).toBeGreaterThan(4);
  },
};

export const RosterPhone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole('heading', {
      level: 2,
      name: 'Players (5)',
    });
    const section = heading.closest('section') as HTMLElement;
    await expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
    for (const name of ['Message all', 'Award XP']) {
      const button = canvas.getByRole('button', { name });
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth
      );
    }
  },
};

export const RosterDark: Story = {
  ...Roster,
  globals: { ...Roster.globals, theme: 'dark' },
};

export const RosterBlue: Story = {
  ...Roster,
  globals: { ...Roster.globals, theme: 'blue' },
};

export const Empty: Story = {
  args: { players: [], lastFetched: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 3, name: 'Invite your players' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Copy code K7QX2M' })
    ).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { players: [], loading: true, lastFetched: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading players…')).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Players' })
    ).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: { error: 'TypeError: Failed to fetch' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', {
        level: 3,
        name: "Couldn't load the players",
      })
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Award XP' })
    ).not.toBeInTheDocument();
  },
};
