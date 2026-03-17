import {
  EncounterEntity,
  EncounterCondition,
  Encounter,
} from '@/types/encounter';
import type { Summon } from '@/types/summon';
import { CampaignPlayerData } from '@/types/campaign';
import { calculateCharacterArmorClass } from '@/utils/calculations';

/**
 * Merge live player data from campaign sync into an encounter entity.
 * Preserves DM-added conditions while replacing player-synced ones.
 */
export function mergePlayerSyncData(
  entity: EncounterEntity,
  playerData: CampaignPlayerData
): Partial<EncounterEntity> | null {
  const char = playerData.characterData;
  if (!char) return null;

  const currentHp = char.hitPoints?.current ?? entity.currentHp;
  const maxHp = char.hitPoints?.max ?? entity.maxHp;
  const tempHp = char.hitPoints?.temporary ?? entity.tempHp;
  const armorClass = calculateCharacterArmorClass(char);

  const concentrationSpell =
    char.concentration?.isConcentrating && char.concentration?.spellName
      ? char.concentration.spellName
      : undefined;

  const inspirationCount = char.heroicInspiration?.count ?? 0;
  const hasUsedReaction = char.reaction?.hasUsedReaction ?? false;
  const dex = char.abilities?.dexterity ?? 10;
  const initiativeModifier = Math.floor((dex - 10) / 2);

  // Death saving throws (only present when at 0 HP)
  const deathSaves = char.hitPoints?.deathSaves
    ? {
        successes: char.hitPoints.deathSaves.successes,
        failures: char.hitPoints.deathSaves.failures,
        isStabilized: char.hitPoints.deathSaves.isStabilized,
      }
    : undefined;

  // Build player-synced conditions from character data,
  // filtering out any the DM has explicitly suppressed (removed).
  const suppressed = new Set(entity.suppressedConditions ?? []);

  const playerConditions: EncounterCondition[] = (
    char.conditionsAndDiseases?.activeConditions ?? []
  )
    .filter(c => !suppressed.has(c.name))
    .map(c => ({
      id: `psync-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: c.name,
      description: c.description,
      source: 'player-sync' as const,
    }));

  // Clean up stale suppressions: if the player no longer has a condition,
  // no need to keep suppressing it.
  const playerConditionNames = new Set(
    (char.conditionsAndDiseases?.activeConditions ?? []).map(c => c.name)
  );
  const updatedSuppressed = [...suppressed].filter(name =>
    playerConditionNames.has(name)
  );

  // Preserve DM-added conditions
  const dmConditions = entity.conditions.filter(c => c.source === 'dm');

  // Merge: DM conditions + player-synced conditions (deduplicated by name)
  const mergedPlayerNames = new Set(playerConditions.map(c => c.name));
  const uniqueDmConditions = dmConditions.filter(
    c => !mergedPlayerNames.has(c.name)
  );
  const mergedConditions = [...uniqueDmConditions, ...playerConditions];

  const damageResistances = char.damageResistances ?? [];
  const damageImmunities = char.damageImmunities ?? [];
  const conditionImmunities = char.conditionImmunities ?? [];
  const senses = (char.senses ?? []).map(s => ({
    name: s.name,
    range: s.range,
    source: s.source,
  }));

  return {
    currentHp,
    maxHp,
    tempHp,
    armorClass,
    initiativeModifier,
    concentrationSpell,
    inspirationCount,
    hasUsedReaction,
    deathSaves,
    conditions: mergedConditions,
    suppressedConditions:
      updatedSuppressed.length > 0 ? updatedSuppressed : undefined,
    damageResistances:
      damageResistances.length > 0 ? damageResistances : undefined,
    damageImmunities:
      damageImmunities.length > 0 ? damageImmunities : undefined,
    conditionImmunities:
      conditionImmunities.length > 0 ? conditionImmunities : undefined,
    senses: senses.length > 0 ? senses : undefined,
  };
}

/**
 * Check if any player-synced fields have changed to avoid unnecessary updates.
 */
export function hasPlayerDataChanged(
  entity: EncounterEntity,
  updates: Partial<EncounterEntity>
): boolean {
  if (updates.currentHp !== entity.currentHp) return true;
  if (updates.maxHp !== entity.maxHp) return true;
  if (updates.tempHp !== entity.tempHp) return true;
  if (updates.armorClass !== entity.armorClass) return true;
  if (
    updates.initiativeModifier !== undefined &&
    updates.initiativeModifier !== entity.initiativeModifier
  )
    return true;
  if (updates.concentrationSpell !== entity.concentrationSpell) return true;
  if (updates.inspirationCount !== entity.inspirationCount) return true;
  if (updates.hasUsedReaction !== entity.hasUsedReaction) return true;

  // Compare death saves
  if (updates.deathSaves !== undefined || entity.deathSaves !== undefined) {
    const uDs = updates.deathSaves;
    const eDs = entity.deathSaves;
    if (!uDs !== !eDs) return true;
    if (uDs && eDs) {
      if (uDs.successes !== eDs.successes) return true;
      if (uDs.failures !== eDs.failures) return true;
      if (uDs.isStabilized !== eDs.isStabilized) return true;
    }
  }

  // Compare conditions by name set
  if (updates.conditions) {
    const currentNames = entity.conditions
      .map(c => `${c.name}-${c.source}`)
      .sort()
      .join(',');
    const updateNames = updates.conditions
      .map(c => `${c.name}-${c.source}`)
      .sort()
      .join(',');
    if (currentNames !== updateNames) return true;
  }

  // Compare defenses & senses
  const arraysEqual = (a?: string[], b?: string[]) =>
    (a ?? []).sort().join(',') !== (b ?? []).sort().join(',');
  if (arraysEqual(updates.damageResistances, entity.damageResistances))
    return true;
  if (arraysEqual(updates.damageImmunities, entity.damageImmunities))
    return true;
  if (arraysEqual(updates.conditionImmunities, entity.conditionImmunities))
    return true;
  if (
    (updates.senses ?? [])
      .map(s => `${s.name}:${s.range}`)
      .sort()
      .join(',') !==
    (entity.senses ?? [])
      .map(s => `${s.name}:${s.range}`)
      .sort()
      .join(',')
  )
    return true;

  return false;
}

/**
 * Merge live summon data from player sync into an encounter entity.
 * Preserves DM-added conditions while replacing player-synced ones.
 */
export function mergeSummonSyncData(
  entity: EncounterEntity,
  summon: Summon
): Partial<EncounterEntity> {
  const se = summon.entity;

  // Build player-synced conditions from summon entity
  const playerConditions: EncounterCondition[] = se.conditions.map(c => ({
    ...c,
    id:
      c.source === 'dm'
        ? c.id
        : `psync-summon-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
    source: c.source ?? ('player-sync' as const),
  }));

  // Preserve DM-added conditions on the encounter entity
  const dmConditions = entity.conditions.filter(c => c.source === 'dm');
  const playerConditionNames = new Set(playerConditions.map(c => c.name));
  const uniqueDmConditions = dmConditions.filter(
    c => !playerConditionNames.has(c.name)
  );
  const mergedConditions = [...uniqueDmConditions, ...playerConditions];

  return {
    name: summon.customName || se.name,
    currentHp: se.currentHp,
    maxHp: se.maxHp,
    tempHp: se.tempHp,
    armorClass: se.armorClass,
    conditions: mergedConditions,
    concentrationSpell: summon.requiresConcentration
      ? summon.sourceSpellName
      : undefined,
  };
}

/**
 * Check if any summon-synced fields have changed to avoid unnecessary updates.
 */
export function hasSummonDataChanged(
  entity: EncounterEntity,
  updates: Partial<EncounterEntity>
): boolean {
  if (updates.currentHp !== entity.currentHp) return true;
  if (updates.maxHp !== entity.maxHp) return true;
  if (updates.tempHp !== entity.tempHp) return true;
  if (updates.armorClass !== entity.armorClass) return true;
  if (
    updates.initiative !== undefined &&
    updates.initiative !== entity.initiative
  )
    return true;
  if (updates.name !== entity.name) return true;
  if (updates.concentrationSpell !== entity.concentrationSpell) return true;

  if (updates.conditions) {
    const currentNames = entity.conditions
      .map(c => `${c.name}-${c.source}`)
      .sort()
      .join(',');
    const updateNames = updates.conditions
      .map(c => `${c.name}-${c.source}`)
      .sort()
      .join(',');
    if (currentNames !== updateNames) return true;
  }

  return false;
}

/**
 * Sync a player's summons into an encounter.
 * Adds new summons, updates existing ones, and removes stale ones.
 */
export function syncSummonsToEncounter(
  encounter: Encounter,
  playerEntity: EncounterEntity,
  playerSummons: Summon[],
  addEntity: (encounterId: string, entity: Omit<EncounterEntity, 'id'>) => void,
  updateEntity: (
    encounterId: string,
    entityId: string,
    updates: Partial<EncounterEntity>
  ) => void,
  removeEntity: (encounterId: string, entityId: string) => void
): void {
  const ownerId = playerEntity.playerCharacterId;
  if (!ownerId) return;

  // Find existing summon entities for this player
  const existingSummonEntities = encounter.entities.filter(
    e => e.summonOwnerId === ownerId
  );

  const activeSummonIds = new Set(playerSummons.map(s => s.id));
  const existingSummonIds = new Set(
    existingSummonEntities.map(e => e.summonId).filter(Boolean)
  );

  // Add new summons (same initiative as owner — sort function places them after)
  const ownerInit = playerEntity.initiative;
  for (const summon of playerSummons) {
    if (existingSummonIds.has(summon.id)) continue;

    const se = summon.entity;

    addEntity(encounter.id, {
      type: 'monster',
      name: summon.customName || se.name,
      initiative: ownerInit,
      initiativeModifier: se.initiativeModifier,
      currentHp: se.currentHp,
      maxHp: se.maxHp,
      tempHp: se.tempHp,
      armorClass: se.armorClass,
      conditions: se.conditions,
      monsterStatBlock: se.monsterStatBlock,
      monsterSourceId: se.monsterSourceId,
      concentrationSpell: summon.requiresConcentration
        ? summon.sourceSpellName
        : undefined,
      summonId: summon.id,
      summonOwnerId: ownerId,
      isHidden: false,
    });
  }

  // Update existing summons (including initiative tracking from owner)
  for (const entity of existingSummonEntities) {
    if (!entity.summonId) continue;
    const summon = playerSummons.find(s => s.id === entity.summonId);
    if (!summon) continue;

    const updates = mergeSummonSyncData(entity, summon);

    // Keep summon initiative in sync with owner's
    if (entity.initiative !== ownerInit) {
      updates.initiative = ownerInit;
    }

    if (hasSummonDataChanged(entity, updates)) {
      updateEntity(encounter.id, entity.id, updates);
    }
  }

  // Remove stale summons (no longer in player's summons array)
  for (const entity of existingSummonEntities) {
    if (entity.summonId && !activeSummonIds.has(entity.summonId)) {
      removeEntity(encounter.id, entity.id);
    }
  }
}
