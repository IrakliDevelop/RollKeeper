import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { PlayerDetailDialog } from './PlayerDetailDialog';
import {
  makeCharacter,
  makeWizard,
  makeWarlock,
} from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';
import type { Spell } from '@/types/character';

function makeSpell(
  overrides: Partial<Spell> & Pick<Spell, 'name' | 'level'>
): Spell {
  return {
    id: `spell-${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test spell description.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptySlots = {
  1: { max: 0, used: 0 },
  2: { max: 0, used: 0 },
  3: { max: 0, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

const casterPlayer: CampaignPlayerData = {
  playerId: 'p1',
  playerName: 'Sam',
  characterId: 'c1',
  characterName: 'Aria the Wise',
  lastSynced: '2026-07-19T10:00:00.000Z',
  characterData: makeWizard({
    name: 'Aria the Wise',
    spells: [
      makeSpell({ name: 'Fire Bolt', level: 0 }),
      makeSpell({
        name: 'Shield',
        level: 1,
        isPrepared: true,
        school: 'Abjuration',
      }),
      makeSpell({ name: 'Magic Missile', level: 1, isPrepared: true }),
      makeSpell({
        name: 'Identify',
        level: 1,
        isPrepared: false,
        ritual: true,
        school: 'Divination',
      }),
      makeSpell({
        name: 'Misty Step',
        level: 2,
        isPrepared: true,
        school: 'Conjuration',
      }),
      makeSpell({
        name: 'Web',
        level: 2,
        isPrepared: false,
        concentration: true,
        school: 'Conjuration',
      }),
    ],
    spellSlots: {
      ...emptySlots,
      1: { max: 4, used: 1 },
      2: { max: 3, used: 2 },
    },
    weapons: [
      {
        id: 'w1',
        name: 'Quarterstaff',
        category: 'simple',
        weaponType: ['melee', 'versatile'],
        damage: [{ dice: '1d6', type: 'bludgeoning' }],
        enhancementBonus: 0,
        properties: ['versatile'],
        isEquipped: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }),
};

const warlockPlayer: CampaignPlayerData = {
  playerId: 'p2',
  playerName: 'Robin',
  characterId: 'c2',
  characterName: 'Vex',
  lastSynced: '2026-07-19T10:00:00.000Z',
  characterData: makeWarlock({
    name: 'Vex',
    spells: [
      makeSpell({ name: 'Eldritch Blast', level: 0 }),
      makeSpell({ name: 'Hex', level: 1, concentration: true }),
    ],
    spellSlots: emptySlots,
    pactMagic: { slots: { max: 2, used: 1 }, level: 3 },
  }),
};

const nonCasterPlayer: CampaignPlayerData = {
  playerId: 'p3',
  playerName: 'Alex',
  characterId: 'c3',
  characterName: 'Grunk',
  lastSynced: '2026-07-19T10:00:00.000Z',
  characterData: makeCharacter({
    name: 'Grunk',
    spells: [],
    spellSlots: emptySlots,
    weapons: [
      {
        id: 'w2',
        name: 'Greataxe',
        category: 'martial',
        weaponType: ['melee', 'heavy'],
        damage: [{ dice: '1d12', type: 'slashing' }],
        enhancementBonus: 0,
        properties: ['heavy', 'two-handed'],
        isEquipped: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }),
};

const meta: Meta<typeof PlayerDetailDialog> = {
  component: PlayerDetailDialog,
  args: {
    open: true,
    onOpenChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PlayerDetailDialog>;

// Dialog renders in a portal on document.body — query the whole document.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

export const Caster: Story = {
  args: { player: casterPlayer },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await waitFor(() =>
      expect(screen.getByText('Aria the Wise')).toBeInTheDocument()
    );
    await expect(screen.getByText('Skills')).toBeInTheDocument();
    await expect(screen.getByText('Weapons')).toBeInTheDocument();
    await expect(screen.getByText('Quarterstaff')).toBeInTheDocument();
    await expect(screen.getByText('Spell Slots')).toBeInTheDocument();
    // Level 1: 4 slots, 1 used → 3/4 remaining
    await expect(screen.getByText('3/4')).toBeInTheDocument();
    // Level 2: 3 slots, 2 used → 1/3 remaining
    await expect(screen.getByText('1/3')).toBeInTheDocument();
  },
};

export const Warlock: Story = {
  args: { player: warlockPlayer },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await waitFor(() => expect(screen.getByText('Vex')).toBeInTheDocument());
    await expect(screen.getByText('Skills')).toBeInTheDocument();
  },
};

export const NonCaster: Story = {
  args: { player: nonCasterPlayer },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await waitFor(() => expect(screen.getByText('Grunk')).toBeInTheDocument());
    await expect(screen.getByText('Skills')).toBeInTheDocument();
    await expect(screen.getByText('Greataxe')).toBeInTheDocument();
    // Non-caster: no spell slots section
    await expect(screen.queryByText('Spell Slots')).not.toBeInTheDocument();
  },
};
