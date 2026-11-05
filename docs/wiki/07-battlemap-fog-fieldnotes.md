# Battle Maps, Fog of War & Presence

The VTT (virtual tabletop) layer: DM-driven battle maps, token placement,
fog of war, movement, live presence (who's viewing, shared cursors), and a
"TV display" spectator mode. Built on the `@fieldnotes/*` SDK, which **the
project's maintainer authors** — treat it as first-party code to read and
propose changes to, not an opaque third-party dependency. See
`[[fieldnotes-sdk-ownership]]`-type context: SDK-level feature proposals are
welcome, not just app-level workarounds.

## UI location

`src/components/ui/campaign/location-map/` — not a top-level `fog/` directory.
Key subfolders:

- `location-map/fog/` and `location-map/fog/FogPresetPanel/` — fog appearance
  model, per-map projection, live viewers, and the fog preset library UI
  (custom material projection + material editor)
- `PresenceControl/` — shared cursors / "who's viewing," built on
  `@fieldnotes/core`
- `BattleMapViewsControl/`, `BattleMapMinimap.tsx`
- `dm-vtt/` — `DmVttToolbar`, `DmBattleMapCanvas`, `TokenPlacementController`,
  `TokenDragDistanceBadge`
- `player-vtt/` — `SpellPlacementController`
- `token-overlay/` — `TokenDecorationLayer`
- `location-map/__tests__/movement.integration.test.tsx` /
  `movementCommit.test.tsx` — grid-aware movement/commit tests

## Logic (`src/lib/`)

`fogOfWar.ts`, `fogMaterial.ts`, `fogPreset.ts` (each with a co-located
`.test.ts`), `battlemapSync.ts`, `battlemapToken.ts`,
`battlemapPokeListener.ts`, `battleMapSessionAuth.ts`,
`relayPoke.ts`, `markerLootClaims.ts`, `sanitizePublicMarkers.ts`,
`openTvDisplay.ts` (spectator/TV display mode).

## API routes

`/api/campaign/[code]/battlemaps`, `/api/campaign/[code]/battlemaps/[id]/fog-appearance`,
`/api/campaign/[code]/battlemap-token`.

## Rollout state

Fog of war / preset library has been built incrementally, and **campaign
persistence for fog presets landed merged but flag-gated off**. Don't assume
current default-on behavior from a commit message alone — check the relevant
flag (see [13](13-feature-flags-and-gated-work.md)) before describing this
feature as "shipped" in user-facing terms.

## e2e coverage

Dedicated Playwright config: `config/playwright/fog.config.ts`, run via
`npm run test:fog:e2e`.

## Related sync architecture

Live viewer/token/fog state rides on the same relay/poke architecture as the
rest of the campaign sync layer (`relayPoke.ts`, `battlemapPokeListener.ts`) —
see [04](04-campaign-sync-redis.md) for the general pattern. If you're
debugging a stale battle-map view, check both the fog/battlemap-specific sync
files here and the general Redis sync notes.

## Turn movement

Battle maps use Fieldnotes `MovementTracker` for normal Select-tool drags
and keep waypoint Move-tool commits in the same cumulative record. Tracking
is active for the current combatant only; each encounter/round/turn has its
own movement budget. Player canvases track only that player's character.
The DM uses synced character speed (including buffs), or stat-block walking
speed for other combatants. Dash extends the budget and switches off when
the turn changes.

During a tracked drag, **F** adds a waypoint and **Backspace** removes one;
touch/pen users can hold still to add a waypoint. The movement controls show
feet spent and remaining. **Reset movement** leaves the token in place and
is undoable. **Teleport** accepts a range in feet and starts destination
placement; out-of-range destinations are refused, Escape/Cancel leaves the
token in place, and a turn change cancels pending placement. Teleporting
breaks the trail without spending movement. Position and movement records
share the gesture's undo transaction.

Live drag trails follow the existing movement-sharing control. Hidden-token
trails are never broadcast, and DM-only movement records are filtered by the
relay. The app and relay must use the matching versioned sync protocol when
this dependency upgrade is deployed.
