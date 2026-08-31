import type {
  Encounter,
  EncounterCondition,
  EncounterEntity,
} from '@/types/encounter';
import type { EntityActions } from './types';

interface Store {
  updateEntity: (
    encounterId: string,
    entityId: string,
    updates: Partial<EncounterEntity>
  ) => void;
  removeEntity: (encounterId: string, entityId: string) => void;
  damageEntity: (encounterId: string, entityId: string, amount: number) => void;
  healEntity: (encounterId: string, entityId: string, amount: number) => void;
  addTempHp: (encounterId: string, entityId: string, amount: number) => void;
  setEntityHp: (
    encounterId: string,
    entityId: string,
    current: number,
    max?: number
  ) => void;
  addCondition: (
    encounterId: string,
    entityId: string,
    condition: Omit<EncounterCondition, 'id'>
  ) => void;
  removeCondition: (
    encounterId: string,
    entityId: string,
    conditionId: string
  ) => void;
  setConditionRounds: (
    encounterId: string,
    entityId: string,
    conditionId: string,
    rounds: number | null
  ) => void;
  useAbility: (
    encounterId: string,
    entityId: string,
    abilityId: string
  ) => void;
  useInventoryEntry?: (
    encounterId: string,
    entityId: string,
    entryId: string
  ) => boolean;
  restoreAbility: (
    encounterId: string,
    entityId: string,
    abilityId: string
  ) => void;
  spendEntityResource: (
    encounterId: string,
    entityId: string,
    resourceId: string,
    amount: number
  ) => boolean;
  restoreEntityResource: (
    encounterId: string,
    entityId: string,
    resourceId: string,
    amount: number
  ) => void;
  useLegendaryAction: (
    encounterId: string,
    entityId: string,
    actionId: string
  ) => void;
  resetLegendaryActions: (encounterId: string, entityId: string) => void;
  setConcentration: (
    encounterId: string,
    entityId: string,
    spellName: string | null
  ) => void;
  useLairAction: (
    encounterId: string,
    entityId: string,
    actionId: string
  ) => void;
  setInitiative: (encounterId: string, entityId: string, value: number) => void;
  longRestEntity: (encounterId: string, entityId: string) => void;
  shortRestEntity: (encounterId: string, entityId: string) => void;
}

export interface BuildEntityActionsDeps {
  encounterId: string;
  encounter: Encounter;
  store: Store;
  syncPlayerEffects: (playerId: string, snapshot: EncounterEntity) => void;
  onViewPlayer?: (playerCharacterId: string) => void;
  onViewNPC?: (npcSourceId: string, entityId: string) => void;
  onChangePlayerColor?: (
    playerCharacterId: string,
    color: string | undefined
  ) => void;
  onAdjustCounter?: (playerId: string, delta: number) => void;
}

export function buildEntityActions(
  deps: BuildEntityActionsDeps
): EntityActions {
  const {
    encounterId,
    encounter,
    store,
    syncPlayerEffects,
    onViewPlayer,
    onViewNPC,
    onChangePlayerColor,
    onAdjustCounter,
  } = deps;

  return {
    onUpdate: (entityId, updates) =>
      store.updateEntity(encounterId, entityId, updates),

    onRemove: entityId => {
      // Cascade-remove summon entities when removing a player
      const entity = encounter.entities.find(e => e.id === entityId);
      if (entity?.type === 'player' && entity.playerCharacterId) {
        const summonEntities = encounter.entities.filter(
          e => e.summonOwnerId === entity.playerCharacterId
        );
        for (const se of summonEntities) {
          store.removeEntity(encounterId, se.id);
        }
      }
      store.removeEntity(encounterId, entityId);
    },

    onDamage: (entityId, amount) =>
      store.damageEntity(encounterId, entityId, amount),
    onHeal: (entityId, amount) =>
      store.healEntity(encounterId, entityId, amount),
    onAddTempHp: (entityId, amount) =>
      store.addTempHp(encounterId, entityId, amount),

    onSetMaxHp: (entityId, max) => {
      const entity = encounter.entities.find(e => e.id === entityId);
      if (!entity) return;
      store.setEntityHp(
        encounterId,
        entityId,
        Math.min(entity.currentHp, max),
        max
      );
    },

    onAddCondition: (entityId, condition) => {
      store.addCondition(encounterId, entityId, condition);
      const entity = encounter.entities.find(e => e.id === entityId);
      if (entity?.type === 'player' && entity.playerCharacterId) {
        // Build a snapshot of the entity after the add for sync
        const snapshot = {
          ...entity,
          conditions: [
            ...entity.conditions,
            { ...condition, id: 'pending', source: 'dm' as const },
          ],
        };
        syncPlayerEffects(entity.playerCharacterId, snapshot);
      }
    },

    onRemoveCondition: (entityId, conditionId) => {
      const entity = encounter.entities.find(e => e.id === entityId);

      if (entity?.type === 'player' && entity.playerCharacterId) {
        const removedCondition = entity.conditions.find(
          c => c.id === conditionId
        );

        // If DM removes a player-synced condition, suppress it
        if (removedCondition?.source === 'player-sync') {
          const suppressed = [
            ...(entity.suppressedConditions ?? []),
            removedCondition.name,
          ];
          store.updateEntity(encounterId, entityId, {
            suppressedConditions: [...new Set(suppressed)],
          });
        }

        store.removeCondition(encounterId, entityId, conditionId);

        // Build snapshot after removal + suppression for sync
        const updatedSuppressed =
          removedCondition?.source === 'player-sync'
            ? [
                ...new Set([
                  ...(entity.suppressedConditions ?? []),
                  removedCondition.name,
                ]),
              ]
            : entity.suppressedConditions;

        const snapshot = {
          ...entity,
          conditions: entity.conditions.filter(c => c.id !== conditionId),
          suppressedConditions: updatedSuppressed,
        };
        syncPlayerEffects(entity.playerCharacterId, snapshot);
      } else {
        store.removeCondition(encounterId, entityId, conditionId);
      }
    },

    onSetConditionRounds: (entityId, conditionId, rounds) =>
      store.setConditionRounds(encounterId, entityId, conditionId, rounds),

    onUseAbility: (entityId, abilityId) =>
      store.useAbility(encounterId, entityId, abilityId),
    onUseInventoryEntry: (entityId, entryId) =>
      store.useInventoryEntry?.(encounterId, entityId, entryId) ?? false,
    onRestoreAbility: (entityId, abilityId) =>
      store.restoreAbility(encounterId, entityId, abilityId),
    onSpendResource: (entityId, resourceId, amount) =>
      store.spendEntityResource(encounterId, entityId, resourceId, amount),
    onRestoreResource: (entityId, resourceId, amount) =>
      store.restoreEntityResource(encounterId, entityId, resourceId, amount),
    onUseLegendaryAction: (entityId, actionId) =>
      store.useLegendaryAction(encounterId, entityId, actionId),
    onResetLegendaryActions: entityId =>
      store.resetLegendaryActions(encounterId, entityId),
    onSetConcentration: (entityId, spellName) =>
      store.setConcentration(encounterId, entityId, spellName),
    onUseLairAction: (entityId, actionId) =>
      store.useLairAction(encounterId, entityId, actionId),
    onSetInitiative: (entityId, value) =>
      store.setInitiative(encounterId, entityId, value),
    onLongRest: entityId => store.longRestEntity(encounterId, entityId),
    onShortRest: entityId => store.shortRestEntity(encounterId, entityId),

    onViewPlayer,
    onViewNPC,
    onChangePlayerColor,
    onAdjustCounter,
  };
}
