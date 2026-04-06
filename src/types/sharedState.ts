import type { CalendarConfig, WeatherType } from './calendar';
import type { InventoryItem } from './character';

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

// Full shared state envelope returned by GET
export interface SharedCampaignState {
  calendar: SharedCalendarPlayer | null;
  messages: DmMessage[];
  dmEffects: DmEffect[];
  customCounter: { label: string; value: number } | null;
  transfers: ItemTransfer[];
}

// POST body for DM pushing shared state
export interface SharedStateUpdateRequest {
  feature: string; // 'calendar' | 'message' | ...
  data: unknown;
  dmId: string;
}
