import { EncounterEntity, EncounterCondition } from '@/types/encounter';
import { CampaignPlayerData } from '@/types/campaign';

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
  const armorClass = char.isTempACActive
    ? (char.tempArmorClass ?? char.armorClass ?? entity.armorClass)
    : (char.armorClass ?? entity.armorClass);

  const concentrationSpell =
    char.concentration?.isConcentrating && char.concentration?.spellName
      ? char.concentration.spellName
      : undefined;

  const inspirationCount = char.heroicInspiration?.count ?? 0;

  // Build player-synced conditions from character data
  const playerConditions: EncounterCondition[] = (
    char.conditionsAndDiseases?.activeConditions ?? []
  ).map(c => ({
    id: `psync-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: c.name,
    description: c.description,
    source: 'player-sync' as const,
  }));

  // Preserve DM-added conditions
  const dmConditions = entity.conditions.filter(c => c.source === 'dm');

  // Merge: DM conditions + player-synced conditions (deduplicated by name)
  const playerConditionNames = new Set(playerConditions.map(c => c.name));
  const uniqueDmConditions = dmConditions.filter(
    c => !playerConditionNames.has(c.name)
  );
  const mergedConditions = [...uniqueDmConditions, ...playerConditions];

  return {
    currentHp,
    maxHp,
    tempHp,
    armorClass,
    concentrationSpell,
    inspirationCount,
    conditions: mergedConditions,
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
  if (updates.concentrationSpell !== entity.concentrationSpell) return true;
  if (updates.inspirationCount !== entity.inspirationCount) return true;

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

  return false;
}
