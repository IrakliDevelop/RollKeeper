# Combat Battle Maps — Design Spec

**Date:** 2026-03-25
**Status:** Draft

## Overview

Battle Maps are a new campaign feature that lets the DM create annotated combat maps and display them fullscreen on a shared TV/monitor at the gaming table. Physical miniatures are placed directly on the monitor — no digital tokens or combat effects needed.

The DM edits the map on their laptop and pushes updates to the TV display on demand. Maps can be linked to encounters for bookkeeping.

## Physical Setup

- DM has a laptop with the editor open
- A TV/monitor is on the table, connected to the DM's laptop as a secondary display
- DM opens the TV display page in a separate browser window and drags it to the TV
- Players place physical miniatures on the TV screen

## Data Model

### BattleMap (local store)

```typescript
interface BattleMap {
  id: string;
  campaignCode: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  canvasState: string;                    // FieldNotes canvas JSON
  dmOnlyElements: Record<string, boolean>;
  gridEnabled: boolean;
  gridSettings?: GridSettings;            // reuse existing GridSettings type
  linkedEncounterIds: string[];           // encounter IDs this map was used for
  createdAt: string;
  updatedAt: string;
}
```

### SyncedBattleMap (sent to TV display via BroadcastChannel + Redis)

```typescript
interface SyncedBattleMap {
  id: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  snapshotUrl?: string;                   // PNG render (DM-only elements excluded)
  canvasState: string;                    // fallback if image export fails
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  updatedAt: string;
}
```

### Storage

- **Local:** `battleMapStore` — Zustand + localStorage (key: `rollkeeper-battlemap-data`), campaign-scoped, same structure as `locationStore`
- **Remote:** Redis key `campaign:{code}:battlemap:{id}` — stores `SyncedBattleMap` JSON, sliding TTL (same as locations)

## Routes

| Route | Purpose |
|---|---|
| `/dm/campaign/[code]/battlemaps` | Battle map list page |
| `/dm/campaign/[code]/battlemaps/[id]` | Battle map editor (reuses `DmLocationEditor` with `mode="battlemap"`) |
| `/dm/campaign/[code]/battlemaps/[id]/display` | TV display page — pure fullscreen map, no UI |
| `GET /api/campaign/[code]/battlemaps/[id]` | Fetch synced battle map from Redis |
| `POST /api/campaign/[code]/battlemaps/[id]` | Push synced battle map to Redis |
| `DELETE /api/campaign/[code]/battlemaps/[id]` | Delete battle map from Redis |

## Editor: Mode Flag

The existing `DmLocationEditor` component gains a `mode` prop:

```typescript
type EditorMode = 'location' | 'battlemap';
```

### What changes per mode

| Feature | Location Mode | Battle Map Mode |
|---|---|---|
| Primary action button | "Sync to Players" (blue) | "Push to Display" (green) |
| Extra button | Download export | "Open TV Display" (opens new tab) |
| Sync mechanism | Redis only | BroadcastChannel + Redis |
| Encounter linking | None | Dropdown in side panel |
| Canvas & tools | Identical | Identical |
| Store | `locationStore` | `battleMapStore` |

### Sync flow (Battle Map mode)

When DM clicks "Push to Display":

1. Export canvas as PNG via `exportImage()` (filter out DM-only elements), with JSON fallback on failure
2. Post `SyncedBattleMap` to BroadcastChannel `battlemap:{campaignCode}:{id}` for instant local delivery
3. POST to `/api/campaign/{code}/battlemaps/{id}` for Redis persistence (recovery on page reload)
4. Update sync status indicator (same pattern as location sync)

### Encounter linking UI

- Located in the layers/info side panel (not toolbar — avoids clutter)
- Dropdown populated from `encounterStore.getEncountersByCampaign(campaignCode)`
- Selected encounters shown as removable badges below the dropdown
- Stored as `linkedEncounterIds` on the `BattleMap`
- Encounter list page shows a "Map: [name]" read-only reference when a map links to it
- Linking is stored on the battle map side only — encounters don't hold a back-reference. Derived by scanning battle maps when needed.

## TV Display Page

**Route:** `/dm/campaign/[code]/battlemaps/[id]/display`

### Behavior

1. **On load:** GET `/api/campaign/{code}/battlemaps/{id}` from Redis. Render snapshot image if available, otherwise show "Waiting for DM to push map..." on black background.
2. **Live updates:** Subscribe to `BroadcastChannel('battlemap:{campaignCode}:{id}')`. On message, replace current image immediately.
3. **Recovery:** If BroadcastChannel misses a message (tab was closed/reopened), Redis fetch on load recovers latest state.

### Rendering

- Pure black (`#000`) background, full viewport
- Snapshot image rendered with `object-fit: contain` — auto-sizes to monitor resolution without distortion
- No UI chrome — no buttons, no header, no cursor (`cursor: none`)
- Scroll wheel to zoom in/out (same 0.9x / 1.1x factor as player lightbox)
- Click + drag to pan when zoomed in
- Double-click to reset to fit-to-screen
- `F` key toggles browser Fullscreen API
- `Escape` exits fullscreen (browser native)

## Battle Map List Page

**Route:** `/dm/campaign/[code]/battlemaps`

### Layout

- Grid of cards (1–4 columns responsive) — same pattern as location list
- Each card shows: map thumbnail, name, linked encounter count badge (e.g., "2 encounters"), delete button
- "New Battle Map" button opens creation dialog

### Creation dialog

- Name input + file upload (dashed drop zone, same as location creation)
- On submit: upload image to S3, extract dimensions, create `BattleMap` in store, redirect to editor

### Delete

- Confirmation prompt
- Removes from `battleMapStore` and DELETEs from Redis

## Campaign Dashboard Integration

- New "Battle Maps" card on the campaign dashboard hero section, alongside Locations, Calendar, and Encounters
- Links to `/dm/campaign/[code]/battlemaps`

## Encounter List Integration

- Encounter cards that have a linked battle map show a small map badge/icon with the map name
- Clicking the badge navigates to the battle map editor
- Read-only reference — linking is managed from the battle map side

## What This Feature Does NOT Include

- No digital tokens or entity markers on the map (physical miniatures are used)
- No fog of war or line-of-sight mechanics
- No player phone/tablet view of battle maps (locations handle that use case; Redis persistence leaves the door open for future)
- No real-time streaming of DM edits — push-on-demand only
- No initiative tracker sidebar on the TV display
