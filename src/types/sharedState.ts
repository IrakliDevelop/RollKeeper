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

// Full shared state envelope returned by GET
export interface SharedCampaignState {
  calendar: SharedCalendarPlayer | null;
  // Future features:
  // encounter: SharedEncounter | null;
  // announcements: SharedAnnouncement[] | null;
}

// POST body for DM pushing shared state
export interface SharedStateUpdateRequest {
  feature: string; // 'calendar' | 'encounter' | ...
  data: unknown;
  dmId: string;
}
