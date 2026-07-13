import type { CalendarConfig, WeatherType } from './calendar';
import type { InventoryItem } from './character';
import type {
  ChessPiece,
  EnemyConditionsDisplay,
  EnemyHpDisplay,
} from './encounter';

// Stored in Redis — DM's calendar data (events stay local, not synced)
export interface SharedCalendar {
  config: CalendarConfig;
  currentTime: number;
  startTime: number;
  weather?: WeatherType;
  updatedAt: string; // ISO timestamp
}

// What players receive (moons stripped from config)
export interface SharedCalendarPlayer {
  config: CalendarConfig; // config.moons will be []
  currentTime: number;
  startTime: number;
  weather?: WeatherType;
  updatedAt: string;
}

// DM-to-player message stored in Redis
export interface DmMessage {
  id: string;
  title: string;
  content: string; // HTML rich text
  sentAt: string; // ISO timestamp
}

// DM condition override on a player (synced from encounter)
export interface DmEffect {
  id: string;
  name: string;
  action: 'add' | 'remove';
  description?: string;
  sourceSpell?: string;
  appliedAt: string; // ISO timestamp
}

// Item transfer queued for a player (auto-merges on next poll)
export interface ItemTransfer {
  id: string;
  item: InventoryItem;
  fromPlayerName: string;
  fromCharacterName: string;
  fromType: 'player' | 'npc';
  sentAt: string; // ISO timestamp
}

// DM custom counter synced per-player (e.g. "Desperation Points")
export interface SharedCustomCounter {
  label: string;
  counters: Record<string, number>; // playerId → value
  updatedAt: string; // ISO timestamp
}

// Display-only projection of an EncounterCondition. Deliberately excludes
// id, duration, rounds, sourceEntity, sourceSpell, and source — none of
// that leaves the DM.
export interface SharedCondition {
  name: string;
  kind?: 'buff' | 'debuff' | 'neutral';
  stackCount?: number;
}

// A single combatant row shown to players during combat
export interface SharedTurnEntry {
  entityId: string;
  displayName: string; // real name, or "Enemy" when hidden && non-player
  type: 'player' | 'monster' | 'npc' | 'lair';
  playerCharacterId?: string; // player entities only — marks "you" + identity
  currentHp?: number; // players always; non-players only when enemyHpMode is 'exact'
  maxHp?: number; // players always; non-players only when enemyHpMode is 'exact'
  hpState?: string; // non-players when enemyHpMode is 'label' (e.g. "Bloodied")
  hpPercent?: number; // non-players when enemyHpMode is 'bar' | 'percent' (0-100)
  // Coarse health tier for colour-coding any shown enemy HP indicator. Set for
  // non-players whenever enemyHpMode !== 'off' (kept coarse so 'label' mode does
  // not leak an exact percentage).
  hpTier?: 'high' | 'mid' | 'low' | 'critical';
  isDead?: boolean; // current HP <= 0 (players always; enemies when HP is shared)
  disposition?: 'ally' | 'enemy' | 'neutral'; // player-facing allegiance (non-players)
  // DM-assigned map-correlation identity — lets players match a token on the
  // battle map to its initiative row even when the entity is a hidden enemy;
  // that correlation is the whole purpose, so it's safe to always share.
  chessPiece?: ChessPiece;
  tokenColor?: string;
  // Active conditions. Players always; non-players only when the DM's
  // enemyConditionsDisplay is 'on' (hidden enemies included — a visible
  // "prone" marker is fiction-visible information).
  conditions?: SharedCondition[];
  // Boolean only — the concentrated spell's name never leaves the DM.
  isConcentrating?: boolean;
}

// Initiative/turn state pushed by the DM, read by players
export interface SharedInitiativeState {
  encounterId: string;
  isActive: boolean;
  round: number;
  currentEntityId: string | null;
  turnOrder: SharedTurnEntry[];
  // How non-player HP is presented to players; tells the panel how to render
  // hpState / hpPercent / currentHp on enemy rows. Defaults to 'off'.
  enemyHpMode: EnemyHpDisplay;
  // Whether non-player conditions/concentration are being shared.
  enemyConditionsMode: EnemyConditionsDisplay;
  updatedAt: string; // ISO timestamp
}

// Player → DM request to advance past their own turn
export interface TurnEndRequest {
  encounterId: string;
  round: number;
  entityId: string;
  playerId: string;
  requestedAt: string; // ISO timestamp
}

// DM → players request to roll initiative
export interface InitiativeRollRequest {
  requestId: string; // crypto.randomUUID() per request; re-requesting mints a new one
  encounterId: string;
  encounterName: string; // shown in the player prompt
  requestedAt: number; // Date.now()
}

// Player → DM initiative submission (stored per player under one shared key)
export interface InitiativeSubmission {
  requestId: string;
  playerId: string; // characterId (matches EncounterEntity.playerCharacterId)
  value: number; // FINAL total — modifier already included
  submittedAt: number;
}

// Live battle map activation (DM → players via shared state)
export interface SharedBattleMapState {
  activeBattleMapId: string | null;
  name?: string;
  updatedAt: string;
}

// Full shared state envelope returned by GET
export interface SharedCampaignState {
  calendar: SharedCalendarPlayer | null;
  messages: DmMessage[];
  dmEffects: DmEffect[];
  customCounter: { label: string; value: number } | null;
  transfers: ItemTransfer[];
  initiative: SharedInitiativeState | null;
  battleMap: SharedBattleMapState | null;
  initiativeRequest: InitiativeRollRequest | null;
}

// POST body for DM pushing shared state
export interface SharedStateUpdateRequest {
  feature: string; // 'calendar' | 'message' | ...
  data: unknown;
  dmId: string;
}
