import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CombatantDetail } from './CombatantDetail';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '../types';

const defaultActions: EntityActions = {
  onUpdate: fn(),
  onRemove: fn(),
  onDamage: fn(),
  onHeal: fn(),
  onAddTempHp: fn(),
  onSetMaxHp: fn(),
  onAddCondition: fn(),
  onRemoveCondition: fn(),
  onSetConditionRounds: fn(),
  onUseAbility: fn(),
  onRestoreAbility: fn(),
  onUseLegendaryAction: fn(),
  onResetLegendaryActions: fn(),
  onSetConcentration: fn(),
  onUseLairAction: fn(),
  onSetInitiative: fn(),
  onLongRest: fn(),
};

const dragonStatBlock: MonsterStatBlock = {
  str: 30,
  dex: 10,
  con: 29,
  int: 18,
  wis: 15,
  cha: 23,
  saves: 'Dex +6, Con +15, Wis +9, Cha +10',
  skills: 'Perception +16, Stealth +6',
  speed: '40 ft., fly 80 ft., swim 40 ft.',
  resistances: '',
  immunities: 'Fire',
  vulnerabilities: '',
  conditionImmunities: ['Frightened', 'Paralyzed'],
  senses: 'Blindsight 60 ft., Darkvision 120 ft.',
  passivePerception: 26,
  traits: [
    {
      name: 'Legendary Resistance (3/Day)',
      text: 'If the dragon fails a saving throw, it can choose to succeed instead.',
    },
    { name: 'Fire Immunity', text: 'The dragon is immune to fire damage.' },
  ],
  actions: [
    {
      name: 'Multiattack',
      text: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
    },
    {
      name: 'Bite',
      text: '<em>Melee Weapon Attack:</em> +17 to hit, reach 15 ft. <em>Hit:</em> 21 (2d10 + 10) piercing damage plus 14 (4d6) fire damage.',
    },
  ],
  bonusActions: [],
  reactions: [],
  lairActions: [],
  cr: '24',
  type: 'dragon',
  size: 'Gargantuan',
  languages: 'Common, Draconic',
  alignment: 'Chaotic Evil',
  hpFormula: '21d20+189',
};

const monsterEntity: EncounterEntity = {
  id: 'dragon-1',
  type: 'monster',
  name: 'Ancient Red Dragon',
  initiative: 22,
  initiativeModifier: 4,
  currentHp: 200,
  maxHp: 367,
  tempHp: 0,
  armorClass: 22,
  conditions: [
    { id: 'c1', name: 'Bless', kind: 'buff', rounds: null },
    { id: 'c2', name: 'Frightened', kind: 'debuff', rounds: 2 },
  ],
  monsterStatBlock: dragonStatBlock,
  legendaryActions: {
    maxActions: 3,
    usedActions: 1,
    actions: [
      {
        id: 'detect',
        name: 'Detect',
        cost: 1,
        description: 'Make a Perception check.',
      },
      {
        id: 'tail',
        name: 'Tail Attack',
        cost: 1,
        description: 'Make a tail attack.',
      },
      {
        id: 'wing',
        name: 'Wing Attack',
        cost: 2,
        description: 'Knock prone targets.',
      },
    ],
  },
  abilities: [
    {
      id: 'breath',
      name: 'Fire Breath',
      description: 'Exhale fire in a 90-foot cone.',
      usageType: 'recharge',
      rechargeOn: 5,
      maxUses: 1,
      usedUses: 0,
    },
  ],
};

const npcEntity: EncounterEntity = {
  id: 'npc-1',
  type: 'npc',
  name: 'City Guard Captain',
  initiative: 14,
  initiativeModifier: 1,
  currentHp: 0,
  maxHp: 52,
  tempHp: 0,
  armorClass: 16,
  conditions: [{ id: 'c1', name: 'Poisoned', kind: 'debuff', rounds: 3 }],
  deathSaves: { successes: 1, failures: 0, isStabilized: false },
  hitDice: { current: 5, max: 8, dieType: 'd8' },
  monsterStatBlock: {
    str: 16,
    dex: 12,
    con: 14,
    int: 11,
    wis: 13,
    cha: 10,
    saves: 'Str +5, Con +4',
    skills: 'Athletics +5, Perception +3',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: 'Passive Perception 13',
    passivePerception: 13,
    traits: [],
    actions: [
      { name: 'Longsword', text: 'Melee attack: +5 to hit, 1d8+3 slashing.' },
    ],
    bonusActions: [],
    reactions: [],
    lairActions: [],
    cr: '3',
    type: 'humanoid (human)',
    size: 'Medium',
    languages: 'Common',
    alignment: 'Lawful Good',
    hpFormula: '8d8+16',
  },
};

const playerEntity: EncounterEntity = {
  id: 'player-1',
  type: 'player',
  name: 'Lyra Moonwhisper',
  initiative: 18,
  initiativeModifier: 4,
  currentHp: 35,
  maxHp: 44,
  tempHp: 5,
  armorClass: 16,
  conditions: [{ id: 'c1', name: 'Inspired', kind: 'buff', rounds: null }],
  damageResistances: ['Psychic'],
  conditionImmunities: ['Charmed'],
  senses: [{ name: 'Darkvision', range: 60 }],
  playerCharacterId: 'char-1',
  monsterStatBlock: {
    str: 10,
    dex: 18,
    con: 14,
    int: 16,
    wis: 12,
    cha: 20,
    saves: 'Dex +7, Int +6, Wis +4',
    skills: 'Arcana +9, Perception +4, Stealth +10',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: ['Charmed'],
    senses: 'Darkvision 60 ft.',
    passivePerception: 14,
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    lairActions: [],
    cr: '',
    type: 'humanoid (elf)',
    size: 'Medium',
    languages: 'Common, Elvish, Draconic',
    alignment: 'Chaotic Good',
    hpFormula: '',
  },
};

const lairEntity: EncounterEntity = {
  id: 'lair-1',
  type: 'lair',
  name: "Dragon's Lair",
  initiative: 20,
  initiativeModifier: 0,
  currentHp: 0,
  maxHp: 0,
  tempHp: 0,
  armorClass: 0,
  conditions: [],
  lairActions: [
    {
      id: 'la1',
      name: 'Magma Fissure',
      description:
        'Cracks open the ground — each creature in a 20-ft line makes DC 18 Dex save or takes 14 (4d6) fire damage.',
      usedThisRound: false,
    },
    {
      id: 'la2',
      name: 'Volcanic Gas',
      description:
        'Noxious fumes fill a 20-ft radius sphere — DC 13 Con or Poisoned until end of next turn.',
      usedThisRound: true,
    },
  ],
  regionalEffects: [
    'Within 6 miles, water boils and kills fish.',
    'Volcanic gases cause plants to wilt 6 miles around.',
    'Smoke from vents obscures bright light.',
  ],
};

const meta: Meta<typeof CombatantDetail> = {
  title: 'Encounter/CombatantDetail',
  component: CombatantDetail,
  parameters: { layout: 'padded' },
  args: { actions: defaultActions },
};

export default meta;
type Story = StoryObj<typeof CombatantDetail>;

export const MonsterFullStatBlock: Story = {
  name: 'Monster — full stat block',
  args: { entity: monsterEntity },
};

export const NPCWithDeathSaves: Story = {
  name: 'NPC — hit dice + death saves',
  args: { entity: npcEntity },
};

export const PlayerSynced: Story = {
  name: 'Player — synced',
  args: { entity: playerEntity, onOpenSheet: fn() },
};

export const LairEntity: Story = {
  name: 'Lair — actions + regional effects',
  args: { entity: lairEntity },
};

export const EditStatBlockActions: Story = {
  name: 'Monster — edit actions & traits',
  args: {
    entity: monsterEntity,
    actions: { ...defaultActions, onUpdate: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: /edit actions & traits/i })
    );
    const nameInputs = canvas.getAllByLabelText(/entry name/i);
    await userEvent.type(nameInputs[0], '!');
    await expect(args.actions.onUpdate).toHaveBeenCalled();
    const [entityId, updates] = (args.actions.onUpdate as ReturnType<typeof fn>)
      .mock.lastCall!;
    await expect(entityId).toBe(args.entity.id);
    await expect(
      (updates as Partial<EncounterEntity>).monsterStatBlock
    ).toBeDefined();
  },
};
