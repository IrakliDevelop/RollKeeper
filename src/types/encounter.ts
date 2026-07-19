// Encounter tracker types for DM combat management

import { Spell } from './character';

export interface EncounterCondition {
  id: string;
  name: string;
  description?: string;
  duration?: string; // "Until end of next turn", "1 minute", etc.
  sourceEntity?: string; // Who applied this
  sourceSpell?: string; // What spell caused this
  stackCount?: number;
  source?: 'player-sync' | 'dm'; // Where this condition came from
  kind?: 'buff' | 'debuff' | 'neutral';
  rounds?: number | null; // remaining rounds; null/undefined = untimed (∞)
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

export type NPCSpellcastingAbility = 'intelligence' | 'wisdom' | 'charisma';

export interface NPCSpellSlotOverrides {
  [level: number]: number;
}

export interface NPCSpellcasting {
  casterLevel: number;
  ability: NPCSpellcastingAbility;
  spellAttackBonus?: number;
  spellSaveDC?: number;
  slotOverrides?: NPCSpellSlotOverrides;
  slotsUsed: Record<number, number>;
  spells: Spell[];
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
  traits: Array<{ name: string; text: string; uses?: number }>;
  actions: Array<{ name: string; text: string; uses?: number }>;
  reactions: Array<{ name: string; text: string; uses?: number }>;
  bonusActions: Array<{ name: string; text: string; uses?: number }>;
  lairActions: Array<{ name: string; text: string; uses?: number }>;
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

// Player-facing allegiance for a DM-controlled combatant (lets a villain be
// disguised as an ally until the DM reveals the twist).
export type PlayerDisposition = 'ally' | 'enemy' | 'neutral';

/** Token side length in grid cells: Tiny/Small/Medium 1, Large 2, Huge 3, Gargantuan 4. */
export type TokenCellSize = 1 | 2 | 3 | 4;

export interface EncounterEntity {
  id: string;
  type: EntityType;
  name: string;
  initiative: number | null;
  initiativeModifier: number;
  proficiencyBonus?: number; // Auto-derived from CR for monsters; overridable by DM

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
  npcSourceId?: string; // CampaignNPC.id for persistent NPC lookup

  // Lair action specific
  lairActions?: Array<{
    id: string;
    name: string;
    description: string;
    usedThisRound: boolean;
  }>;
  regionalEffects?: string[];

  // NPC hit dice (for short rest healing in encounters)
  hitDice?: { current: number; max: number; dieType: string };

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
  avatarUrl?: string; // Portrait shown on DM VTT roster/tokens (players, NPCs, monsters)
  isHidden?: boolean; // DM can hide the real name from players (they see a generic label)
  playerAlias?: string; // Optional name players see instead (DM-controlled entities); takes precedence over the hidden generic label
  playerDisposition?: PlayerDisposition; // Allegiance players see (disguise); defaults to enemy for non-players
  chessPiece?: ChessPiece; // Chess piece icon for map correlation
  tokenSize?: TokenCellSize; // Battle-map token footprint; absent = 1 (no migration needed)

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

  // Active "roll initiative" request sent to players during setup (null/absent = none).
  // Persisted so a DM reload keeps the waiting-list; Redis carries the transport copy.
  pendingInitiativeRequest?: { requestId: string; requestedAt: number } | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// How much of an enemy's (non-player) HP players may see during combat.
export type EnemyHpDisplay = 'off' | 'label' | 'bar' | 'percent' | 'exact';

// Whether players may see non-player conditions and concentration status.
export type EnemyConditionsDisplay = 'on' | 'off';

// A named HP band shown to players when enemyHpDisplay is 'label'. `minPercent`
// is the lowest HP percentage (inclusive) at which this label applies.
export interface HpStateBand {
  minPercent: number;
  label: string;
}

// Global, DM-controlled combat settings (shared across all encounters).
export interface CombatConfig {
  enemyHpDisplay: EnemyHpDisplay;
  hpStateBands: HpStateBand[];
  enemyConditionsDisplay: EnemyConditionsDisplay;
}

export const DEFAULT_HP_STATE_BANDS: HpStateBand[] = [
  { minPercent: 100, label: 'Unharmed' },
  { minPercent: 75, label: 'Healthy' },
  { minPercent: 50, label: 'Injured' },
  { minPercent: 25, label: 'Bloodied' },
  { minPercent: 1, label: 'Near Death' },
  { minPercent: 0, label: 'Down' },
];

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  enemyHpDisplay: 'off',
  hpStateBands: DEFAULT_HP_STATE_BANDS,
  enemyConditionsDisplay: 'off',
};

export interface NPCInventoryItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
  equipped?: boolean;
  type?: string; // weapon, armor, potion, wondrous, etc.
  category?: string; // weapon, armor, tool, consumable, treasure, misc
  weight?: number; // per item in lbs
  value?: number; // per item in copper pieces
  rarity?: string; // common, uncommon, rare, very rare, legendary, artifact
}

export interface CampaignNPC {
  id: string;
  campaignCode: string;
  name: string;
  description?: string;

  // Core combat stats
  armorClass: number;
  maxHp: number;
  currentHp?: number; // Persistent HP tracking (defaults to maxHp if undefined)
  tempHp?: number; // Temporary HP
  speed: string;

  // Full stat block (from bestiary import or manual entry)
  monsterStatBlock?: MonsterStatBlock;
  bestiarySourceId?: string;

  // Lore (DM-written HTML from rich text editor)
  loreHtml?: string;

  // Portrait (S3 URL)
  avatarUrl?: string;

  // Grouping & organization
  group?: string;
  tags?: string[];

  // Hit dice
  hitDice?: { current: number; max: number; dieType: string };

  // Death saves (for encounter tracking)
  deathSaves?: { successes: number; failures: number };

  // Initiative modifier (defaults to DEX modifier when not set)
  initiativeModifier?: number;

  // Proficiency bonus (auto-calculated from CR, overridable)
  proficiencyBonus?: number;

  // Inventory
  inventory?: NPCInventoryItem[];

  // Spellcasting
  spellcasting?: NPCSpellcasting;

  // UI state: which spell tab sections are collapsed
  collapsedSpellSections?: string[]; // e.g. ['stats', 'slotTracker', 'spells']

  // UI state: last viewed detail tab
  lastDetailTab?: 'stats' | 'spells' | 'inventory' | 'lore';

  // Passive abilities
  passivePerception?: number;
  passiveInsight?: number;
  passiveInvestigation?: number;

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
