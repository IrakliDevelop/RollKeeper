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

export interface MovementEvent extends BaseCombatLogEvent {
  type: 'movement';
  entityId: string;
  entityName: string;
  /** Path distance, sender-computed (grid metric + diagonal rule). */
  feet: number;
  cells: number;
  /** World-space token centres, for replay/analysis; not rendered today. */
  from: { x: number; y: number };
  to: { x: number; y: number };
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
  | DeathEvent
  | MovementEvent;

export interface CombatLogFilters {
  types?: CombatLogEvent['type'][];
  entityId?: string;
  searchQuery?: string;
  roundRange?: { min?: number; max?: number };
}

export interface CombatLogState {
  /** Stable identity of this archive. One encounter may own several. */
  encounterId: string;
  /** Routed campaign, or undefined for an unscoped (orphan) archive. */
  campaignCode?: string;
  events: CombatLogEvent[];
  startedAt: string;
  endedAt?: string;
}

export interface CombatLogTombstone {
  legacyId: string;
  /** Campaign is carried here only, matching encounterAwareStorage.ts:32-36. */
  beforeImage: CombatLogState;
  deletedAt: string;
}

export type CombatLogAdmissionReason =
  | 'record-bytes'
  | 'item-count'
  | 'total-bytes';

export interface CombatLogAdmissionError {
  archiveId: string;
  reason: CombatLogAdmissionReason;
  at: string;
}
