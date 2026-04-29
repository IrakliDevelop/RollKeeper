import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { MonsterStatBlockPanel } from './MonsterStatBlockPanel';
import type { MonsterStatBlock } from '@/types/encounter';

const simpleMonster: MonsterStatBlock = {
  str: 16,
  dex: 12,
  con: 13,
  int: 7,
  wis: 11,
  cha: 10,
  saves: '',
  skills: '',
  speed: '40 ft.',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  conditionImmunities: [],
  senses: 'darkvision 60 ft.',
  passivePerception: 10,
  traits: [
    {
      name: 'Aggressive',
      text: 'As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.',
    },
  ],
  actions: [
    {
      name: 'Greataxe',
      text: '<em>Melee Weapon Attack:</em> +5 to hit, reach 5 ft., one target. <em>Hit:</em> 9 (1d12 + 3) slashing damage.',
    },
    {
      name: 'Javelin',
      text: '<em>Melee or Ranged Weapon Attack:</em> +5 to hit, reach 5 ft. or range 30/120 ft., one target. <em>Hit:</em> 6 (1d6 + 3) piercing damage.',
    },
  ],
  reactions: [],
  bonusActions: [],
  lairActions: [],
  cr: '1/2',
  type: 'Humanoid (orc)',
  size: 'Medium',
  languages: 'Common, Orc',
  alignment: 'chaotic evil',
  hpFormula: '2d8+2',
};

const legendaryMonster: MonsterStatBlock = {
  str: 27,
  dex: 14,
  con: 25,
  int: 16,
  wis: 15,
  cha: 19,
  saves: 'Dex +9, Con +14, Wis +9, Cha +11',
  skills: 'Perception +16, Stealth +9',
  speed: '40 ft., fly 80 ft., swim 40 ft.',
  resistances: '',
  immunities: 'fire',
  vulnerabilities: '',
  conditionImmunities: ['frightened'],
  senses: 'blindsight 60 ft., darkvision 120 ft.',
  passivePerception: 26,
  traits: [
    {
      name: 'Legendary Resistance (3/Day)',
      text: 'If the dragon fails a saving throw, it can choose to succeed instead.',
      uses: 3,
    },
    {
      name: 'Frightful Presence',
      text: "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 19 Wisdom saving throw or become frightened for 1 minute.",
    },
  ],
  actions: [
    {
      name: 'Multiattack',
      text: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
    },
    {
      name: 'Bite',
      text: '<em>Melee Weapon Attack:</em> +15 to hit, reach 15 ft., one target. <em>Hit:</em> 19 (2d10 + 8) piercing damage plus 9 (2d8) fire damage.',
    },
    {
      name: 'Fire Breath (Recharge 5-6)',
      text: 'The dragon exhales fire in a 90-foot cone. Each creature in that area must make a DC 22 Dexterity saving throw, taking 71 (13d10) fire damage on a failed save, or half as much on a successful one.',
    },
  ],
  reactions: [
    {
      name: 'Tail Attack',
      text: 'The dragon makes a tail attack against a creature within 15 feet.',
    },
  ],
  bonusActions: [],
  lairActions: [
    {
      name: 'Magma Eruption',
      text: 'Magma erupts from a point on the ground the dragon can see within 120 feet of it, creating a 20-foot-high, 5-foot-radius geyser.',
    },
  ],
  cr: '22',
  type: 'Dragon',
  size: 'Gargantuan',
  languages: 'Common, Draconic',
  alignment: 'chaotic evil',
  hpFormula: '21d20+147',
};

const meta: Meta<typeof MonsterStatBlockPanel> = {
  component: MonsterStatBlockPanel,
  tags: ['autodocs'],
  args: {
    onUpdate: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleMonster: Story = {
  args: { statBlock: simpleMonster },
};

export const SimpleMonsterDark: Story = {
  ...SimpleMonster,
  globals: { theme: 'dark' },
};

export const LegendaryMonster: Story = {
  args: { statBlock: legendaryMonster },
};

export const LegendaryMonsterDark: Story = {
  ...LegendaryMonster,
  globals: { theme: 'dark' },
};
