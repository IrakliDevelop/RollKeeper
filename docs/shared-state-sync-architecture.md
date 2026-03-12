# Shared State Sync Architecture

## Overview

Generic bidirectional DM-to-player shared state channel using Upstash Redis HTTP API. Calendar sync is the first feature; the architecture supports adding encounters, announcements, etc. with minimal new code.

## Data Flow

```
DM (CalendarView)
  ↓ calendarStore changes
  ↓ useDmCalendarSync (subscribes, debounces 2s)
  ↓ POST /api/campaign/{code}/shared { feature: "calendar", data, dmId }
  ↓ Redis: campaign:{code}:shared:calendar = SharedCalendar JSON

Player (PlayerCalendarView)
  ↑ useSharedCampaignState(campaignCode) polls every 15s
  ↑ GET /api/campaign/{code}/shared?role=player
  ↑ Returns: { calendar: SharedCalendarPlayer } (moons stripped, no events)
```

## Redis Key Structure

```
campaign:{code}                      → CampaignData (existing)
campaign:{code}:players              → Set of player IDs (existing)
campaign:{code}:player:{playerId}    → CampaignPlayerData (existing)
campaign:{code}:shared:calendar      → SharedCalendar (NEW)
campaign:{code}:shared:encounter     → SharedEncounter (future)
campaign:{code}:shared:announce      → SharedAnnouncement[] (future)
```

## API Endpoint

`/api/campaign/[code]/shared`

- **GET** `?role=player|dm` — reads all shared feature keys, filters for player role
- **POST** `{ feature, data, dmId }` — DM pushes a feature update (validates ownership)

## Adding a New Shared Feature

1. Add type to `src/types/sharedState.ts` + add field to `SharedCampaignState`
2. In GET handler: add pipeline read for the new key
3. Create `useDm{Feature}Sync` hook (same pattern as `useDmCalendarSync`)
4. Player UI: destructure from `useSharedCampaignState` — already returns the new field

No new API routes. No new player-side hooks.

## Calendar Sync Rules

- DM controls time exclusively (advance, start date, config)
- Players see: current date, season, config (minus moons)
- Players do NOT see: events, moon phases
- Player Long Rest: game mechanics only, no time advance
- Fallback: characters not in a campaign use local calendar as before
