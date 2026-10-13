# Scenes and Table

The DM's Table workspace: private scene preparation, live presentation to
players and a TV, and Table-owned combat runs. It is built on the battle map
VTT ([07](07-battlemap-fog-fieldnotes.md)) but has its own local storage,
server control service and relay authority. This page describes the code as
of the Scenes and Table release; when in doubt, read the cited file.

**There is no feature switch.** Table protocol v1 is always on; the former
server and client deployment switches for it were removed. Entry points ("Open Table", "Prepare on map", "Open in Table" / "Use
in Table", "Open display") always render.

## Routes and auth model

Pages:

| Route | What it is |
|---|---|
| `/dm/campaign/[code]/table` | The unified Table workspace (`src/app/dm/campaign/[code]/table/page.tsx`) |
| `/dm/campaign/[code]/table/[sceneId]` | Old per-scene URL; only a 307 redirect to the workspace with `?scene=` (`.../table/[sceneId]/page.tsx`) |
| `/table-display/[code]` | Persistent campaign TV display, outside `/dm` (`src/app/table-display/[code]/page.tsx`); the capability arrives in the URL fragment `#k=` |
| `/dm/campaign/[code]/battlemaps/[id]/display` | Old map-pinned TV URL; now the campaign display restricted to scenes adopted from that map (`.../display/page.tsx`) |

API routes under `src/app/api/campaign/[code]/table/`:

| Route | Caller | Auth |
|---|---|---|
| `control` GET / POST | DM | `authorizeTableDm`; POST is a fenced control command |
| `scenes` GET | DM | `authorizeTableDm` |
| `authority-challenge` POST, `authority/checkpoint` POST, `authority/initialize-if-empty` POST | DM | `authorizeTableDm` (mutation) + relay same-authority proof |
| `display/capability` POST | DM | `authorizeTableDm` (mutation); rotates the display capability |
| `display/status` GET | DM | `authorizeTableDm` |
| `display/descriptor` POST, `display/ack` POST | TV display | display capability + session nonce, same-origin/CSRF |

- **DM routes** go through `authorizeTableDm` (`src/lib/tableServer/auth.ts`):
  valid campaign code and `dmId`, account membership role `owner`/`dm` when
  the campaign is account-backed, no hybrid guest cookie, origin/CSRF on
  mutations, and the legacy `verifyDmAuthority` check.
- **Display routes** take only the campaign display capability plus its bound
  session nonce (`src/lib/tableServer/displayCapability.ts`). The display page
  never sends the capability in a query string; side-channel GETs carry it in
  headers (`src/lib/battleMapSessionAuth.ts`, `validateSameOriginRead`). The
  old plaintext campaign display key is never accepted.
- **Shared map routes** (`battlemaps`, `battlemaps/[id]`, `.../markers`,
  `.../fog-appearance`, `battlemap-token`) resolve the id server side
  (`src/lib/tableServer/presentationAccess.ts`): a scene is visible to the DM
  unless deleted, and to players/display only while it is the current,
  unblanked presentation; registered source maps and unregistered maps are
  DM-only; a verified location keeps its existing location authorization.
  Every audience miss is the same generic 404.

All Table server keys share one Redis hash tag per campaign,
`campaign:{rk-table-v1:<sha256(code)>}:…` (`src/lib/tableServer/keys.ts`,
`relay/src/authority-keys.ts`).

## Relay requirement

Live Table play (Show, live initiative, player scenes, the TV) needs the
relay and Redis:

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BATTLEMAP_RELAY_URL` | app (build time) | Browser WebSocket URL of the relay |
| `BATTLEMAP_RELAY_INTERNAL_URL` | app (server) | HTTP origin for same-authority proof and checkpoint/provision calls; falls back to `NEXT_PUBLIC_BATTLEMAP_RELAY_URL` (`src/lib/tableServer/authorityAdmin.ts`, `authorityProof.ts`) |
| `BATTLEMAP_RELAY_SECRET` | app and relay | Token signing and relay admin calls; the relay refuses to start without it (`relay/src/server.ts`) |
| `REDIS_URL` | relay | Must be the same Redis the app's Upstash REST endpoint fronts; fenced authority runs only with it (`relay/src/server.ts`) |

Without a relay, scenes can still be prepared locally in the workspace;
scene rooms, player views and the TV cannot connect.

## Deployment order

1. Deploy the relay first (authority Lua, scene rooms, room-key TTL).
2. Then deploy the app. A new app build talks only the v1 protocol.
3. Already-open relay sockets are not closed by the app deploy. When an old
   browser tab needs a new token, `battlemap-token` answers 426 "Client
   upgrade required — please refresh your browser" unless it negotiates
   `protocols: { fog: 1, authority: 1 }`
   (`src/app/api/campaign/[code]/battlemap-token/route.ts`). Tokens live
   5 minutes (`TOKEN_TTL_MS`).

## Release notes (behaviour changes for existing users)

- Legacy shared-state writers are retired: `POST /shared` with
  `initiative`, `initiativeRequest` or `battlemap` answers 426, and any feature
  outside `TABLE_V1_SHARED_FEATURES` answers 400
  (`src/app/api/campaign/[code]/shared/route.ts`). Initiative publishes through
  the Table control session (`src/hooks/useDmInitiativeSync.ts`).
- `POST /battlemaps/[id]` (legacy map publication) and `POST /display-key`
  always answer 426 (`.../battlemaps/[id]/route.ts`, `.../display-key/route.ts`).
- The battle-map editor's "Share with players" toggle is disabled; the join
  banner follows Show on a Table scene. Starting combat no longer pushes the
  linked map live.
- Old map-pinned TV links (`?dk=<uuid>`) show "expired" without any request:
  the key is consumed and scrubbed like a capability and fails verification
  (`src/components/ui/campaign/table/display/displayCredentialStore.ts`). Use
  "Open display" to get a new link.
- Display ACK `calibration` is an enum (`uncalibrated`, `verified`,
  `verify-required`, `unsupported`; `src/lib/tableServer/displayScripts.ts`,
  `displayCapability.ts`). An ACK carrying a value the deployed server does
  not know is a 400, so during a deploy-skew window between display and app
  builds the TV's ACKs can be refused until both run the same release. An ACK
  without `calibration` is accepted.

## Local-only storage and recovery

- Scenes, actors, combat runs, logs and their operation history live only in
  the browser IndexedDB database `rollkeeper-table`
  (`src/lib/table/database.ts`, `TABLE_DATABASE_VERSION = 1`). The UI says so:
  "Saved on this device", "Scenes and fights are saved on this device only."
- Nothing else reads that database: cloud encounter backups and the
  durable-DM sync families do not contain Table scene runtime.
- The **Table bundle** export/import in the Scenes panel is the only recovery
  path (`src/lib/table/bundle.ts`, `TableScenePanel.tsx`). Export is a
  canonical JSON bundle (`bundleVersion: 1`, `schemaVersion: 1`) with
  per-record digests and credential material refused; import always creates
  a new local workspace and never overwrites the active one.
- Server state is ephemeral: control and registry expire 24 h after the last
  control write (`src/lib/tableServer/atomic.ts`, `EX 86400`); display ACKs
  30 s; relay authority rooms 48 h after the last commit or provision (below).

## Rollback matrix

There is no destructive data rollback: no code path deletes the Table
database on downgrade.

| Situation | Behaviour | Recovery |
|---|---|---|
| Same release, Redis/relay data expired | Registry/room gone; the workspace re-registers the scene (`registerScene`) and provisions the room from local state (`authority/initialize-if-empty`, `src/lib/table/authorityLifecycle.ts`) | From the device that holds the scenes |
| Local records with a newer `schemaVersion` than this build | Workspace opens read-only (`unknown-schema`); edits refused (`src/lib/table/repository.ts`) | Raw export (`exportRawTableWorkspace`), then upgrade the app |
| Local records that fail validation | Read-only (`invalid-schema`) | Raw export; bundle from another device |
| IndexedDB created by a newer database version | Open fails, workspace unavailable (`openTableDatabase` strict version/store check) | Upgrade the app |
| Bundle with `bundleVersion > 1` | Import rejected `future-bundle` | Import with the newer build |
| App rolled back to a pre-Table build | Table data stays in IndexedDB untouched; tagged Redis keys are ignored and expire by TTL | Redeploy a Table build; data reappears |
| Relay rolled back without authority support | Scene rooms unavailable; app answers 503/unavailable for live play | Roll the relay forward first, then the app (deployment order) |

To roll back a live release: stop broadcasting (the DM's live control lease
lapses), export a Table bundle from each DM device, then restore a matching
app + relay pair.

## Relay room-key lifetime

Every authority room key (`relay/src/authority-keys.ts`: meta, elements,
ownership, layers, fog meta/tiles, dedupe, receipts, history, evidence,
outbox, outbox claims, player rate) carries a sliding TTL of
`AUTHORITY_ROOM_TTL_SECONDS = 172800` (48 h, the legacy `ROOM_TTL_SECONDS`
default). The commit and provision Lua re-arm it on all room keys together
(`relay/src/authority-lua.ts`), so one room's keys never expire separately; a
replayed or rejected commit leaves TTLs alone. An abandoned room (expired
registry, re-registered scene, deleted scene) is reclaimed within 48 h of its
last write. Control and registry keep their own 24 h app-owned lifetime.

Tombstoning a scene does not delete its room keys: re-registering a
tombstoned scene id reuses its `roomId` (`atomic.ts`), and the control script
does not receive room keys. The sliding TTL reclaims them instead.

## Tests

- Unit: `src/lib/tableServer/**`, `src/app/api/campaign/[code]/**`,
  `src/lib/table/**`, `src/components/ui/campaign/table/**` (`npm run test`).
- Real Redis: `npm run test:relay:redis` (needs `REDIS_TEST_URL`; fails
  rather than skipping without it) and `npm run test:table-control:redis`
  (starts its own disposable Redis and serverless-redis-http containers). Both
  run in the CI job "Relay and Table control Redis suites".
