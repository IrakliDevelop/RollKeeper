// Encounter tracker types for DM combat management

export interface EncounterCondition {
  id: string;
  name: string;
  description?: string;
  duration?: string; // "Until end of next turn", "1 minute", etc.
  sourceEntity?: string; // Who applied this
  sourceSpell?: string; // What spell caused this
  stackCount?: number;
  source?: 'player-sync' | 'dm'; // Where this condition came from
}

export interface MonsterAbility {
  id: string;
  name: string;
  description: string;
  usageType: 'unlimited' | 'recharge' | 'per-rest' | 'per-day';
  rechargeOn?: number; // Recharge 5-6 means 5
  maxUses?: number;
  usedUses: number;
  restType?: 'short' | 'long' | 'dawn';
}

export interface LegendaryActionPool {
  maxActions: number;
  usedActions: number;
  actions: Array<{
    id: string;
    name: string;
    cost: number;
    description: string;
  }>;
}

export interface MonsterSpellcasting {
  ability: string;
  dc: number;
  toHit: number;
  atWill: string[];
  perDay: Record<string, string[]>; // "3": ["fireball", "lightning bolt"]
  slots?: Record<string, { max: number; used: number }>; // Spell slots by level
  usedSpells: Record<string, number>; // Track per-day usage
}

export interface MonsterStatBlock {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  saves: string;
  skills: string;
  speed: string;
  resistances: string;
  immunities: string;
  vulnerabilities: string;
  conditionImmunities: string[];
  senses: string;
  passivePerception: number;
  traits: Array<{ name: string; text: string }>;
  actions: Array<{ name: string; text: string }>;
  reactions: Array<{ name: string; text: string }>;
  bonusActions: Array<{ name: string; text: string }>;
  lairActions: Array<{ name: string; text: string }>;
  cr: string;
  type: string;
  size: string;
  languages: string;
  alignment: string;
  hpFormula: string;
}

export type EntityType = 'player' | 'npc' | 'monster' | 'lair';

export type ChessPiece =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn';

export interface EncounterEntity {
  id: string;
  type: EntityType;
  name: string;
  initiative: number | null;
  initiativeModifier: number;

  // Combat stats
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;

  // Conditions
  conditions: EncounterCondition[];
  concentrationSpell?: string;

  // For monsters/NPCs
  abilities?: MonsterAbility[];
  legendaryActions?: LegendaryActionPool;
  spellcasting?: MonsterSpellcasting;

  // Monster source reference
  monsterSourceId?: string; // ProcessedMonster id for stat block lookup
  monsterStatBlock?: MonsterStatBlock; // Full stat block for display

  // Lair action specific
  lairActions?: Array<{
    id: string;
    name: string;
    description: string;
    usedThisRound: boolean;
  }>;
  regionalEffects?: string[];

  // Player-synced (read-only for DM)
  inspirationCount?: number; // Heroic inspiration dice from player
  deathSaves?: { successes: number; failures: number; isStabilized: boolean };
  hasUsedReaction?: boolean; // Whether player has used their reaction this round

  // Player-synced defenses & senses
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses?: Array<{ name: string; range: number; source?: string }>;

  // DM condition authority: player-synced conditions the DM explicitly removed
  suppressedConditions?: string[];

  // Visual
  color?: string; // For grouping same monsters
  isHidden?: boolean; // DM can hide from players
  chessPiece?: ChessPiece; // Chess piece icon for map correlation

  // Player sync reference
  playerCharacterId?: string; // Link to playerStore character
  campaignCode?: string; // Campaign for live sync

  // Summon sync reference (auto-managed via player sync)
  summonId?: string; // Links to Summon.id from character's summons[]
  summonOwnerId?: string; // playerCharacterId of the summoning player
}

export interface Encounter {
  id: string;
  name: string;
  campaignCode?: string;

  // Combat state
  entities: EncounterEntity[];
  currentTurn: number; // Index in sorted initiative order
  round: number;
  isActive: boolean;

  // Settings
  sortOrder: 'initiative' | 'manual';
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CampaignNPC {
  id: string;
  campaignCode: string;
  name: string;
  description?: string;

  // Core combat stats
  armorClass: number;
  maxHp: number;
  speed: string;

  // Full stat block (from bestiary import or manual entry)
  monsterStatBlock?: MonsterStatBlock;
  bestiarySourceId?: string;

  // Lore (DM-written HTML from rich text editor)
  loreHtml?: string;

  // Portrait (S3 URL)
  avatarUrl?: string;

  // Legacy fields (backward compat, superseded by monsterStatBlock when present)
  abilityScores?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  traits?: string[];
  actions?: string[];

  createdAt: string;
  updatedAt: string;
}
