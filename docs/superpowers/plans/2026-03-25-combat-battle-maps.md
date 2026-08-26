# Combat Battle Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Battle Maps feature that lets the DM create canvas-based combat maps and display them fullscreen on a shared TV/monitor, with push-on-demand updates and encounter linking.

**Architecture:** Reuse the existing `DmLocationEditor` canvas component with a `mode` flag to switch between location and battle map behavior. New `battleMapStore` mirrors `locationStore` structure. TV display page uses BroadcastChannel for instant local updates with Redis for persistence/recovery. Encounter linking stored on battle map side only.

**Tech Stack:** Next.js App Router, Zustand + localStorage, @fieldnotes/core + @fieldnotes/react, Upstash Redis, BroadcastChannel API, S3 (image upload)

**Spec:** `docs/superpowers/specs/2026-03-25-combat-battle-maps-design.md`

---

## File Map

### New files

| File | Purpose |
|---|---|
| `src/types/battlemap.ts` | BattleMap, BattleMapMetadata, SyncedBattleMap interfaces |
| `src/store/battleMapStore.ts` | Zustand store — campaign-scoped battle map CRUD + encounter linking |
| `src/app/api/campaign/[code]/battlemaps/route.ts` | GET — list battle map metadata from Redis |
| `src/app/api/campaign/[code]/battlemaps/[id]/route.ts` | GET/POST/DELETE — individual battle map sync via Redis |
| `src/app/dm/campaign/[code]/battlemaps/page.tsx` | Battle map list page |
| `src/app/dm/campaign/[code]/battlemaps/[id]/page.tsx` | Battle map editor page (wraps DmLocationEditor in battlemap mode) |
| `src/app/dm/campaign/[code]/battlemaps/[id]/display/page.tsx` | TV display page — fullscreen map with BroadcastChannel listener |
| `src/components/ui/campaign/battle-map/BattleMapListCard.tsx` | Card component for battle map list |
| `src/components/ui/campaign/battle-map/EncounterLinkingPanel.tsx` | Encounter linking dropdown + badges for battlemap editor sidebar |

### Modified files

| File | Changes |
|---|---|
| `src/lib/redis.ts` | Add `campaignBattleMapsKey`, `campaignBattleMapKey`, update `refreshCampaignTTL` |
| `src/store/encounterStore.ts` | Add `getEncountersByCampaign()` method |
| `src/components/ui/campaign/location-map/DmLocationEditor.types.ts` | Add `mode` prop, generalize `location` prop type |
| `src/components/ui/campaign/location-map/DmLocationEditor.hooks.ts` | Mode-aware sync (BroadcastChannel + Redis for battlemap), mode-aware store references |
| `src/components/ui/campaign/location-map/DmLocationEditor.tsx` | Pass mode through, conditionally render encounter linking panel |
| `src/components/ui/campaign/location-map/DmLocationToolbar.tsx` | Mode-aware button labels and "Open TV Display" button |
| `src/components/ui/campaign/location-map/DmLocationToolbar.types.ts` | Add mode-related props |
| `src/app/dm/campaign/[code]/page.tsx` | Add "Battle Maps" hero card |
| `src/components/ui/encounter/EncounterList.tsx` | Show linked battle map badge on encounter cards |

---

## Task 1: Types & Prerequisites

**Files:**
- Create: `src/types/battlemap.ts`
- Modify: `src/store/encounterStore.ts`

- [ ] **Step 1: Create battle map types**

Create `src/types/battlemap.ts` with all three interfaces. Import and reuse `GridSettings` from `location.ts`.

```typescript
import type { GridSettings } from './location';

export interface BattleMap {
  id: string;
  campaignCode: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  canvasState: string;
  dmOnlyElements: Record<string, boolean>;
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  linkedEncounterIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BattleMapMetadata {
  id: string;
  name: string;
  mapImageUrl: string;
  updatedAt: string;
}

export interface SyncedBattleMap {
  id: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  snapshotUrl?: string;
  canvasState: string;
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  updatedAt: string;
}
```

- [ ] **Step 2: Add `getEncountersByCampaign` to encounterStore**

In `src/store/encounterStore.ts`, add to the state interface and implementation:

```typescript
// In EncounterStoreState interface:
getEncountersByCampaign: (campaignCode: string) => Encounter[];

// In the store implementation:
getEncountersByCampaign: (campaignCode) => {
  return get().encounters.filter(e => e.campaignCode === campaignCode);
},
```

- [ ] **Step 3: Verify types compile**

Run: `npm run type-check 2>&1 | grep -E "battlemap|encounterStore" | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/types/battlemap.ts src/store/encounterStore.ts
git commit -m "feat(battlemaps): add types and encounterStore.getEncountersByCampaign"
```

---

## Task 2: Battle Map Store

**Files:**
- Create: `src/store/battleMapStore.ts`

- [ ] **Step 1: Create the store**

Mirror `src/store/locationStore.ts` structure exactly. Key differences:
- Storage key: `rollkeeper-battlemap-data`
- ID prefix: `bm-` (via `generateBattleMapId()`)
- Additional methods for encounter linking: `linkEncounter`, `unlinkEncounter`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BattleMap } from '@/types/battlemap';

export function generateBattleMapId(): string {
  return `bm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

interface BattleMapStoreState {
  battleMaps: Record<string, Record<string, BattleMap>>;
  addBattleMap: (campaignCode: string, battleMap: BattleMap) => void;
  updateBattleMap: (campaignCode: string, mapId: string, updates: Partial<BattleMap>) => void;
  removeBattleMap: (campaignCode: string, mapId: string) => void;
  getBattleMap: (campaignCode: string, mapId: string) => BattleMap | undefined;
  getBattleMaps: (campaignCode: string) => BattleMap[];
  setDmOnly: (campaignCode: string, mapId: string, elementId: string, dmOnly: boolean) => void;
  toggleDmOnly: (campaignCode: string, mapId: string, elementId: string) => void;
  linkEncounter: (campaignCode: string, mapId: string, encounterId: string) => void;
  unlinkEncounter: (campaignCode: string, mapId: string, encounterId: string) => void;
}
```

Follow the exact immutable update patterns from `locationStore.ts` — spread campaign maps, spread individual map, set new value.

- [ ] **Step 2: Verify store compiles**

Run: `npm run type-check 2>&1 | grep "battleMapStore" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/store/battleMapStore.ts
git commit -m "feat(battlemaps): add battleMapStore with campaign-scoped CRUD"
```

---

## Task 3: Redis Key Helpers & API Routes

**Files:**
- Modify: `src/lib/redis.ts`
- Create: `src/app/api/campaign/[code]/battlemaps/route.ts`
- Create: `src/app/api/campaign/[code]/battlemaps/[id]/route.ts`

- [ ] **Step 1: Add Redis key helpers**

In `src/lib/redis.ts`, add two new key functions following the existing pattern:

```typescript
export function campaignBattleMapsKey(code: string): string {
  return `campaign:${code}:battlemaps`;
}

export function campaignBattleMapKey(code: string, battleMapId: string): string {
  return `campaign:${code}:battlemap:${battleMapId}`;
}
```

Update `refreshCampaignTTL()` to include battle maps key. **Note:** The function signature takes `redis: Redis` as the first parameter — preserve this:

```typescript
export async function refreshCampaignTTL(redis: Redis, code: string): Promise<void> {
  await Promise.all([
    redis.expire(campaignKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignPlayersKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignLocationsKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignBattleMapsKey(code), SLIDING_TTL_SECONDS),
  ]);
}
```

- [ ] **Step 2: Create list API route**

Create `src/app/api/campaign/[code]/battlemaps/route.ts` — mirror `src/app/api/campaign/[code]/locations/route.ts` exactly, substituting `campaignBattleMapsKey` for `campaignLocationsKey` and `battlemaps` for `locations` in the response.

- [ ] **Step 3: Create individual battle map API route**

Create `src/app/api/campaign/[code]/battlemaps/[id]/route.ts` — mirror `src/app/api/campaign/[code]/locations/[id]/route.ts` exactly, with these substitutions:
- `campaignLocationKey` → `campaignBattleMapKey`
- `campaignLocationsKey` → `campaignBattleMapsKey`
- `location` → `battleMap` in request/response body keys
- `LocationMetadata` → `BattleMapMetadata` pattern for the metadata list upsert

Same GET/POST/DELETE handlers, same permissive DM check, same TTL refresh.

**Important:** The POST handler must read `body.battleMap` (not `body.location`) for the synced data payload. The response should also use `battleMap` as the key.

- [ ] **Step 4: Verify API routes compile**

Run: `npm run type-check 2>&1 | grep "battlemaps" | head -10`

- [ ] **Step 5: Commit**

```bash
git add src/lib/redis.ts src/app/api/campaign/\[code\]/battlemaps/
git commit -m "feat(battlemaps): add Redis key helpers and API routes"
```

---

## Task 4: Editor Mode Flag — Types & Props

**Files:**
- Modify: `src/components/ui/campaign/location-map/DmLocationEditor.types.ts`
- Modify: `src/components/ui/campaign/location-map/DmLocationToolbar.types.ts`

- [ ] **Step 1: Update editor props with mode**

In `DmLocationEditor.types.ts`, add `mode` prop and generalize the location type:

```typescript
import type { LocationMap } from '@/types/location';
import type { BattleMap } from '@/types/battlemap';

export type EditorMode = 'location' | 'battlemap';

export interface DmLocationEditorProps {
  location: LocationMap | BattleMap;
  campaignCode: string;
  dmId: string;
  mode?: EditorMode;            // defaults to 'location'
  onSave: (canvasState: string) => void;
  onSyncToPlayers: () => void;
}
```

- [ ] **Step 2: Update toolbar props**

In `DmLocationToolbar.types.ts`, add mode-related props:

```typescript
// Add to the existing props interface:
mode?: EditorMode;
onOpenTvDisplay?: () => void;  // only in battlemap mode
```

- [ ] **Step 3: Verify types compile**

Run: `npm run type-check 2>&1 | grep "DmLocation" | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/campaign/location-map/DmLocationEditor.types.ts \
        src/components/ui/campaign/location-map/DmLocationToolbar.types.ts
git commit -m "feat(battlemaps): add EditorMode type and mode props"
```

---

## Task 5: Editor Hook — Mode-Aware Sync

**Files:**
- Modify: `src/components/ui/campaign/location-map/DmLocationEditor.hooks.ts`

This is the most complex task. The hook needs to:
1. Accept `mode` from props
2. Use the correct store (`battleMapStore` vs `locationStore`) based on mode
3. In battlemap mode, post to BroadcastChannel before Redis
4. Change the sync API endpoint based on mode

- [ ] **Step 1: Import battleMapStore and add mode awareness**

At the top of the hook, destructure mode from props (default to `'location'`). Import `useBattleMapStore`. Create conditional store access:

```typescript
const mode = props.mode ?? 'location';

// Conditional store access
const locationStoreGet = useLocationStore(s => s.getLocation);
const locationStoreToggle = useLocationStore(s => s.toggleDmOnly);
const locationStoreUpdate = useLocationStore(s => s.updateLocation);
const battleMapStoreGet = useBattleMapStore(s => s.getBattleMap);
const battleMapStoreToggle = useBattleMapStore(s => s.toggleDmOnly);
const battleMapStoreUpdate = useBattleMapStore(s => s.updateBattleMap);

const storeGetLocation = mode === 'battlemap' ? battleMapStoreGet : locationStoreGet;
const storeToggleDmOnly = mode === 'battlemap' ? battleMapStoreToggle : locationStoreToggle;
const storeUpdateLocation = mode === 'battlemap' ? battleMapStoreUpdate : locationStoreUpdate;
```

- [ ] **Step 2: Update `handleSyncToPlayers` for mode**

Modify the existing `handleSyncToPlayers` callback. **Important:** The existing PNG export + S3 upload logic must be preserved for both modes — the TV display page renders the `snapshotUrl` image.

Changes:
- Change API endpoint: `mode === 'battlemap'` → `/api/campaign/${campaignCode}/battlemaps/${location.id}` instead of `/api/campaign/${campaignCode}/locations/${location.id}`
- Build the sync data object (same for both modes), then wrap with mode-appropriate key:

```typescript
const syncData = {
  id: location.id,
  name: location.name,
  mapImageUrl: location.mapImageUrl,
  mapImageSize: location.mapImageSize,
  snapshotUrl,
  canvasState: filteredState,
  gridEnabled,
  gridSettings: location.gridSettings,
  updatedAt: new Date().toISOString(),
};

const payloadKey = mode === 'battlemap' ? 'battleMap' : 'location';
const payload = { dmId, [payloadKey]: syncData };
```

- In battlemap mode, post to BroadcastChannel before the Redis fetch:

```typescript
if (mode === 'battlemap') {
  try {
    const channel = new BroadcastChannel(`battlemap:${campaignCode}:${location.id}`);
    channel.postMessage(syncData);
    channel.close();
  } catch {
    // BroadcastChannel not supported — Redis fallback handles it
  }
}
```

- Change the API endpoint path based on mode:

```typescript
const apiPath = mode === 'battlemap'
  ? `/api/campaign/${campaignCode}/battlemaps/${location.id}`
  : `/api/campaign/${campaignCode}/locations/${location.id}`;
```

- [ ] **Step 3: Add `handleOpenTvDisplay` callback**

```typescript
const handleOpenTvDisplay = useCallback(() => {
  window.open(
    `/dm/campaign/${campaignCode}/battlemaps/${location.id}/display`,
    '_blank'
  );
}, [campaignCode, location.id]);
```

- [ ] **Step 4: Update return value**

Add `mode`, `handleOpenTvDisplay` to the returned state interface and object.

- [ ] **Step 5: Verify hook compiles**

Run: `npm run type-check 2>&1 | grep "DmLocationEditor.hooks" | head -10`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/campaign/location-map/DmLocationEditor.hooks.ts
git commit -m "feat(battlemaps): mode-aware sync with BroadcastChannel in editor hook"
```

---

## Task 6: Toolbar — Mode-Aware Buttons

**Files:**
- Modify: `src/components/ui/campaign/location-map/DmLocationToolbar.tsx`

- [ ] **Step 1: Update toolbar for mode**

In the sync section of the toolbar (right side), conditionally render based on `mode`:

- **Button label:** `mode === 'battlemap' ? 'Push to Display' : 'Sync to Players'`
- **Button color:** `mode === 'battlemap' ? 'success' : 'primary'` (green vs blue)
- **"Open TV Display" button:** Only render when `mode === 'battlemap'`. Opens new tab via `onOpenTvDisplay`. Use `outline` variant with an external link icon.
- **Download export button:** Only render when `mode === 'location'`.

- [ ] **Step 2: Verify toolbar compiles**

Run: `npm run type-check 2>&1 | grep "DmLocationToolbar" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/campaign/location-map/DmLocationToolbar.tsx
git commit -m "feat(battlemaps): mode-aware toolbar buttons"
```

---

## Task 7: Editor Component — Pass Mode Through

**Files:**
- Modify: `src/components/ui/campaign/location-map/DmLocationEditor.tsx`

- [ ] **Step 1: Pass mode to hook and toolbar**

In `DmLocationEditor.tsx`:
- Destructure `mode` from props (it's already in the updated types)
- Pass `mode` into `useDmLocationEditor(props)` (hook already receives full props)
- Pass `mode` and `handleOpenTvDisplay` to `DmLocationToolbar`

- [ ] **Step 2: Verify editor compiles**

Run: `npm run type-check 2>&1 | grep "DmLocationEditor" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/campaign/location-map/DmLocationEditor.tsx
git commit -m "feat(battlemaps): pass mode prop through editor to hook and toolbar"
```

---

## Task 7b: Encounter Linking Panel

**Files:**
- Create: `src/components/ui/campaign/battle-map/EncounterLinkingPanel.tsx`
- Modify: `src/components/ui/campaign/location-map/DmLocationEditor.tsx`

- [ ] **Step 1: Create EncounterLinkingPanel component**

Create `src/components/ui/campaign/battle-map/EncounterLinkingPanel.tsx`:

```typescript
interface EncounterLinkingPanelProps {
  campaignCode: string;
  linkedEncounterIds: string[];
  onLink: (encounterId: string) => void;
  onUnlink: (encounterId: string) => void;
}
```

Implementation:
- Use `useEncounterStore(s => s.getEncountersByCampaign)` to get available encounters
- Filter out already-linked encounters from the dropdown options
- Render a `<SelectField>` with encounter names, `onChange` calls `onLink`
- Below the dropdown, render linked encounters as `<Badge variant="info">` components with X buttons calling `onUnlink`
- If no encounters exist for the campaign, show a muted "No encounters in this campaign" message

- [ ] **Step 2: Mount panel in editor**

In `DmLocationEditor.tsx`, import `EncounterLinkingPanel` and render it inside the layers sidebar area, below the existing layers list, conditionally when `mode === 'battlemap'`:

```tsx
{mode === 'battlemap' && (
  <EncounterLinkingPanel
    campaignCode={campaignCode}
    linkedEncounterIds={(location as BattleMap).linkedEncounterIds}
    onLink={(id) => linkEncounter(campaignCode, location.id, id)}
    onUnlink={(id) => unlinkEncounter(campaignCode, location.id, id)}
  />
)}
```

Import `linkEncounter` and `unlinkEncounter` from `useBattleMapStore` at the top of the component (called unconditionally per hook rules).

- [ ] **Step 3: Verify compiles**

Run: `npm run type-check 2>&1 | grep -E "EncounterLinking|DmLocationEditor" | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/campaign/battle-map/EncounterLinkingPanel.tsx \
        src/components/ui/campaign/location-map/DmLocationEditor.tsx
git commit -m "feat(battlemaps): add encounter linking panel in editor sidebar"
```

---

## Task 8: Battle Map List Page & Card

**Files:**
- Create: `src/components/ui/campaign/battle-map/BattleMapListCard.tsx`
- Create: `src/app/dm/campaign/[code]/battlemaps/page.tsx`

- [ ] **Step 1: Create BattleMapListCard**

Mirror `src/components/ui/campaign/location-map/LocationListCard.tsx` with these additions:
- Props: `{ battleMap: BattleMap; campaignCode: string; onDelete: (id: string) => void; }`
- Links to `/dm/campaign/${campaignCode}/battlemaps/${battleMap.id}`
- Show linked encounter count as a small badge (e.g., "2 encounters") if `linkedEncounterIds.length > 0`
- Same thumbnail, name, delete button pattern

- [ ] **Step 2: Create battle maps list page**

Mirror `src/app/dm/campaign/[code]/locations/page.tsx` with these substitutions:
- `useLocationStore` → `useBattleMapStore`
- `generateLocationId` → `generateBattleMapId`
- Location type → BattleMap type
- Route paths: `/locations/` → `/battlemaps/`
- API delete endpoint: `/api/campaign/${code}/battlemaps/${id}`
- Title: "Battle Maps"
- Card component: `BattleMapListCard`
- Same creation dialog: name + image upload

- [ ] **Step 3: Verify pages compile**

Run: `npm run type-check 2>&1 | grep "battlemaps" | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/campaign/battle-map/ \
        src/app/dm/campaign/\[code\]/battlemaps/page.tsx
git commit -m "feat(battlemaps): add battle map list page and card component"
```

---

## Task 9: Battle Map Editor Page

**Files:**
- Create: `src/app/dm/campaign/[code]/battlemaps/[id]/page.tsx`

- [ ] **Step 1: Create editor page**

Mirror `src/app/dm/campaign/[code]/locations/[id]/page.tsx` with these changes:
- Import `useBattleMapStore` instead of `useLocationStore`
- Fetch battle map from `battleMapStore.getBattleMap(code, id)`
- Pass `mode="battlemap"` to `DmLocationEditor`
- `onSave` callback updates `battleMapStore.updateBattleMap()`
- Title shows battle map name
- Back link goes to `/dm/campaign/${code}/battlemaps`
- Same `h-screen overflow-hidden` layout with `min-h-0` flex chain

- [ ] **Step 2: Verify page compiles**

Run: `npm run type-check 2>&1 | grep "battlemaps/\[id\]" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/app/dm/campaign/\[code\]/battlemaps/\[id\]/page.tsx
git commit -m "feat(battlemaps): add battle map editor page with mode=battlemap"
```

---

## Task 10: TV Display Page

**Files:**
- Create: `src/app/dm/campaign/[code]/battlemaps/[id]/display/page.tsx`

- [ ] **Step 1: Create TV display page**

This is a new page with no direct equivalent to copy from. Key implementation:

```typescript
'use client';

// State: { snapshotUrl, mapImageUrl, loading, transform: { x, y, scale } }
// On mount:
//   1. Fetch from /api/campaign/{code}/battlemaps/{id}
//   2. Subscribe to BroadcastChannel('battlemap:{code}:{id}')
//   3. On channel message → update snapshot/mapImage state immediately
//   4. On channel error or close → rely on fetched data
//   5. Add visibilitychange listener → re-fetch from Redis when tab regains
//      focus (recovers missed BroadcastChannel messages if tab was backgrounded)

// Rendering:
//   - Full viewport black background, cursor:none
//   - Image with object-fit:contain
//   - Wheel zoom (native listener, passive:false, preventDefault)
//   - Pointer drag for pan
//   - Double-click to reset transform
//   - 'F' key → document.documentElement.requestFullscreen()
//   - Cleanup: close BroadcastChannel, remove event listeners on unmount
```

**Image source priority:** Render `snapshotUrl` if available (PNG with annotations). If `snapshotUrl` is absent (image export failed), fall back to `mapImageUrl` (the base map image without annotations). Do NOT attempt to render a FieldNotes canvas — the TV display is image-only for simplicity.

The zoom/pan logic reuses the same pattern from `MapLightbox` in `PlayerLocationView.tsx` — wheel zoom with native event listener, pointer-based pan, transform state.

No portal needed (this is its own page). No touch support needed (TV monitor, not tablet).

**Waiting state:** When no data is loaded yet, show centered white text "Waiting for DM to push map..." on black background.

**Recovery:** Add a `visibilitychange` listener that re-fetches from Redis when the tab regains focus. This handles the case where BroadcastChannel messages were missed while the TV tab was backgrounded or the browser throttled it.

- [ ] **Step 2: Verify page compiles**

Run: `npm run type-check 2>&1 | grep "display" | head -10`

- [ ] **Step 3: Test manually**

Open `/dm/campaign/{code}/battlemaps/{id}/display` — should show waiting state. Open editor in another tab, push to display — TV page should update instantly via BroadcastChannel.

- [ ] **Step 4: Commit**

```bash
git add src/app/dm/campaign/\[code\]/battlemaps/\[id\]/display/
git commit -m "feat(battlemaps): add TV display page with BroadcastChannel listener"
```

---

## Task 11: Dashboard & Encounter Integration

**Files:**
- Modify: `src/app/dm/campaign/[code]/page.tsx`
- Modify: `src/components/ui/encounter/EncounterList.tsx`

- [ ] **Step 1: Add Battle Maps card to dashboard**

In the campaign dashboard hero section (around line 226-268), add a "Battle Maps" card following the same pattern as Locations/Encounters. Use a distinct accent color (`accent-orange` or `accent-purple`). Import `Swords` icon from lucide-react.

**Layout note:** The existing hero section has 4 items in a flex row (Locations | Banner | Calendar | Encounters). Adding a 5th card may require adjusting the responsive layout — check if the cards wrap properly or if the grid needs adjustment for 5 items. Place "Battle Maps" next to "Encounters" since they're related.

```tsx
<Link
  href={`/dm/campaign/${code}/battlemaps`}
  className="border-accent-orange-border bg-accent-orange-bg flex items-center gap-3 rounded-xl border-2 p-4 transition-shadow hover:shadow-lg"
>
  <Swords className="text-accent-orange-text h-6 w-6" />
  <div>
    <p className="text-heading text-sm font-semibold">Battle Maps</p>
    <p className="text-muted text-xs">Combat encounter maps</p>
  </div>
</Link>
```

- [ ] **Step 2: Add battle map badge to encounter list**

In `src/components/ui/encounter/EncounterList.tsx`:
- Import `useBattleMapStore`
- At the top of the component (not per-card), precompute a lookup map for performance:

```typescript
const battleMaps = useBattleMapStore(s => s.getBattleMaps)(campaignCode);
const encounterToMap = useMemo(() => {
  const map = new Map<string, BattleMap>();
  for (const bm of battleMaps) {
    for (const eid of bm.linkedEncounterIds) {
      map.set(eid, bm);
    }
  }
  return map;
}, [battleMaps]);
```

- In each encounter card, check `encounterToMap.get(encounter.id)` — if found, render a small `<Badge>` or link: "Map: {battleMap.name}" linking to `/dm/campaign/${code}/battlemaps/${battleMap.id}`

Keep this lightweight — a one-liner badge, not a full card.

- [ ] **Step 3: Verify dashboard and encounter list compile**

Run: `npm run type-check 2>&1 | grep -E "page.tsx|EncounterList" | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/app/dm/campaign/\[code\]/page.tsx \
        src/components/ui/encounter/EncounterList.tsx
git commit -m "feat(battlemaps): add dashboard card and encounter list map badge"
```

---

## Task 12: Lint, Type-Check & Final Verification

- [ ] **Step 1: Run type-check**

Run: `npm run type-check`

Fix any errors (ignore pre-existing ones in `prototypes/` and `@fieldnotes/core` declaration warnings).

- [ ] **Step 2: Run linter**

Run: `npm run lint`

Fix any new warnings/errors in files we created or modified.

- [ ] **Step 3: Manual smoke test**

1. Navigate to campaign dashboard → verify "Battle Maps" card appears
2. Click into Battle Maps → verify empty list with "New Battle Map" button
3. Create a new battle map with an image → verify editor loads in battlemap mode
4. Verify toolbar shows "Push to Display" (green) and "Open TV Display" button
5. Click "Open TV Display" → verify TV display page opens showing waiting state
6. Add grid, draw some annotations, click "Push to Display"
7. Verify TV display updates with the map
8. Zoom in/out on TV display with scroll wheel, pan with drag, double-click to reset
9. Press F → verify fullscreen
10. Link an encounter from the side panel
11. Check encounter list → verify map badge appears

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(battlemaps): lint and type-check fixes"
```

- [ ] **Step 5: Push branch**

```bash
git push origin feat/dm-battle-maps
```
