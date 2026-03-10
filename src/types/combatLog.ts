// Combat log event types for DM encounter tracking

export interface BaseCombatLogEvent {
  id: string;
  timestamp: string;
  round: number;
  turn: number;
  encounterId: string;
}

export interface DamageEvent extends BaseCombatLogEvent {
  type: 'damage';
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  amount: number;
  damageType: string;
  isCritical?: boolean;
  weaponOrSpellName?: string;
}

export interface HealingEvent extends BaseCombatLogEvent {
  type: 'healing';
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  amount: number;
  actualHealing: number;
  spellOrAbilityName?: string;
}

export interface ConditionEvent extends BaseCombatLogEvent {
  type: 'condition_applied' | 'condition_removed';
  sourceId?: string;
  sourceName?: string;
  targetId: string;
  targetName: string;
  conditionName: string;
  duration?: string;
  sourceSpell?: string;
}

export interface TurnEvent extends BaseCombatLogEvent {
  type: 'turn_start' | 'turn_end';
  entityId: string;
  entityName: string;
}

export interface SpellCastEvent extends BaseCombatLogEvent {
  type: 'spell_cast';
  casterId: string;
  casterName: string;
  spellName: string;
  spellLevel: number;
  slotUsed?: number;
  isConcentration?: boolean;
}

export interface AbilityUseEvent extends BaseCombatLogEvent {
  type: 'ability_use';
  userId: string;
  userName: string;
  abilityName: string;
  abilityType: 'legendary_action' | 'lair_action' | 'recharge' | 'reaction';
  legendaryActionCost?: number;
}

export interface RoundEvent extends BaseCombatLogEvent {
  type: 'round_start' | 'round_end';
  roundNumber: number;
}

export interface CombatStatusEvent extends BaseCombatLogEvent {
  type: 'combat_start' | 'combat_end';
  participantNames: string[];
  endReason?: 'victory' | 'defeat' | 'flee' | 'truce' | 'dm_ended';
}

export interface DeathEvent extends BaseCombatLogEvent {
  type: 'unconscious' | 'death' | 'revived' | 'stabilized';
  entityId: string;
  entityName: string;
}

export type CombatLogEvent =
  | DamageEvent
  | HealingEvent
  | ConditionEvent
  | TurnEvent
  | SpellCastEvent
  | AbilityUseEvent
  | RoundEvent
  | CombatStatusEvent
  | DeathEvent;

export interface CombatLogFilters {
  types?: CombatLogEvent['type'][];
  entityId?: string;
  searchQuery?: string;
  roundRange?: { min?: number; max?: number };
}

export interface CombatLogState {
  events: CombatLogEvent[];
  startedAt: string;
  endedAt?: string;
}
