import { HitPoints, CharacterState, ActiveCondition } from './character';

// Combat participant types
export type CombatParticipantType = 'player' | 'monster';

export interface CombatParticipant {
  id: string;
  type: CombatParticipantType;
  name: string;
  
  // Core Combat Stats
  armorClass: number;
  tempArmorClass?: number;
  hitPoints: HitPoints;
  
  // Action Economy
  hasReaction: boolean;
  hasBonusAction: boolean;
  hasLegendaryActions?: number; // For monsters
  usedLegendaryActions?: number; // Current round usage
  
  // Character/Monster Info
  class?: string; // For players
  level?: number; // For players
  challengeRating?: string; // For monsters
  
  // Initiative
  initiative: number;
  dexterityModifier: number;
  
  // Visual State
  position: { x: number; y: number }; // For card arrangement
  isCurrentTurn?: boolean;
  conditions: ActiveCondition[];
  
  // Data References
  characterReference?: {
    campaignId: string;
    characterId: string;
    characterData: CharacterState;
  };
  monsterReference?: {
    slug: string;
    monsterData: unknown; // Will be typed later when we integrate monster data
  };
  
  // Combat tracking
  hasActed?: boolean;
  turnOrder?: number;
}

export interface Encounter {
  id: string;
  campaignId: string;
  
  // Participants
  participants: CombatParticipant[];
  
  // Turn management
  currentTurn: number; // Index of current participant
  currentRound: number;
  
  // Metadata
  name?: string;
  description?: string;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
  
  // Combat log
  logEntries?: CombatLogEntry[];
}

export interface CombatLogEntry {
  id: string;
  timestamp: Date;
  round: number;
  turn?: number;
  type: 'damage' | 'healing' | 'condition' | 'death' | 'action' | 'initiative' | 'turn' | 'round';
  actor: string; // participant name
  target?: string; // target name if applicable
  amount?: number; // damage/healing amount
  description: string;
  data?: unknown; // Additional structured data
}

// Combat action types
export interface CombatAction {
  id: string;
  type: 'damage' | 'heal' | 'condition' | 'move' | 'other';
  actor: string;
  targets: string[];
  description: string;
  data?: unknown;
}

// Initiative order tracking
export interface InitiativeOrder {
  participantId: string;
  initiative: number;
  tiebreaker: number; // Usually dex modifier
  isPlayer: boolean;
  isDelayed?: boolean;
  position: number; // Current position in turn order
}

// Card layout options
export type CombatLayoutMode = 'grid' | 'initiative' | 'free';

// Combat canvas state
export interface CombatCanvasState {
  layoutMode: CombatLayoutMode;
  selectedParticipants: string[];
  showInitiativeOrder: boolean;
  compactCards: boolean;
}
