import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import type { CampaignNPC, MonsterStatBlock } from '@/types/encounter';
import { NPCStatBlockExport } from './index';
import { StatBlockImage } from './StatBlockImage';

const STAMP = '2026-09-12T00:00:00.000Z';

const STAT_BLOCK: MonsterStatBlock = {
  str: 12,
  dex: 14,
  con: 13,
  int: 10,
  wis: 15,
  cha: 11,
  saves: 'Wis +4',
  skills: 'Insight +4, Perception +4',
  speed: '30 ft.',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  conditionImmunities: [],
  senses: 'passive Perception 14',
  passivePerception: 14,
  traits: [
    {
      id: 'trait-keen',
      name: 'Keen Ear',
      text: 'Advantage on Perception checks that rely on hearing.',
    },
  ],
  actions: [
    {
      id: 'act-mace',
      name: 'Mace',
      text: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage.',
    },
  ],
  reactions: [],
  bonusActions: [],
  lairActions: [],
  cr: '2',
  type: 'humanoid',
  size: 'Medium',
  languages: 'Common, Dwarvish',
  alignment: 'neutral good',
  hpFormula: '8d8 + 8',
};

const BRENN: CampaignNPC = {
  id: 'npc-1',
  campaignCode: 'K7QX2M',
  name: 'Brenn Ironhand',
  armorClass: '15',
  maxHp: 44,
  speed: '30 ft.',
  proficiencyBonus: 2,
  monsterStatBlock: STAT_BLOCK,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const meta: Meta<typeof NPCStatBlockExport> = {
  title: 'Campaign/NPCStatBlockExport',
  component: NPCStatBlockExport,
  args: { npc: BRENN },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Download image' })
    ).toBeVisible();
    // Chromium supports clipboard images, so Copy shows without a stub. It is
    // not clicked here: that would ask for clipboard permission.
    await expect(
      canvas.getByRole('button', { name: 'Copy image' })
    ).toBeVisible();
  },
};

/** The exported picture itself, rendered on screen for review. */
export const Image: Story = {
  render: args => (
    <div style={{ width: 900 }}>
      <StatBlockImage npc={args.npc} avatarDataUrl={null} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ['Armor class', 'Hit points', 'Initiative']) {
      await expect(canvas.getByText(label)).toBeVisible();
    }
  },
};
