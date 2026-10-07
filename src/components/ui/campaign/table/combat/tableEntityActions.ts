import type {
  CombatantDetailCapabilities,
  EntityActions,
} from '@/components/ui/encounter/combat-screen/types';
import type { TableCombatStatChange } from '@/lib/table/combat';
import type {
  TableCombatParticipantView,
  TableCombatReadModel,
} from '@/lib/table/combatReadModel';
import type { JsonObject } from '@/lib/table/schema';
import type { EncounterEntity } from '@/types/encounter';

export const NOT_AVAILABLE_IN_SCENE_RUNS = 'Not available in scene runs';

/** One combat command draft per user intent; the panel adds runId/at. */
export type TableCombatDraft =
  | { type: 'combat.applyStat'; actorId: string; change: TableCombatStatChange }
  | { type: 'combat.setHidden'; actorId: string; hidden: boolean }
  | { type: 'combat.setInitiative'; actorId: string; value: number | null };

/** Fields the Table accepts through `onUpdate` (R2-4 defence in depth). */
const UPDATE_FIELDS = new Set<keyof EncounterEntity>([
  'armorClass',
  'currentHp',
  'maxHp',
  'tempHp',
  'hasUsedReaction',
  'isHidden',
]);

/**
 * Detail capabilities per participant (R2-2, R2-4, R2-10): only editable
 * actors take HP/AC/temp writes; player references take overlay conditions;
 * adopted PCs are read-only. The DM reaction toggle is hidden for
 * player-controlled rows (they show the player's own sheet value).
 */
export function tableDetailCapabilities(
  view: TableCombatParticipantView
): CombatantDetailCapabilities {
  const editable = view.kind === 'editable';
  const notes: string[] = [];
  if (view.kind === 'adopted-pc') notes.push('Read-only adopted PC');
  if (view.identityUnresolved) notes.push('identity unresolved');
  if (view.removedFromScene) notes.push('removed from scene');
  return {
    hp: editable,
    tempHp: editable,
    maxHp: editable,
    armorClass: editable,
    conditions: editable || view.kind === 'player-reference',
    reaction: !view.playerControlled,
    hidden: true,
    creatureConditions: [],
    ...(view.missingPlayerData ? { hpUnknown: true } : {}),
    ...(notes.length > 0 ? { readOnlyNote: notes.join(' · ') } : {}),
  };
}

/**
 * EntityActions for scene runs. Every supported action maps the public
 * entity id (sceneMemberId) to its actor and dispatches exactly ONE combat
 * command; everything else shows "Not available in scene runs" and writes
 * nothing. The legacy two-call player-sync removal collapses into one
 * `removeCondition` (the planner applies the suppression).
 */
export function createTableEntityActions(options: {
  model: TableCombatReadModel;
  dispatch: (draft: TableCombatDraft) => void;
  notify: (message: string) => void;
}): EntityActions {
  const { model, dispatch, notify } = options;
  const view = (entityId: string) =>
    model.participants.find(participant => participant.entityId === entityId);
  const unsupported = () => notify(NOT_AVAILABLE_IN_SCENE_RUNS);
  const stat = (entityId: string, change: TableCombatStatChange) => {
    const target = view(entityId);
    if (!target) return notify('That participant is no longer in this run.');
    dispatch({ type: 'combat.applyStat', actorId: target.actorId, change });
  };

  return {
    onUpdate: (entityId, updates) => {
      const keys = Object.keys(updates) as Array<keyof EncounterEntity>;
      // C3-1: the legacy suppression write before a player-sync removal is
      // dropped silently; the removal command itself carries it.
      if (keys.length === 1 && keys[0] === 'suppressedConditions') return;
      if (keys.length !== 1 || !UPDATE_FIELDS.has(keys[0]!))
        return unsupported();
      const target = view(entityId);
      if (!target) return notify('That participant is no longer in this run.');
      const key = keys[0]!;
      const value = updates[key];
      switch (key) {
        case 'armorClass':
          return stat(entityId, {
            kind: 'setArmorClass',
            value: Number(value),
          });
        case 'currentHp':
          return stat(entityId, { kind: 'setHp', value: Number(value) });
        case 'maxHp':
          return stat(entityId, { kind: 'setMaxHp', value: Number(value) });
        case 'tempHp':
          // C3-2: explicit set (Clear temp HP → 0), not the no-stack add.
          return stat(entityId, { kind: 'setTempHp', value: Number(value) });
        case 'hasUsedReaction':
          return stat(entityId, { kind: 'setReaction', available: !value });
        case 'isHidden':
          return dispatch({
            type: 'combat.setHidden',
            actorId: target.actorId,
            hidden: value === true,
          });
        default:
          return unsupported();
      }
    },
    onDamage: (entityId, amount) =>
      stat(entityId, { kind: 'damage', value: amount }),
    onHeal: (entityId, amount) =>
      stat(entityId, { kind: 'heal', value: amount }),
    onAddTempHp: (entityId, amount) =>
      stat(entityId, { kind: 'addTempHp', value: amount }),
    onSetMaxHp: (entityId, max) =>
      stat(entityId, { kind: 'setMaxHp', value: max }),
    onAddCondition: (entityId, condition) =>
      stat(entityId, {
        kind: 'addCondition',
        // F9: optional fields may be `undefined`; JSON drops them so the
        // command stays canonical JSON and validates.
        condition: JSON.parse(JSON.stringify(condition)) as JsonObject,
      }),
    onRemoveCondition: (entityId, conditionId) => {
      const target = view(entityId);
      const condition = target?.entity.conditions.find(
        value => value.id === conditionId
      );
      if (!target || !condition)
        return notify('That condition is no longer present.');
      stat(entityId, {
        kind: 'removeCondition',
        conditionId,
        ...(condition.source === 'player-sync'
          ? { conditionName: condition.name }
          : {}),
        ...(target.playerConditionNames
          ? { playerConditionNames: [...target.playerConditionNames] }
          : {}),
      });
    },
    onSetConditionRounds: (entityId, conditionId, rounds) =>
      stat(entityId, { kind: 'setConditionRounds', conditionId, rounds }),
    onSetInitiative: (entityId, value) => {
      const target = view(entityId);
      if (!target) return notify('That participant is no longer in this run.');
      dispatch({
        type: 'combat.setInitiative',
        actorId: target.actorId,
        value,
      });
    },
    onRemove: unsupported,
    onUseAbility: unsupported,
    onUseInventoryEntry: () => {
      unsupported();
      return false;
    },
    onRestoreAbility: unsupported,
    onSpendResource: () => {
      unsupported();
      return false;
    },
    onRestoreResource: unsupported,
    onUseLegendaryAction: unsupported,
    onResetLegendaryActions: unsupported,
    onSetConcentration: unsupported,
    onUseLairAction: unsupported,
    onLongRest: unsupported,
    onShortRest: unsupported,
    onViewPlayer: unsupported,
    onViewNPC: unsupported,
    onChangePlayerColor: unsupported,
    onAdjustCounter: unsupported,
  };
}
