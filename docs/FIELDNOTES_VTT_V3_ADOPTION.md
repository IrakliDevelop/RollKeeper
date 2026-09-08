# Field Notes VTT v3 adoption

RollKeeper adopts the extracted Field Notes VTT runtime while keeping the v3
wire and persistence contract. This change is deliberately not the CanvasState
v4 migration and does not remove any compatibility shim, legacy fog wire kind,
or dual-write persistence path.

## Coordinated package set

The application and relay lockfiles resolve the published coordinated set:

- `@fieldnotes/core` `0.81.1`
- `@fieldnotes/vtt` `0.7.1`
- `@fieldnotes/sync` `0.18.1`
- `@fieldnotes/sync-server` `0.17.1`
- `@fieldnotes/sync-redis` `0.8.1`
- `@fieldnotes/react` `0.11.0`

The browser bundle imports VTT behavior from `@fieldnotes/vtt` and fog sync
from `@fieldnotes/vtt/sync`. The relay imports fog authorization and snapshot
filtering from `@fieldnotes/vtt/server`, and the Redis backend installs the
backend service from `@fieldnotes/vtt/redis`. Core and generic sync remain the
v3-compatible substrate.

## Initialization contract

`src/lib/fieldnotesVtt.ts` owns the shared VTT registration and service
bridges. `registerVttElementTypes()` is guarded and runs against the default
element registry before persisted grid/template state is decoded. Viewports,
serialization, export, and sync all receive that same registry.

Each DM, player, and TV viewport installs one fog plugin before the first
render. Its `FogManager` instance is reused by the viewport, fog tools,
autosave, and the sync client plugin. Player and TV surfaces remain behind an
opaque privacy cover until the authoritative snapshot and fog plugin state have
both been applied. Privacy metadata subscriptions are installed before sync can
observe element mutations.

The extracted VTT grid controller is attached to the viewport constraint
service. Grid snapping therefore constrains committed points without rewriting
global pointer coordinates. The extracted template runtime handles mouse,
touch, and pen aiming/resizing; RollKeeper's z-index stamping remains inside the
same pointer gesture transaction so one gesture is one undo step.

## Compatibility contract

- Persisted battlemaps remain CanvasState version 3.
- Legacy grid/template shapes are decoded and registered as `vtt:grid` and
  `vtt:template` runtime envelopes.
- Export writes the legacy v3 grid/template forms expected by deployed clients.
- Fog continues to dual-read and dual-write top-level `fog` and
  `extensions.fog`; extension state wins when both are present.
- Existing fog event origins are retained so hydration, remote snapshots, and
  persistence writes do not feed back into client operations.
- The relay uses the existing DM-only authorization policy and the VTT server
  plugin's per-viewer snapshot filtering. Unauthorized snapshots, corrections,
  and cross-instance fanout contain no DM-only element bytes.
- Redis retains stale-writer rejection and shared fog/layer fanout. Generic
  element operations keep their existing memory-first locality contract.
- The `HubBackend` buffering decorator still forwards generic backend services,
  preserves operation locality, coalesces hydration, retries failed flushes,
  applies TTL/eviction after durable writes, protects newer concurrent writes,
  and fails shutdown explicitly if bounded retries cannot make the buffer safe.

## Verification performed

- `npm run type-check`
- `npm test`: 566 files passed, 1 skipped; 7,796 tests passed, 2 skipped
- `npm run build`
- `npm run test:visual`: 31 files and 240 tests passed in Chromium
- `npm run test:fog:e2e`: 9 passed, 1 touch-only desktop case skipped
- `npx playwright test e2e/movement-path.spec.ts --project=chromium`: 3 passed
- `npm run test:db:integration`: 3 passed
- `npm run type-check && npm test && npm run build` in `relay/`: 12 test files
  passed, 1 Redis-gated file skipped; 80 tests passed, 5 skipped
- `REDIS_TEST_URL=redis://127.0.0.1:6389 npm run test:redis` in `relay/`
  against temporary Redis 7: 5 passed
- ESLint over every changed TypeScript file: 0 errors and 3 pre-existing hook
  dependency warnings; `npm run format:ci`: 48 deviations / 273 allowed
- Repository-wide `npm run lint` remains blocked by generated files inside the
  pre-existing ignored `.claude/worktrees/vtt-merchants-followups` tree (2,448
  errors and 45,954 warnings). No file in that worktree was changed.
- Manual in-app browser acceptance: created a production-shaped v3 battlemap,
  enabled a square grid, aimed a template, verified one-step undo/redo, enabled
  covered fog, painted with the fog brush, and reloaded. Grid, template, and fog
  state persisted with no browser errors.

## Rollout and rollback

Deploy the application and relay from the same release and confirm their
resolved Field Notes versions before traffic is shifted. Production smoke
checks must cover a pre-existing v3 battlemap in DM, player, and TV modes; a
second relay instance; Redis reconnect; offline fog reconciliation; exports;
and an unauthorized player attempting snapshot and correction paths. Monitor
relay authorization rejects, Redis write/retry failures, snapshot convergence,
and first-render privacy during the soak.

Rollback is the previous RollKeeper application and relay release together.
Because this adoption keeps v3 wire kinds and dual-write persistence, data
written during the soak remains readable by the previous release. Do not begin
CanvasState v4 or remove the compatibility paths above until the adoption has
completed its production soak.
