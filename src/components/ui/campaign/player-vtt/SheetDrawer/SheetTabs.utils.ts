import { DEBUFF_PALETTE } from '@/components/ui/encounter/combat-screen/effectPalettes';

import {
  calculateSavingThrowModifier,
  calculateSkillModifier,
  calculateTraitMaxUses,
  getCharacterTotalLevel,
} from '@/utils/calculations';
import {
  ABILITY_NAMES,
  SKILL_ABILITY_MAP,
  SKILL_NAMES,
} from '@/utils/constants';
import { resolveSheetFavorites } from '@/utils/sheetFavorites';

import { FEATURE_SOURCE_LABELS } from '@/types/character';
import type {
  AbilityName,
  CharacterState,
  FeatureSourceType,
  SkillName,
  Spell,
  SpellSlots,
} from '@/types/character';

import { buildInventoryGroups } from './InventoryTabs.utils';
import type {
  ConditionToggleView,
  FavoriteRowView,
  FeatureGroupView,
  FeatureRowView,
  OtherEffectsView,
  ProficiencyGroupView,
  SaveRowView,
  SkillProfLevel,
  SkillRowView,
  SpellGroupView,
  SpellRowView,
} from './SheetDrawer.types';

const SAVE_ORDER: AbilityName[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

const ORDINAL = [
  'Cantrips',
  '1st level',
  '2nd level',
  '3rd level',
  '4th level',
  '5th level',
  '6th level',
  '7th level',
  '8th level',
  '9th level',
];

const SOURCE_ORDER: FeatureSourceType[] = [
  'class',
  'race',
  'feat',
  'background',
  'magic-item',
  'other',
];

const EXHAUSTION_2014 = [
  'None',
  'Disadvantage on ability checks',
  'Disadvantage on ability checks; speed halved',
  'Disadvantage on ability checks, attacks and saves; speed halved',
  'Disadvantage on checks, attacks and saves; speed halved; HP max halved',
  'Disadvantage on checks, attacks and saves; speed 0; HP max halved',
  'Death',
];

export function buildSaveRows(c: CharacterState): SaveRowView[] {
  return SAVE_ORDER.map(ability => ({
    ability,
    name: ABILITY_NAMES[ability],
    modifier: calculateSavingThrowModifier(c, ability),
    proficient: c.savingThrows[ability]?.proficient ?? false,
  }));
}

export function buildSkillRows(c: CharacterState): SkillRowView[] {
  return (Object.keys(SKILL_NAMES) as SkillName[])
    .map(skill => {
      const s = c.skills[skill];
      const modifier = calculateSkillModifier(c, skill);
      const level: SkillProfLevel = s?.proficient ? (s.expertise ? 2 : 1) : 0;
      return {
        skill,
        name: SKILL_NAMES[skill],
        abilityAbbr: SKILL_ABILITY_MAP[skill].slice(0, 3).toUpperCase(),
        modifier,
        passive: 10 + modifier,
        level,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function nextSkillLevel(level: SkillProfLevel): SkillProfLevel {
  return level === 2 ? 0 : ((level + 1) as SkillProfLevel);
}

export function buildProficiencyGroups(
  c: CharacterState
): ProficiencyGroupView[] {
  const wp = c.weaponProficiencies;
  const weapons = [
    ...(wp?.simpleWeapons ? ['Simple weapons'] : []),
    ...(wp?.martialWeapons ? ['Martial weapons'] : []),
    ...(wp?.specificWeapons ?? []),
  ];
  const tools = (c.toolProficiencies ?? [])
    .filter(t => t.proficiencyLevel !== 'none')
    .map(t =>
      t.proficiencyLevel === 'expertise' ? `${t.name} (expertise)` : t.name
    );
  const languages = (c.languages ?? []).map(l => l.name);
  return [
    { label: 'Weapons', items: weapons },
    { label: 'Tools', items: tools },
    { label: 'Languages', items: languages },
  ].filter(g => g.items.length > 0);
}

export function hasSlotForSpell(c: CharacterState, spell: Spell): boolean {
  if (spell.level === 0 || spell.ritual) return true;
  if (
    (spell.freeCastMax ?? 0) > 0 &&
    (spell.freeCastsUsed ?? 0) < (spell.freeCastMax ?? 0)
  )
    return true;
  for (let l = spell.level; l <= 9; l++) {
    const slot = c.spellSlots?.[l as keyof SpellSlots];
    if (slot && slot.max - slot.used > 0) return true;
  }
  const pact = c.pactMagic;
  return (
    !!pact && pact.level >= spell.level && pact.slots.max - pact.slots.used > 0
  );
}

function isSpellCastable(c: CharacterState, spell: Spell): boolean {
  return (
    (spell.level === 0 || !!spell.isPrepared || !!spell.isAlwaysPrepared) &&
    hasSlotForSpell(c, spell)
  );
}

export function buildSpellGroups(
  c: CharacterState,
  query: string
): SpellGroupView[] {
  const q = query.trim().toLowerCase();
  const byLevel = new Map<number, SpellRowView[]>();
  for (const spell of c.spells ?? []) {
    if (q && !spell.name.toLowerCase().includes(q)) continue;
    const prepared = !!spell.isPrepared;
    const alwaysPrepared = !!spell.isAlwaysPrepared;
    const castable = isSpellCastable(c, spell);
    const rows = byLevel.get(spell.level) ?? [];
    rows.push({ spell, prepared, alwaysPrepared, castable });
    byLevel.set(spell.level, rows);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, spells]) => {
      const slot =
        level === 0
          ? null
          : (c.spellSlots?.[level as keyof SpellSlots] ?? null);
      return {
        level,
        label: ORDINAL[level] ?? `Level ${level}`,
        slot: slot && slot.max > 0 ? slot : null,
        spells: spells.sort((a, b) => a.spell.name.localeCompare(b.spell.name)),
      };
    });
}

function usesTag(
  maxUses: number,
  restType: 'short' | 'long',
  isPassive?: boolean
): string {
  if (maxUses > 0) return `${maxUses} / ${restType} rest`;
  return isPassive ? 'Passive' : '';
}

export function buildFeatureGroups(c: CharacterState): FeatureGroupView[] {
  const level = getCharacterTotalLevel(c);
  const features = c.extendedFeatures ?? [];
  const groups: FeatureGroupView[] = SOURCE_ORDER.map(source => ({
    key: source,
    label: FEATURE_SOURCE_LABELS[source],
    features: features
      .filter(f => f.sourceType === source)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((f): FeatureRowView => {
        const maxUses = calculateTraitMaxUses(f, level);
        return {
          id: f.id,
          kind: 'extended',
          name: f.name,
          tag: usesTag(maxUses, f.restType, f.isPassive),
          description: f.description ?? '',
          maxUses,
          usedUses: Math.min(f.usedUses, maxUses),
        };
      }),
  }));
  const featureIds = new Set(features.map(f => f.id));
  const traits = (c.trackableTraits ?? [])
    .filter(t => !featureIds.has(t.id))
    .map((t): FeatureRowView => {
      const maxUses = calculateTraitMaxUses(t, level);
      return {
        id: t.id,
        kind: 'trait',
        name: t.name,
        tag: usesTag(maxUses, t.restType, t.isPassive),
        description: t.description ?? '',
        maxUses,
        usedUses: Math.min(t.usedUses, maxUses),
      };
    });
  groups.push({ key: 'traits', label: 'Tracked traits', features: traits });
  return groups.filter(g => g.features.length > 0);
}

export function buildConditionToggles(
  c: CharacterState
): ConditionToggleView[] {
  const active = c.conditionsAndDiseases?.activeConditions ?? [];
  return DEBUFF_PALETTE.filter(e => e.name !== 'Exhaustion').map(e => ({
    name: e.name,
    activeId:
      active.find(a => a.name.toLowerCase() === e.name.toLowerCase())?.id ??
      null,
  }));
}

const STANDARD_CONDITION_NAMES = new Set(
  DEBUFF_PALETTE.filter(e => e.origin === 'official').map(e =>
    e.name.toLowerCase()
  )
);

/**
 * Active effects the condition toggles and exhaustion stepper don't cover:
 * buffs, custom/DM-library conditions, plus read-only diseases.
 */
export function buildOtherEffects(c: CharacterState): OtherEffectsView {
  const conditions = (c.conditionsAndDiseases?.activeConditions ?? [])
    .filter(a => !STANDARD_CONDITION_NAMES.has(a.name.toLowerCase()))
    .map(a => ({
      id: a.id,
      name: a.name,
      kind: a.kind ?? 'neutral',
      count: a.count,
      source: a.source,
    }));
  const diseases = (c.conditionsAndDiseases?.activeDiseases ?? []).map(d => ({
    id: d.id,
    name: d.name,
    source: d.source,
  }));
  return { conditions, diseases };
}

export function exhaustionRulesText(
  level: number,
  variant: '2014' | '2024'
): string {
  if (level <= 0) return 'None';
  if (level >= 6) return 'Death';
  if (variant === '2014') return EXHAUSTION_2014[level];
  return `−${2 * level} to d20 tests, −${5 * level} ft speed`;
}

/**
 * Pinned favorites for the Overview tab, in pin order. Item pins aren't
 * pruned when the underlying item is deleted (see `resolveSheetFavorites`),
 * so a dangling id here is simply skipped rather than resolved to a row.
 */
export function buildFavoriteRows(c: CharacterState): FavoriteRowView[] {
  const favorites = resolveSheetFavorites(c);
  if (favorites.length === 0) return [];

  const entriesById = new Map(
    buildInventoryGroups(c, '')
      .flatMap(g => g.entries)
      .map(entry => [entry.id, entry])
  );
  const spellsById = new Map((c.spells ?? []).map(spell => [spell.id, spell]));
  const featuresById = new Map(
    buildFeatureGroups(c).flatMap(g =>
      g.features.map(
        feature => [feature.id, { feature, group: g.label }] as const
      )
    )
  );

  const rows: FavoriteRowView[] = [];
  for (const favorite of favorites) {
    if (favorite.kind === 'item') {
      const entry = entriesById.get(favorite.id);
      if (!entry) continue;
      rows.push({
        key: `item:${favorite.id}`,
        kind: 'item',
        id: favorite.id,
        name: entry.name,
        meta: entry.meta,
        entry,
      });
    } else if (favorite.kind === 'spell') {
      const spell = spellsById.get(favorite.id);
      if (!spell) continue;
      rows.push({
        key: `spell:${favorite.id}`,
        kind: 'spell',
        id: favorite.id,
        name: spell.name,
        meta: `${spell.school} · ${spell.castingTime}`,
        spell,
        castable: isSpellCastable(c, spell),
      });
    } else {
      const match = featuresById.get(favorite.id);
      if (!match) continue;
      rows.push({
        key: `feature:${favorite.id}`,
        kind: 'feature',
        id: favorite.id,
        name: match.feature.name,
        meta: match.group,
        feature: match.feature,
      });
    }
  }
  return rows;
}
