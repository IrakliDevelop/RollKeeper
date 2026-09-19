import { getSortedEntities } from '@/store/encounterStore';
import {
  DEFAULT_COMBAT_CONFIG,
  type CombatConfig,
  type Encounter,
  type EncounterCondition,
  type EncounterEntity,
} from '@/types/encounter';
import { isConditionIconName } from '@/utils/conditionIconRegistry';
import { CUSTOM_CONDITION_DESCRIPTION_MAX } from '@/utils/customConditions';
import { hpPercent, hpStateLabel, hpTier } from '@/utils/hpState';
import type {
  SharedCondition,
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

const HIDDEN_LABEL: Record<
  NonNullable<EncounterEntity['playerDisposition']>,
  string
> = {
  ally: 'Ally',
  neutral: 'Stranger',
  enemy: 'Enemy',
};

function playerFacingName(entity: EncounterEntity): string {
  // Players are never masked.
  if (entity.type === 'player') return entity.name;
  // A custom alias wins over everything else.
  const alias = entity.playerAlias?.trim();
  if (alias) return alias;
  // Otherwise a hidden entity shows a generic label matching its disguise.
  if (entity.isHidden) return HIDDEN_LABEL[entity.playerDisposition ?? 'enemy'];
  return entity.name;
}

/** Display-only projection of encounter conditions — see SharedCondition. */
export function toSharedConditions(
  conditions: EncounterCondition[]
): SharedCondition[] {
  return conditions.map(c => {
    const shared: SharedCondition = { name: c.name };
    if (c.kind !== undefined) shared.kind = c.kind;
    if (c.stackCount !== undefined && c.stackCount > 1)
      shared.stackCount = c.stackCount;
    const description = c.description?.trim();
    if (description)
      shared.description = description.slice(
        0,
        CUSTOM_CONDITION_DESCRIPTION_MAX
      );
    // Persisted/synced entities are untrusted too: only registry names leave.
    if (isConditionIconName(c.icon)) shared.icon = c.icon;
    return shared;
  });
}

function toEntry(
  entity: EncounterEntity,
  config: CombatConfig
): SharedTurnEntry {
  const isPlayer = entity.type === 'player';
  const displayName = playerFacingName(entity);

  const entry: SharedTurnEntry = {
    entityId: entity.id,
    displayName,
    type: entity.type as SharedTurnEntry['type'],
  };

  // DM-assigned map-correlation identity — shared for every entity type,
  // hidden enemies included (that correlation is its whole purpose).
  if (entity.chessPiece !== undefined) entry.chessPiece = entity.chessPiece;
  if (entity.color !== undefined) entry.tokenColor = entity.color;

  // Conditions & concentration: players always; non-players only when the
  // DM has turned sharing on. Legacy persisted configs lack the field →
  // default off.
  const shareConditions =
    isPlayer || (config.enemyConditionsDisplay ?? 'off') === 'on';
  if (shareConditions) {
    if (entity.conditions.length > 0)
      entry.conditions = toSharedConditions(entity.conditions);
    if (entity.concentrationSpell) entry.isConcentrating = true;
  }

  // Players always expose identity + exact HP (their own sheet is authoritative).
  if (isPlayer) {
    entry.playerCharacterId = entity.playerCharacterId;
    entry.currentHp = entity.currentHp;
    entry.maxHp = entity.maxHp;
    entry.isDead = entity.currentHp <= 0;
    return entry;
  }

  // Player-facing allegiance (disguise). Defaults to enemy for non-players.
  entry.disposition = entity.playerDisposition ?? 'enemy';

  // Per-entity DM opt-in: a toggled entity is shared as 'exact' regardless of
  // the campaign-wide mode (even 'off'); `hpMode` tells the player renderers
  // to treat this one row as 'exact'. Everyone else follows the combat config.
  const hpVisible = entity.hpVisibleToPlayers === true;
  const mode = hpVisible ? 'exact' : config.enemyHpDisplay;
  if (hpVisible) entry.hpMode = 'exact';

  // Non-players (enemies/NPCs) expose only what the effective mode allows.
  if (mode === 'off') return entry;

  const pct = hpPercent(entity.currentHp, entity.maxHp);
  entry.isDead = entity.currentHp <= 0;
  if (!entry.isDead) entry.hpTier = hpTier(pct);

  switch (mode) {
    case 'label':
      entry.hpState = hpStateLabel(
        entity.currentHp,
        entity.maxHp,
        config.hpStateBands
      );
      break;
    case 'bar':
    case 'percent':
      entry.hpPercent = Math.round(pct);
      break;
    case 'exact':
      entry.currentHp = entity.currentHp;
      entry.maxHp = entity.maxHp;
      break;
  }

  return entry;
}

/**
 * Derive the player-facing initiative payload from a DM encounter.
 * Pure — safe to unit test and to call on every turn change.
 */
export function buildSharedInitiative(
  encounter: Encounter,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG
): SharedInitiativeState {
  const sorted = getSortedEntities(encounter.entities);
  const current = sorted[encounter.currentTurn];

  return {
    encounterId: encounter.id,
    isActive: encounter.isActive,
    round: encounter.round,
    currentEntityId: current ? current.id : null,
    turnOrder: sorted.map(e => toEntry(e, config)),
    enemyHpMode: config.enemyHpDisplay,
    enemyConditionsMode: config.enemyConditionsDisplay ?? 'off',
    updatedAt: new Date().toISOString(),
  };
}
