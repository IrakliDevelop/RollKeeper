# DM Location Map

## Overview

A DM-facing location map editor built on the FieldNotes canvas SDK (v0.7.0), allowing DMs to upload a map image and annotate it with text labels, shapes, arrows, notes, additional images, and an optional distance grid overlay. Players see a read-only, pannable/zoomable view of the map in a new "Map" tab on their character sheet.

This is **not** a battle map — no initiative, no token movement, no tactical grid snapping. Battle maps are a separate future feature.

## Data Model

### `LocationMap` type (`src/types/location.ts`)

```typescript
interface LocationMap {
  id: string;
  campaignCode: string;
  name: string;
  mapImageUrl: string;            // S3 URL of the background map image
  mapImageSize: { w: number; h: number };
  canvasState: string;            // viewport.exportJSON() — serialized JSON string
  dmOnlyElements: Record<string, boolean>; // elementId → true
  gridEnabled: boolean;
  gridSettings?: {
    gridType: 'square' | 'hex';
    hexOrientation?: 'pointy' | 'flat';
    cellSize: number;
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Store: `locationStore` (`src/store/locationStore.ts`)

Zustand + localStorage (`rollkeeper-location-data`). Campaign-scoped — stored as `Record<string, Record<string, LocationMap>>` (campaignCode → locationId → LocationMap) for efficient lookup without iterating large canvas state strings.

**Actions:**
- `addLocation(campaignCode, location)` — create new
- `updateLocation(campaignCode, locationId, updates)` — partial update (canvas state, grid, etc.)
- `removeLocation(campaignCode, locationId)` — delete
- `getLocation(campaignCode, locationId)` — get single
- `getLocations(campaignCode)` — list all for campaign
- `toggleDmOnly(campaignCode, locationId, elementId)` — toggle element DM-only visibility
- `setDmOnly(campaignCode, locationId, elementId, dmOnly)` — set explicitly

### DM-Only Element Filtering

When syncing to Redis, `canvasState` (a serialized JSON string) is parsed, elements whose IDs appear in `dmOnlyElements` are removed from the elements array, and the result is re-serialized. The SDK's `exportJSON()` produces a stable format with a top-level `elements` array, making this safe to post-process. Alternatively, the implementation may use `viewport.store` to programmatically remove elements before calling `exportJSON()` on a clone — whichever is cleaner.

## DM Flow

### Routes

- `/dm/campaign/[code]/locations` — Location list page
- `/dm/campaign/[code]/locations/[id]` — Canvas editor for a single location

### Campaign Detail Page Integration

Replace the player count card on the DM campaign detail page (`/dm/campaign/[code]`) with a "Locations" card, using the `Map` icon from lucide-react, linking to `/dm/campaign/[code]/locations`.

**Page order:** **Locations** → Banner → Calendar → Encounters

### Creating a Location

1. DM clicks "New Location" on the locations list page
2. Dialog: enter name + upload map image
3. Image uploads to S3 via `/api/assets/upload`
4. Redirects to canvas editor with the map image locked on the base layer
5. Camera bounds set to image dimensions

### Canvas Editor

**Tools (trimmed from prototype):**
- Hand — pan/zoom
- Select — move/resize elements
- Text — label locations, landmarks
- Note — DM annotations (can be marked DM-only)
- Shape — highlight areas (rectangle/ellipse)
- Image — additional markers/icons (uploaded to S3, stored as absolute S3 URLs)
- Arrow — routes, connections

**Toolbar actions:**
- Undo / Redo
- Delete selected element
- Clear canvas
- Grid toggle (opens grid settings: square/hex, cell size, opacity)
- DM-only toggle (when element selected — eye icon)
- Sync to Players button (manual push to Redis)

**Right panel (collapsible):** Layers panel — reuse pattern from prototype (visibility, lock, reorder, rename).

**Contextual options bar:** Below toolbar, shows tool-specific settings (color, size, shape kind, text alignment, etc.) — same pattern as prototype.

**Saving:**
- AutoSave to `locationStore` (localStorage) via SDK `AutoSave` class — same as prototype
- Manual "Sync to Players" button pushes filtered canvas state to Redis
- DM has full control over when players see map updates

### DM-Only Elements

- Any element can be toggled as `dmOnly` via the select tool context
- Stored in `LocationMap.dmOnlyElements` map (elementId → boolean)
- When syncing to Redis, elements with `dmOnly === true` are stripped from the canvas state JSON (see "DM-Only Element Filtering" above)
- DM sees all elements; players never receive hidden elements

## Player View

### Character Sheet Integration

- New "Map" tab in `BookmarkTabs` (`tabbedSheetConfig.tsx`)
- Tab visibility is conditional: `useLocationSync` hook polls the metadata endpoint on mount; if the response contains at least one location, the tab renders. Before the first poll completes, the tab is hidden (avoids flicker).
- If multiple locations: shows a list with cards (name + map image as thumbnail)
- If single location: renders the map directly

### Map Rendering

- Read-only `FieldNotesCanvas` with only `HandTool` registered
- Loads filtered canvas state JSON from Redis (no `dmOnly` elements)
- Camera bounds clamped to map image dimensions
- Grid overlay visible if DM enabled it

### Loading & Error States

- **Loading:** Spinner while fetching canvas state for a specific map
- **Expired/missing data:** "No map available" message if Redis data has expired or is empty
- **Image 404:** Canvas renders remaining elements; broken image shows placeholder (SDK handles missing images gracefully)

### Sync

- `useLocationSync` hook polls `/api/campaign/[code]/locations` for metadata
- Fetches full canvas state when viewing a specific map
- Reuses idle/visibility detection pattern from `useCampaignSync`

## API & Redis

### Redis Keys

- `campaign:{code}:locations` — JSON array of location metadata (`{ id, name, mapImageUrl, updatedAt }[]`)
- `campaign:{code}:location:{id}` — Full filtered canvas state JSON for a specific location

**Key helpers:** Add `campaignLocationsKey(code)` and `campaignLocationKey(code, id)` to `src/lib/redis.ts`. Include both in `refreshCampaignTTL` so location data gets the same sliding TTL as other campaign data.

### Why Dedicated Routes (Not `/shared`)

The existing `/api/campaign/[code]/shared` route is designed for small key-value pairs (calendar, counters, effects) using a pipeline read-modify-write pattern. Location canvas state is a large JSON blob (potentially hundreds of KB) and is addressed per-location-ID. Dedicated routes avoid overloading the shared pipeline and give cleaner per-location CRUD semantics.

### API Routes

All under `src/app/api/campaign/[code]/locations/`:

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/campaign/[code]/locations` | List location metadata | Any campaign member |
| `GET` | `/api/campaign/[code]/locations/[id]` | Full canvas state for one location | Any campaign member |
| `POST` | `/api/campaign/[code]/locations/[id]` | DM pushes filtered state to Redis | DM only (verify dmId) |
| `DELETE` | `/api/campaign/[code]/locations/[id]` | Remove location from Redis | DM only (verify dmId) |

**DM verification:** POST and DELETE routes read the campaign record from Redis and compare the `dmId` field, following the same pattern as the existing shared route (`src/app/api/campaign/[code]/shared/route.ts`).

All routes call `refreshCampaignTTL` to keep the sliding TTL alive.

## Component Structure

```
src/types/location.ts
src/store/locationStore.ts
src/hooks/useLocationSync.ts              # Player-side polling
src/lib/redis.ts                          # Add key helpers + TTL refresh

src/components/ui/campaign/location-map/
  DmLocationEditor.tsx                    # Full canvas editor (DM)
  DmLocationEditor.hooks.ts              # Canvas setup, tools, autosave
  DmLocationEditor.types.ts
  DmLocationToolbar.tsx                   # Toolbar + actions
  DmLocationToolbar.types.ts
  DmOnlyToggle.tsx                        # Per-element visibility toggle
  PlayerLocationView.tsx                  # Read-only canvas (player)
  LocationListCard.tsx                    # Card for list pages

src/app/dm/campaign/[code]/locations/
  page.tsx                                # Location list
  [id]/page.tsx                           # Canvas editor

# Player tab component registered in tabbedSheetConfig.tsx
```

## Key Decisions

- **Upload-first flow** — DM must provide a map image to create a location; image defines camera bounds
- **Manual sync to players** — DM controls when players see map updates; local autosave keeps DM work safe
- **Per-element DM-only** — Any element can be hidden from players, not just notes
- **Read-only player canvas** — Full pan/zoom with `HandTool` only; no editing tools registered
- **S3 for images** — All canvas images (map background + additional) uploaded to S3 as absolute URLs to avoid localStorage quota issues and ensure URLs work in both DM and player contexts
- **Grid as canvas element** — Uses SDK 0.7.0 `GridElement` (square/hex), visible to both DM and players
- **Record-based store** — `Record<campaignCode, Record<locationId, LocationMap>>` for O(1) lookups
- **Dedicated API routes** — Separate from `/shared` due to large payload size and per-location addressing

## Known Limitations

- **No S3 cleanup on deletion** — Deleting a location does not remove its images from S3. Images are cheap and few; a cleanup job can be added later if needed.
- **No canvas state compression** — Canvas state JSON is stored uncompressed in Redis. For a location map with S3 image URLs (not base64), the JSON is expected to stay well under 1MB. If this becomes an issue, gzip compression can be added to the POST/GET routes.
- **Thumbnails use map image** — Location list cards use the `mapImageUrl` directly as a thumbnail, not a rendered snapshot of the annotated map. This is simpler and avoids canvas-to-image rendering complexity.

## Verification

1. `npm run type-check` — no errors
2. `npm run lint` — no new warnings
3. Manual testing:
   - DM creates location with map image upload
   - Canvas editor: place text, notes, shapes, arrows on map
   - Toggle elements as DM-only, verify they disappear from player view
   - Enable grid overlay, verify visible on both sides
   - Sync to players, verify player sees filtered map
   - Player can pan/zoom but not edit
   - Multiple locations per campaign work correctly
   - AutoSave persists DM work across page reloads
   - Location data survives campaign TTL refresh cycle
