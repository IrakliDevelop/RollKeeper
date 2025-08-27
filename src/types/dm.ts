// Core DM module types
import { CharacterState, SpellSlots, ActiveCondition } from './character';

export interface DMEntityBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

// Campaign types
export interface Campaign extends DMEntityBase {
  name: string;
  description: string;
  dmId: string;

  // Campaign data
  playerCharacters: PlayerCharacterReference[];
  sessions: Session[];
  encounters: SavedEncounter[];
  notes: CampaignNote[];
  settings: CampaignSettings;

  // Metadata
  tags: string[];
  isArchived: boolean;
}

export interface CampaignSettings {
  // Rule variants
  useVariantRules: boolean;
  allowMulticlassing: boolean;
  useOptionalFeats: boolean;

  // Combat settings
  initiativeType: 'individual' | 'group' | 'side';
  autoAdvanceTurns: boolean;
  trackResources: boolean;
  showPlayerHP: boolean;

  // Display preferences
  showGridOnCanvas: boolean;
  defaultGridSize: number;
  canvasTheme: 'light' | 'dark' | 'tactical';

  // Import/Export
  autoBackup: boolean;
  backupInterval: number; // minutes
  maxBackups: number;
}

export interface Session extends DMEntityBase {
  campaignId: string;
  name: string;
  date: Date;
  duration?: number; // Session length in minutes

  // Session content
  summary: string;
  encounters: string[]; // Encounter IDs from this session
  notes: CampaignNote[];
  xpAwarded: number;

  // Participant tracking
  presentPlayers: string[]; // Character IDs who attended
  absentPlayers: string[]; // Character IDs who missed

  // Session state
  isActive: boolean;
  startedAt?: Date;
  endedAt?: Date;
}

// Character management types
export interface PlayerCharacterReference extends DMEntityBase {
  // Reference data
  characterId: string; // Original character sheet ID
  campaignId: string; // Associated campaign

  // Character info
  characterName: string;
  playerName: string;
  class: string;
  level: number;
  race: string;

  // Import metadata
  importSource: CharacterImportSource;
  importedAt: Date;
  lastSynced: Date;
  syncStatus: CharacterSyncStatus;

  // DM overrides
  isActive: boolean; // Currently in campaign
  isVisible: boolean; // Visible to other players
  dmNotes: string; // Private DM notes about character
  customName?: string; // DM override for character name

  // Cached character data (for offline access)
  characterData: CharacterState;
  lastKnownHash: string;

  // Combat participation
  combatHistory: CombatParticipationRecord[];
  lastCombatStats?: CombatStats;
}

export interface CharacterImportSource {
  type: 'json' | 'localStorage' | 'manual' | 'url';
  timestamp: Date;
  originalId?: string;
  fileName?: string;
  version: string;
  hash: string; // For change detection
}

export type CharacterSyncStatus =
  | 'synced' // Up to date
  | 'outdated' // Character has been updated since last sync
  | 'conflict' // Conflicting changes detected
  | 'manual' // Manual override, don't sync
  | 'error'; // Sync failed

// Combat and encounter types (basic for now)
export interface SavedEncounter extends DMEntityBase {
  roundNumber: number;
  campaignId: string;
  name: string;
  description: string;
  isTemplate: boolean;
  difficulty: EncounterDifficulty;
}

export interface CombatParticipationRecord {
  encounterId: string;
  participantId: string;

  // Combat statistics
  roundsParticipated: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  spellsUsed: number;
  abilitiesUsed: string[];

  // Outcomes
  wasKnockedOut: boolean;
  wasRevived: boolean;
  killingBlows: number;

  // Timestamps
  joinedAt: Date;
  leftAt?: Date;

  // XP and rewards
  xpEarned: number;
  treasureEarned: string[];
}

export enum EncounterDifficulty {
  TRIVIAL = 'trivial',
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  DEADLY = 'deadly',
  LEGENDARY = 'legendary',
}

// Campaign notes
export interface CampaignNote extends DMEntityBase {
  campaignId: string;
  sessionId?: string; // Associated session

  // Content
  title: string;
  content: string; // Rich text content
  category: NoteCategory;
  tags: string[];

  // Metadata
  isPrivate: boolean; // Only visible to DM
  isPinned: boolean;

  // Linking
  linkedCharacters: string[]; // Character IDs
  linkedEncounters: string[]; // Encounter IDs
  linkedSessions: string[]; // Session IDs

  // Canvas integration
  position?: { x: number; y: number }; // Position on notes canvas
  connections: string[]; // Connected note IDs
}

export type NoteCategory =
  | 'session'
  | 'npc'
  | 'location'
  | 'plot'
  | 'rules'
  | 'treasure'
  | 'lore'
  | 'reminder';

// Utility types
export interface Position {
  x: number;
  y: number;
  z?: number; // Elevation (optional)
}

// Combat Tracker Types
export interface CombatEncounter extends DMEntityBase {
  campaignId: string;
  name: string;
  description: string;

  // Combat state
  isActive: boolean;
  roundNumber: number;
  turnIndex: number;
  startedAt?: Date;
  endedAt?: Date;

  // Participants
  participants: CombatParticipant[];

  // Canvas state
  canvasData: CombatCanvasData;

  // Settings for this encounter
  settings: EncounterSettings;

  // Combat log
  combatLog: CombatLogEntry[];

  // Templates and saved states
  isTemplate: boolean;
  templateTags: string[];
}

export interface CombatParticipant {
  id: string;
  type: 'player' | 'enemy' | 'npc' | 'summon';
  name: string;

  // Data sources
  characterReference?: string; // PlayerCharacterReference ID
  monsterReference?: string; // Monster ID from bestiary
  customData?: Partial<CharacterState>; // For custom/modified entities

  // Combat stats (current state)
  combatStats: CombatStats;

  // Position and display
  position: Position;
  facing?: number; // Degrees from north
  size: CreatureSize;
  tokenImage?: string;
  tokenColor?: string;
  visibility: ParticipantVisibility;

  // Initiative and turn order
  initiative: number;
  initiativeModifier: number;
  hasActed: boolean;
  isActive: boolean; // Currently their turn

  // Status effects
  conditions: ActiveCondition[];
  temporaryEffects: TemporaryEffect[];

  // Participation metadata
  joinedRound: number;
  leftRound?: number;
  notes: string;
}

export interface CombatStats {
  // Hit Points
  currentHP: number;
  maxHP: number;
  tempHP: number;

  // Armor Class
  currentAC: number;
  baseAC: number;
  tempAC: number;

  // Spell Slots (if applicable)
  spellSlots?: SpellSlots;
  pactMagicSlots?: { current: number; max: number; level: number };

  // Resource tracking
  usedAbilities: UsedAbility[];
  usedSpells: UsedSpell[];

  // Death saves (for players/important NPCs)
  deathSaves?: {
    successes: number;
    failures: number;
    isStable: boolean;
  };

  // Combat statistics
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  roundsActive: number;
}

export interface UsedAbility {
  abilityId: string;
  abilityName: string;
  usesRemaining: number;
  maxUses: number;
  rechargeType: 'short' | 'long' | 'round' | 'custom';
  lastUsed: number; // Round number
}

export interface UsedSpell {
  spellName: string;
  spellLevel: number;
  slotLevel: number;
  castAtRound: number;
  concentration: boolean;
  isActive: boolean;
}

export interface TemporaryEffect {
  id: string;
  name: string;
  description: string;
  duration: EffectDuration;
  source: EffectSource;
  startRound: number;
  endRound?: number;
  isHidden: boolean; // Hidden from players
}

export interface EffectDuration {
  type: 'rounds' | 'minutes' | 'hours' | 'permanent' | 'concentration';
  value?: number;
  endsOnSave?: boolean;
  saveType?: string;
  saveDC?: number;
}

export interface EffectSource {
  type: 'spell' | 'ability' | 'item' | 'environment' | 'custom';
  sourceId?: string;
  sourceName: string;
  casterParticipantId?: string;
}

export interface CombatCanvasData {
  // Grid settings
  gridSize: number;
  gridVisible: boolean;
  gridSnap: boolean;

  // Canvas dimensions and view
  width: number;
  height: number;
  viewPort: {
    x: number;
    y: number;
    zoom: number;
  };

  // Background
  backgroundImage?: string;
  backgroundColor: string;

  // Annotations (lines, shapes, text)
  annotations: CanvasAnnotation[];

  // Canvas state
  isDirty: boolean;
  lastSaved: Date;
}

export interface CanvasAnnotation {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'text' | 'arrow' | 'area';
  position: Position;
  size?: { width: number; height: number };
  style: {
    color: string;
    strokeWidth: number;
    fillColor?: string;
    opacity: number;
  };
  content?: string; // For text annotations
  isVisible: boolean;
  roundCreated: number;
}

export interface EncounterSettings {
  // Initiative
  rollInitiativeAutomatically: boolean;
  groupInitiative: boolean;
  autoAdvanceTurns: boolean;
  skipDefeatedCreatures: boolean;

  // Display
  showEnemyHP: boolean;
  showEnemyAC: boolean;
  showConditions: boolean;
  hideDefeatedCreatures: boolean;

  // Automation
  autoApplyDamage: boolean;
  autoRollDamage: boolean;
  autoCalculateXP: boolean;
  trackSpellSlots: boolean;

  // Canvas
  enableGrid: boolean;
  measurementUnit: 'feet' | 'meters' | 'squares';
  snapToGrid: boolean;
}

export interface CombatLogEntry {
  id: string;
  timestamp: Date;
  round: number;
  turn: number;

  // Event details
  type: CombatEventType;
  actorId?: string; // Participant who acted
  targetIds: string[]; // Participants affected

  // Content
  message: string;
  details?: Record<string, unknown>; // Structured data for the event

  // Display
  isVisible: boolean; // Visible to players
  color?: string;
  icon?: string;
}

export enum CombatEventType {
  // Combat flow
  COMBAT_START = 'combat_start',
  COMBAT_END = 'combat_end',
  ROUND_START = 'round_start',
  TURN_START = 'turn_start',

  // Actions
  ATTACK = 'attack',
  SPELL_CAST = 'spell_cast',
  ABILITY_USED = 'ability_used',
  MOVE = 'move',

  // Damage and healing
  DAMAGE_DEALT = 'damage_dealt',
  HEALING_DONE = 'healing_done',
  TEMP_HP_GAINED = 'temp_hp_gained',

  // Status changes
  CONDITION_APPLIED = 'condition_applied',
  CONDITION_REMOVED = 'condition_removed',
  EFFECT_APPLIED = 'effect_applied',
  EFFECT_EXPIRED = 'effect_expired',

  // Death and revival
  KNOCKED_OUT = 'knocked_out',
  DEATH_SAVE = 'death_save',
  STABILIZED = 'stabilized',
  REVIVED = 'revived',
  DIED = 'died',

  // Participants
  PARTICIPANT_ADDED = 'participant_added',
  PARTICIPANT_REMOVED = 'participant_removed',
  INITIATIVE_ROLLED = 'initiative_rolled',

  // Custom
  CUSTOM = 'custom',
}

export enum CreatureSize {
  TINY = 'tiny',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  HUGE = 'huge',
  GARGANTUAN = 'gargantuan',
}

export enum ParticipantVisibility {
  VISIBLE = 'visible', // Visible to all players
  HIDDEN = 'hidden', // Hidden from players
  PARTIAL = 'partial', // Some info hidden (e.g., HP)
  DM_ONLY = 'dm_only', // Completely invisible to players
}

// Default values
export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  useVariantRules: false,
  allowMulticlassing: true,
  useOptionalFeats: true,
  initiativeType: 'individual',
  autoAdvanceTurns: false,
  trackResources: true,
  showPlayerHP: true,
  showGridOnCanvas: true,
  defaultGridSize: 5,
  canvasTheme: 'light',
  autoBackup: true,
  backupInterval: 5,
  maxBackups: 10,
};

export const DEFAULT_ENCOUNTER_SETTINGS: EncounterSettings = {
  rollInitiativeAutomatically: false,
  groupInitiative: false,
  autoAdvanceTurns: false,
  skipDefeatedCreatures: true,
  showEnemyHP: false,
  showEnemyAC: true,
  showConditions: true,
  hideDefeatedCreatures: false,
  autoApplyDamage: false,
  autoRollDamage: false,
  autoCalculateXP: true,
  trackSpellSlots: true,
  enableGrid: true,
  measurementUnit: 'feet',
  snapToGrid: true,
};

export const DEFAULT_CANVAS_DATA: CombatCanvasData = {
  gridSize: 5,
  gridVisible: true,
  gridSnap: true,
  width: 1000,
  height: 1000,
  viewPort: { x: 0, y: 0, zoom: 1 },
  backgroundColor: '#f8fafc',
  annotations: [],
  isDirty: false,
  lastSaved: new Date(),
};
