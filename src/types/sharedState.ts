import type { CalendarConfig } from './calendar';

// Stored in Redis — DM's calendar data (events stay local, not synced)
export interface SharedCalendar {
  config: CalendarConfig;
  currentTime: number;
  startTime: number;
  updatedAt: string; // ISO timestamp
}

// What players receive (moons stripped from config)
export interface SharedCalendarPlayer {
  config: CalendarConfig; // config.moons will be []
  currentTime: number;
  startTime: number;
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
}

// POST body for DM pushing shared state
export interface SharedStateUpdateRequest {
  feature: string; // 'calendar' | 'message' | ...
  data: unknown;
  dmId: string;
}
