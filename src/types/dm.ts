// Core DM module types
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
  characterData: any; // Will use CharacterState from existing types
  lastKnownHash: string;
  
  // Combat participation
  combatHistory: CombatParticipationRecord[];
  lastCombatStats?: any; // Will use CombatStats when implemented
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
  | 'synced'      // Up to date
  | 'outdated'    // Character has been updated since last sync
  | 'conflict'    // Conflicting changes detected
  | 'manual'      // Manual override, don't sync
  | 'error';      // Sync failed

// Combat and encounter types (basic for now)
export interface SavedEncounter extends DMEntityBase {
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
  LEGENDARY = 'legendary'
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
  maxBackups: 10
};
