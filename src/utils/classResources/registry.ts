import { calculateModifier } from '@/utils/calculations';

import { ClassResourceDefinition } from './types';

// Per-level tables transcribed from json/class/*.json XPHB classTableGroups.
// Index = classLevel - 1.
const RAGE_TABLE = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6];
const CLERIC_CD_TABLE = [
  0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4,
];
const WILD_SHAPE_TABLE = [
  0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4,
];
const SECOND_WIND_TABLE = [
  2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
];
const PALADIN_CD_TABLE = [
  0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
];

const fromTable = (table: number[]) => (classLevel: number) =>
  table[Math.min(Math.max(classLevel, 1), 20) - 1];

const bardicDie = (classLevel: number): string => {
  if (classLevel >= 15) return 'd12';
  if (classLevel >= 10) return 'd10';
  if (classLevel >= 5) return 'd8';
  return 'd6';
};

const martialArtsDie = (classLevel: number): string => {
  if (classLevel >= 17) return 'd12';
  if (classLevel >= 11) return 'd10';
  if (classLevel >= 5) return 'd8';
  return 'd6';
};

const rageDamageBonus = (classLevel: number): number => {
  if (classLevel >= 16) return 4;
  if (classLevel >= 9) return 3;
  return 2;
};

export const CLASS_RESOURCE_DEFINITIONS: ClassResourceDefinition[] = [
  {
    id: 'rage',
    className: 'Barbarian',
    edition: 'XPHB',
    name: 'Rage',
    icon: 'flame',
    color: 'red',
    displayStyle: 'pips',
    minLevel: 1,
    getMaxUses: ctx => fromTable(RAGE_TABLE)(ctx.classLevel),
    getShortRestReset: () => 1,
    longRestReset: 'all',
    getDescription: ctx =>
      `Bonus Action · +${rageDamageBonus(ctx.classLevel)} melee damage · Resistance to B/P/S`,
  },
  {
    id: 'bardic-inspiration',
    className: 'Bard',
    edition: 'XPHB',
    name: 'Bardic Inspiration',
    icon: 'music',
    color: 'indigo',
    displayStyle: 'pips',
    minLevel: 1,
    getMaxUses: ctx => Math.max(1, calculateModifier(ctx.abilities.charisma)),
    getDie: bardicDie,
    // Font of Inspiration (Bard 5): all uses return on a Short Rest too.
    getShortRestReset: classLevel => (classLevel >= 5 ? 'all' : 0),
    longRestReset: 'all',
    getDescription: ctx =>
      `Bonus Action · 60ft · Target adds ${bardicDie(ctx.classLevel)} to a failed D20 Test`,
  },
  {
    id: 'channel-divinity-cleric',
    className: 'Cleric',
    edition: 'XPHB',
    name: 'Channel Divinity',
    icon: 'sun',
    color: 'amber',
    displayStyle: 'pips',
    minLevel: 2,
    getMaxUses: ctx => fromTable(CLERIC_CD_TABLE)(ctx.classLevel),
    getShortRestReset: () => 1,
    longRestReset: 'all',
    getDescription: () => 'Divine Spark · Turn Undead · subclass options',
  },
  {
    id: 'wild-shape',
    className: 'Druid',
    edition: 'XPHB',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    minLevel: 2,
    getMaxUses: ctx => fromTable(WILD_SHAPE_TABLE)(ctx.classLevel),
    getShortRestReset: () => 1,
    longRestReset: 'all',
    getDescription: () => 'Bonus Action · Transform into a Beast form',
  },
  {
    id: 'second-wind',
    className: 'Fighter',
    edition: 'XPHB',
    name: 'Second Wind',
    icon: 'wind',
    color: 'blue',
    displayStyle: 'pips',
    minLevel: 1,
    getMaxUses: ctx => fromTable(SECOND_WIND_TABLE)(ctx.classLevel),
    getShortRestReset: () => 1,
    longRestReset: 'all',
    getDescription: ctx => `Bonus Action · Regain 1d10 + ${ctx.classLevel} HP`,
  },
  {
    id: 'action-surge',
    className: 'Fighter',
    edition: 'XPHB',
    name: 'Action Surge',
    icon: 'zap',
    color: 'orange',
    displayStyle: 'pips',
    minLevel: 2,
    getMaxUses: ctx => (ctx.classLevel >= 17 ? 2 : 1),
    getShortRestReset: () => 'all',
    longRestReset: 'all',
    getDescription: () => 'Take one additional action on your turn',
  },
  {
    id: 'focus-points',
    className: 'Monk',
    edition: 'XPHB',
    name: 'Focus Points',
    icon: 'hand-fist',
    color: 'violet',
    displayStyle: 'pool',
    minLevel: 2,
    getMaxUses: ctx => (ctx.classLevel >= 2 ? Math.min(ctx.classLevel, 20) : 0),
    getShortRestReset: () => 'all',
    longRestReset: 'all',
    getDescription: ctx =>
      `Martial Arts ${martialArtsDie(ctx.classLevel)} · Flurry of Blows · Patient Defense · Step of the Wind`,
  },
  {
    id: 'channel-divinity-paladin',
    className: 'Paladin',
    edition: 'XPHB',
    name: 'Channel Divinity',
    icon: 'sparkles',
    color: 'yellow',
    displayStyle: 'pips',
    minLevel: 3,
    getMaxUses: ctx => fromTable(PALADIN_CD_TABLE)(ctx.classLevel),
    getShortRestReset: () => 1,
    longRestReset: 'all',
    getDescription: () => 'Divine Sense · subclass options',
  },
  {
    id: 'lay-on-hands',
    className: 'Paladin',
    edition: 'XPHB',
    name: 'Lay on Hands',
    icon: 'heart-handshake',
    color: 'green',
    displayStyle: 'pool',
    minLevel: 1,
    getMaxUses: ctx => 5 * Math.min(Math.max(ctx.classLevel, 1), 20),
    getShortRestReset: () => 0,
    longRestReset: 'all',
    getDescription: () =>
      'Bonus Action · Restore HP from pool · 5 points cures Poisoned',
  },
  {
    id: 'sorcery-points',
    className: 'Sorcerer',
    edition: 'XPHB',
    name: 'Sorcery Points',
    icon: 'wand-sparkles',
    color: 'purple',
    displayStyle: 'pool',
    minLevel: 2,
    getMaxUses: ctx => (ctx.classLevel >= 2 ? Math.min(ctx.classLevel, 20) : 0),
    getShortRestReset: () => 0,
    longRestReset: 'all',
    getDescription: () => 'Convert to spell slots · fuel Metamagic',
  },
  {
    id: 'arcane-recovery',
    className: 'Wizard',
    edition: 'XPHB',
    name: 'Arcane Recovery',
    icon: 'book-open',
    color: 'blue',
    displayStyle: 'pips',
    minLevel: 1,
    getMaxUses: () => 1,
    getShortRestReset: () => 0,
    longRestReset: 'all',
    getDescription: ctx =>
      `On a Short Rest, recover spell slots totaling ≤ ${Math.ceil(ctx.classLevel / 2)} levels (1/day)`,
  },
];

export function getResourceDefinitionById(
  id: string
): ClassResourceDefinition | undefined {
  return CLASS_RESOURCE_DEFINITIONS.find(d => d.id === id);
}
