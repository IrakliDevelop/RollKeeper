import { useMemo } from 'react';

import { useEncounterStore } from '@/store/encounterStore';
import {
  EMPTY_CUSTOM_CONDITIONS,
  collectInflictableConditions,
  type CreatureCondition,
} from '@/utils/customConditions';

import {
  BUFF_PALETTE,
  DEBUFF_PALETTE,
  type EffectPaletteEntry,
} from '../effectPalettes';

import type { CustomCondition, EncounterEntity } from '@/types/encounter';

export type PaletteTab = 'conditions' | 'buffs';

// Module-level fallbacks: a fresh `[]` from a selector is a new snapshot every
// render and loops useSyncExternalStore.
const EMPTY_ENTITIES: EncounterEntity[] = [];

/** The DM library; persisted configs from before it existed lack the field. */
export function useConditionLibrary(): CustomCondition[] {
  return useEncounterStore(
    state => state.combatConfig.customConditions ?? EMPTY_CUSTOM_CONDITIONS
  );
}

/** Conditions any combatant in this entity's encounter can inflict. */
export function useCreatureConditions(
  entityId: string,
  library: CustomCondition[]
): CreatureCondition[] {
  const entities = useEncounterStore(state => {
    const owner = state.encounters.find(encounter =>
      encounter.entities.some(e => e.id === entityId)
    );
    return owner ? owner.entities : EMPTY_ENTITIES;
  });
  return useMemo(
    () => collectInflictableConditions(entities, library),
    [entities, library]
  );
}

/** Built-in palette for the tab plus the library entries of matching kind. */
export function buildEffectPalette(
  tab: PaletteTab,
  library: CustomCondition[],
  officialConditions: CustomCondition[] = [],
  spellEffects: EffectPaletteEntry[] = []
): EffectPaletteEntry[] {
  const base = tab === 'conditions' ? DEBUFF_PALETTE : BUFF_PALETTE;
  const officialByName = new Map(
    officialConditions.map(condition => [
      condition.name.toLowerCase(),
      condition,
    ])
  );
  const spellByName = new Map(
    spellEffects.map(effect => [effect.name.toLowerCase(), effect])
  );
  const hydratedBase = base.map(entry => {
    const condition = officialByName.get(entry.name.toLowerCase());
    if (condition) return { ...entry, condition };
    const spell = spellByName.get(entry.name.toLowerCase());
    return spell ? { ...entry, ...spell } : entry;
  });
  const taken = new Set(base.map(entry => entry.name.toLowerCase()));
  const extras = library
    .filter(c => (tab === 'buffs' ? c.kind === 'buff' : c.kind !== 'buff'))
    .filter(c => !taken.has(c.name.toLowerCase()))
    .map(c => ({ name: c.name, kind: c.kind, condition: c }));
  return [...hydratedBase, ...extras];
}
