import type {
  AbilityName,
  CharacterState,
  SpellSlots,
} from '@/types/character';
import {
  calculateCharacterArmorClass,
  calculateModifier,
  calculatePassiveInsight,
  calculatePassiveInvestigation,
  calculatePassivePerception,
  calculateSavingThrowModifier,
  getProficiencyBonus,
} from '@/utils/calculations';
import { characterSubtitle } from '@/utils/characterSummary';
import { hpPercent } from '@/utils/hpState';

import type {
  AbilityCellView,
  HitDiceView,
  PassiveView,
  SheetHeaderView,
  SheetVitalsView,
  SlotSummaryView,
} from './SheetDrawer.types';

const ABILITIES: { ability: AbilityName; abbr: string; name: string }[] = [
  { ability: 'strength', abbr: 'STR', name: 'Strength' },
  { ability: 'dexterity', abbr: 'DEX', name: 'Dexterity' },
  { ability: 'constitution', abbr: 'CON', name: 'Constitution' },
  { ability: 'intelligence', abbr: 'INT', name: 'Intelligence' },
  { ability: 'wisdom', abbr: 'WIS', name: 'Wisdom' },
  { ability: 'charisma', abbr: 'CHA', name: 'Charisma' },
];

const ORDINAL = [
  '',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
];

function totalLevel(c: CharacterState): number {
  return c.totalLevel || c.level || 1;
}

export function buildHeaderView(c: CharacterState): SheetHeaderView {
  const active = c.conditionsAndDiseases?.activeConditions ?? [];
  const exhaustion = active.find(x => x.name.toLowerCase() === 'exhaustion');
  return {
    initial: c.name?.charAt(0)?.toUpperCase() || '?',
    avatar: c.avatar,
    name: c.name,
    level: totalLevel(c),
    subtitle: characterSubtitle(c),
    concentration: c.concentration?.isConcentrating
      ? (c.concentration.spellName ?? 'Concentrating')
      : null,
    conditions: active.filter(x => x !== exhaustion).map(x => x.name),
    exhaustion: exhaustion?.count ?? 0,
    inspired: (c.heroicInspiration?.count ?? 0) > 0,
  };
}

export function buildVitalsView(c: CharacterState): SheetVitalsView {
  const { current, max, temporary } = c.hitPoints;
  return {
    hpCurrent: current,
    hpMax: max,
    hpTemp: temporary,
    hpPercent: hpPercent(current, max),
    ac: calculateCharacterArmorClass(c),
    initiative: c.initiative.isOverridden
      ? c.initiative.value
      : calculateModifier(c.abilities.dexterity),
    speed: c.speed,
    proficiencyBonus: getProficiencyBonus(totalLevel(c)),
  };
}

export function buildAbilityCells(c: CharacterState): AbilityCellView[] {
  return ABILITIES.map(({ ability, abbr, name }) => ({
    ability,
    abbr,
    name,
    score: c.abilities[ability],
    modifier: calculateModifier(c.abilities[ability]),
    save: calculateSavingThrowModifier(c, ability),
    saveProficient: c.savingThrows[ability]?.proficient ?? false,
  }));
}

export function buildHitDice(c: CharacterState): HitDiceView[] {
  return Object.entries(c.hitDicePools ?? {}).map(([dieType, pool]) => ({
    dieType,
    remaining: Math.max(0, pool.max - pool.used),
    max: pool.max,
  }));
}

export function buildSlotSummary(c: CharacterState): SlotSummaryView[] {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9] as (keyof SpellSlots)[];
  const out: SlotSummaryView[] = levels
    .map(l => ({ l, slot: c.spellSlots?.[l] }))
    .filter(({ slot }) => slot && slot.max > 0)
    .map(({ l, slot }) => ({
      label: ORDINAL[l],
      remaining: Math.max(0, slot!.max - slot!.used),
      max: slot!.max,
    }));
  if (c.pactMagic && c.pactMagic.slots.max > 0) {
    out.push({
      label: `Pact ${ORDINAL[c.pactMagic.level]}`,
      remaining: Math.max(0, c.pactMagic.slots.max - c.pactMagic.slots.used),
      max: c.pactMagic.slots.max,
    });
  }
  return out;
}

export function buildPassives(c: CharacterState): PassiveView[] {
  return [
    { label: 'Perception', value: String(calculatePassivePerception(c)) },
    { label: 'Insight', value: String(calculatePassiveInsight(c)) },
    { label: 'Investigation', value: String(calculatePassiveInvestigation(c)) },
  ];
}
