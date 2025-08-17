# DM Toolset Data Structures

## 📊 Core Data Models

This document defines the TypeScript interfaces and data structures for the DM Toolset module. All interfaces build upon existing character data structures to maintain consistency.

## 🏕️ Campaign Management

### Campaign
```typescript
interface Campaign {
  id: string;                        // Unique campaign identifier
  name: string;                      // Campaign name
  description: string;               // Campaign description/notes
  createdAt: Date;                   // Creation timestamp
  updatedAt: Date;                   // Last modification timestamp
  dmId: string;                      // DM identifier (future multiplayer)
  
  // Campaign data
  playerCharacters: PlayerCharacterReference[];
  sessions: Session[];
  encounters: SavedEncounter[];
  notes: CampaignNote[];
  settings: CampaignSettings;
  
  // Metadata
  version: string;                   // Data schema version
  tags: string[];                    // Campaign categorization
  isArchived: boolean;               // Archive status
}
```

### Campaign Settings
```typescript
interface CampaignSettings {
  // Rule variants
  useVariantRules: boolean;
  allowMulticlassing: boolean;
  useOptionalFeats: boolean;
  exhaustionVariant: ExhaustionVariant;
  
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
```

### Session
```typescript
interface Session {
  id: string;
  campaignId: string;
  name: string;
  date: Date;
  duration?: number;                 // Session length in minutes
  
  // Session content
  summary: string;
  encounters: string[];              // Encounter IDs from this session
  notes: CampaignNote[];
  xpAwarded: number;
  
  // Participant tracking
  presentPlayers: string[];          // Character IDs who attended
  absentPlayers: string[];           // Character IDs who missed
  
  // Session state
  isActive: boolean;
  startedAt?: Date;
  endedAt?: Date;
}
```

## 👥 Character Management

### Player Character Reference
```typescript
interface PlayerCharacterReference {
  // Reference data
  id: string;                        // Unique reference ID
  characterId: string;               // Original character sheet ID
  campaignId: string;                // Associated campaign
  
  // Character info
  characterName: string;
  playerName: string;
  class: string;
  level: number;
  
  // Import metadata
  importedAt: Date;
  lastSynced: Date;
  syncStatus: 'synced' | 'outdated' | 'conflict' | 'manual';
  
  // DM overrides
  isActive: boolean;                 // Currently in campaign
  isVisible: boolean;                // Visible to other players
  dmNotes: string;                   // Private DM notes about character
  
  // Cached character data (for offline access)
  characterData: CharacterState;
  characterSnapshot: CharacterSnapshot;
  
  // Combat participation
  combatHistory: CombatParticipationRecord[];
}
```

### Character Snapshot
```typescript
interface CharacterSnapshot {
  // Core stats at time of snapshot
  level: number;
  hitPoints: HitPoints;
  armorClass: number;
  abilities: CharacterAbilities;
  
  // Spell information
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  spellcastingAbility?: string;
  spellSaveDC?: number;
  
  // Combat relevant data
  initiative: InitiativeData;
  speed: number;
  proficiencyBonus: number;
  
  // Special abilities (condensed)
  trackableTraits: TrackableTrait[];
  conditions: ActiveCondition[];
  
  // Snapshot metadata
  snapshotDate: Date;
  version: string;
}
```

## ⚔️ Combat & Encounters

### Encounter
```typescript
interface Encounter {
  // Basic info
  id: string;
  campaignId: string;
  name: string;
  description: string;
  
  // Encounter setup
  participants: CombatParticipant[];
  environment: EncounterEnvironment;
  objectives: string[];
  
  // Combat state
  initiative: InitiativeOrder[];
  currentTurn: number;
  currentRound: number;
  combatPhase: CombatPhase;
  
  // Timing
  startTime?: Date;
  endTime?: Date;
  roundDuration: number[];           // Duration of each round in seconds
  
  // Canvas data
  mapData?: CombatCanvasLayout;
  
  // Results
  outcome?: EncounterOutcome;
  xpAwarded?: number;
  treasureAwarded?: string[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  isTemplate: boolean;               // Can be reused
  difficulty: EncounterDifficulty;
}
```

### Combat Participant
```typescript
interface CombatParticipant {
  // Identity
  id: string;
  type: ParticipantType;
  name: string;
  displayName?: string;              // Custom name for display
  
  // Source data
  characterReference?: PlayerCharacterReference;
  monsterData?: ProcessedMonster;
  customNPCData?: CustomNPC;
  
  // Combat stats (current state)
  combatStats: CombatStats;
  
  // Position and display
  position?: Position;
  tokenImage?: string;
  tokenSize: TokenSize;
  facing?: number;                   // Degrees, 0 = north
  
  // Initiative and turns
  initiative: number;
  hasActed: boolean;
  hasReaction: boolean;
  hasBonusAction: boolean;
  isHidden: boolean;
  
  // Status effects
  conditions: ActiveCondition[];
  temporaryEffects: TemporaryEffect[];
  
  // Tracking
  turnHistory: TurnAction[];
  damageHistory: DamageRecord[];
  
  // DM tools
  dmNotes: string;
  isNPCAlly: boolean;
  autoRollInitiative: boolean;
}

type ParticipantType = 'player' | 'enemy' | 'npc' | 'summon' | 'hazard';
type TokenSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
type CombatPhase = 'setup' | 'active' | 'paused' | 'completed';
```

### Combat Stats
```typescript
interface CombatStats {
  // Health
  currentHP: number;
  maxHP: number;
  tempHP: number;
  hitDiceUsed: number;
  
  // Armor & Defense
  currentAC: number;
  baseAC: number;
  tempAC: number;
  
  // Resources
  spellSlots?: SpellSlots;
  pactMagicSlots?: PactMagic;
  usedAbilities: UsedAbility[];
  usedTraits: string[];              // Trackable trait IDs
  
  // Action economy
  movement: MovementState;
  actions: ActionState;
  
  // Death saving throws
  deathSaves: {
    successes: number;
    failures: number;
    isStable: boolean;
    isDead: boolean;
  };
  
  // Spell tracking
  concentratingOn?: ActiveSpell;
  activeSpells: ActiveSpell[];
  
  // Custom resources
  customResources: CustomResource[];
}

interface MovementState {
  used: number;
  total: number;
  difficult: number;                 // Difficult terrain movement used
  hasDisengage: boolean;
  hasDash: boolean;
}

interface ActionState {
  hasAction: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
  freeActions: number;               // Free object interactions, etc.
}
```

### Initiative Order
```typescript
interface InitiativeOrder {
  participantId: string;
  initiative: number;
  tiebreaker: number;                // Dexterity modifier for ties
  isPlayer: boolean;
  isDelayed: boolean;                // Delayed action
  delayedUntil?: number;             // Round to resume action
}
```

## 🗺️ Combat Canvas & Positioning

### Combat Canvas Layout
```typescript
interface CombatCanvasLayout {
  // Canvas settings
  gridSize: number;                  // Feet per square
  showGrid: boolean;
  gridType: 'square' | 'hex' | 'none';
  
  // Canvas dimensions
  width: number;                     // In grid units
  height: number;                    // In grid units
  
  // Background
  backgroundImage?: string;
  backgroundColor: string;
  
  // Positioning data
  participantPositions: Map<string, Position>;
  staticElements: StaticElement[];   // Terrain, objects, etc.
  
  // Measurement tools
  measurements: Measurement[];
  aoeTemplates: AOETemplate[];
  
  // View state
  viewportCenter: Position;
  zoomLevel: number;
}

interface Position {
  x: number;                         // Grid coordinates
  y: number;
  z?: number;                        // Elevation (optional)
}

interface StaticElement {
  id: string;
  type: 'terrain' | 'object' | 'hazard' | 'marker';
  position: Position;
  size: { width: number; height: number };
  properties: Record<string, unknown>;
  isBlocking: boolean;               // Blocks movement
  provideCover: CoverType;
}

type CoverType = 'none' | 'half' | 'three-quarters' | 'full';
```

## 📝 Notes & Documentation

### Campaign Note
```typescript
interface CampaignNote {
  id: string;
  campaignId: string;
  sessionId?: string;                // Associated session
  
  // Content
  title: string;
  content: string;                   // Rich text content
  category: NoteCategory;
  tags: string[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;                // Only visible to DM
  isPinned: boolean;
  
  // Linking
  linkedCharacters: string[];        // Character IDs
  linkedEncounters: string[];        // Encounter IDs
  linkedSessions: string[];          // Session IDs
  
  // Canvas integration
  position?: Position;               // Position on notes canvas
  connections: string[];             // Connected note IDs
}

type NoteCategory = 
  | 'session'
  | 'npc' 
  | 'location' 
  | 'plot' 
  | 'rules' 
  | 'treasure' 
  | 'lore' 
  | 'reminder';
```

## 🎲 Dice & Automation

### Automated Action
```typescript
interface AutomatedAction {
  id: string;
  name: string;
  description: string;
  
  // Trigger conditions
  trigger: ActionTrigger;
  conditions: ActionCondition[];
  
  // Effects
  effects: ActionEffect[];
  
  // Automation settings
  isEnabled: boolean;
  confirmBeforeExecute: boolean;
  showNotification: boolean;
  
  // Usage tracking
  timesTriggered: number;
  lastTriggered?: Date;
}

interface ActionTrigger {
  type: 'turn_start' | 'turn_end' | 'round_start' | 'round_end' | 'damage_taken' | 'hp_threshold';
  targetType: 'self' | 'all' | 'players' | 'enemies' | 'specific';
  targetIds?: string[];
  parameters: Record<string, unknown>;
}

interface ActionEffect {
  type: 'damage' | 'heal' | 'condition' | 'resource' | 'notification' | 'dice_roll';
  parameters: Record<string, unknown>;
  message?: string;                  // Display message
}
```

## 📊 Analytics & Tracking

### Combat Participation Record
```typescript
interface CombatParticipationRecord {
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
```

### Campaign Statistics
```typescript
interface CampaignStatistics {
  campaignId: string;
  
  // Session data
  totalSessions: number;
  totalPlayTime: number;             // Minutes
  averageSessionLength: number;
  
  // Combat data
  totalEncounters: number;
  encountersByDifficulty: Record<EncounterDifficulty, number>;
  totalRounds: number;
  averageEncounterLength: number;
  
  // Character progression
  totalXPAwarded: number;
  averageCharacterLevel: number;
  characterDeaths: number;
  characterRevives: number;
  
  // Generated dates
  firstSession: Date;
  lastSession: Date;
  lastCalculated: Date;
}
```

## 🔧 Utility Types

### Common Enums
```typescript
enum EncounterDifficulty {
  TRIVIAL = 'trivial',
  EASY = 'easy', 
  MEDIUM = 'medium',
  HARD = 'hard',
  DEADLY = 'deadly',
  LEGENDARY = 'legendary'
}

enum EncounterOutcome {
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  RETREAT = 'retreat',
  NEGOTIATION = 'negotiation',
  INTERRUPTED = 'interrupted'
}

enum SyncStatus {
  SYNCED = 'synced',
  OUTDATED = 'outdated',
  CONFLICT = 'conflict',
  MANUAL = 'manual',
  ERROR = 'error'
}
```

### Generic Interfaces
```typescript
interface DMEntityBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

interface Trackable {
  isTracked: boolean;
  trackingStarted?: Date;
  trackingData?: Record<string, unknown>;
}

interface Exportable {
  exportFormat: 'json' | 'foundry' | 'roll20';
  exportData(): Record<string, unknown>;
  importData(data: Record<string, unknown>): boolean;
}
```

## 🔄 Data Migration

### Version Control
```typescript
interface DataVersion {
  major: number;
  minor: number;
  patch: number;
  beta?: number;
}

interface MigrationScript {
  fromVersion: DataVersion;
  toVersion: DataVersion;
  migrate: (data: unknown) => unknown;
  validate: (data: unknown) => boolean;
}
```

---

These data structures provide a comprehensive foundation for the DM Toolset while maintaining compatibility with existing character data. They support all planned features including campaign management, combat tracking, character import, and resource management.
