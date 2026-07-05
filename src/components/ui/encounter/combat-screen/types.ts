import type { EncounterEntity, EncounterCondition } from '@/types/encounter';

export interface EntityActions {
  onUpdate: (entityId: string, updates: Partial<EncounterEntity>) => void;
  onRemove: (entityId: string) => void;
  onDamage: (entityId: string, amount: number) => void;
  onHeal: (entityId: string, amount: number) => void;
  onAddTempHp: (entityId: string, amount: number) => void;
  onSetMaxHp: (entityId: string, max: number) => void;
  onAddCondition: (
    entityId: string,
    condition: Omit<EncounterCondition, 'id'>
  ) => void;
  onRemoveCondition: (entityId: string, conditionId: string) => void;
  onSetConditionRounds: (
    entityId: string,
    conditionId: string,
    rounds: number | null
  ) => void;
  onUseAbility: (entityId: string, abilityId: string) => void;
  onRestoreAbility: (entityId: string, abilityId: string) => void;
  onUseLegendaryAction: (entityId: string, actionId: string) => void;
  onResetLegendaryActions: (entityId: string) => void;
  onSetConcentration: (entityId: string, spellName: string | null) => void;
  onUseLairAction: (entityId: string, actionId: string) => void;
  onSetInitiative: (entityId: string, value: number) => void;
  onLongRest: (entityId: string) => void;
  onViewPlayer?: (playerCharacterId: string) => void;
  onViewNPC?: (npcSourceId: string, entityId: string) => void;
  onChangePlayerColor?: (
    playerCharacterId: string,
    color: string | undefined
  ) => void;
  onAdjustCounter?: (playerId: string, delta: number) => void;
}
