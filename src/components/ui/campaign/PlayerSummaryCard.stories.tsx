import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PlayerSummaryCard } from './PlayerSummaryCard';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';

const basePlayer: CampaignPlayerData = {
  playerId: 'p1',
  playerName: 'Alice',
  characterId: 'c1',
  characterName: 'Lyra Moonwhisper',
  characterData: makeCharacter({
    name: 'Lyra Moonwhisper',
    race: 'Half-Elf',
    class: {
      name: 'Wizard',
      isCustom: false,
      spellcaster: 'full',
      hitDie: 6,
    },
    level: 7,
    hitPoints: { current: 32, max: 38, temporary: 0, calculationMode: 'auto' },
    armorClass: 13,
  }),
  lastSynced: new Date().toISOString(),
};

const playerWithoutAvatar: CampaignPlayerData = {
  ...basePlayer,
  characterData: makeCharacter({
    name: 'Grunk Stonefist',
    race: 'Dwarf',
    class: {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'none',
      hitDie: 10,
    },
    level: 5,
    hitPoints: { current: 44, max: 44, temporary: 0, calculationMode: 'auto' },
    armorClass: 18,
  }),
};

const meta: Meta<typeof PlayerSummaryCard> = {
  component: PlayerSummaryCard,
  tags: ['autodocs'],
  args: {
    player: basePlayer,
    onAdjustCounter: fn(),
    onClick: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAvatar: Story = {};

export const WithAvatarDark: Story = {
  globals: { theme: 'dark' },
};

export const WithoutAvatar: Story = {
  args: { player: playerWithoutAvatar },
};

export const WithoutAvatarDark: Story = {
  ...WithoutAvatar,
  globals: { theme: 'dark' },
};
