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
| `authority-challenge` POST | DM | `authorizeTableDm` (mutation) + relay same-authority proof |
| `authority/checkpoint` POST, `authority/initialize-if-empty` POST | DM, live tab only | `authorizeTableDm` (mutation) + the tab's live-control lease: `holderSessionId` and `expectedFence` must match the control record (`authorityAdminContext`, `src/lib/tableServer/authorityAdmin.ts`); otherwise 403 and the relay is never called |
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

1. Deploy the relay first (authority Lua, scene rooms, room-key TTL) and
   check that `curl -fsS https://<relay-host>/healthz` answers `ok`
   (`relay/src/server.ts`) **before** the app change is merged or deployed.
   If merging would auto-deploy the app to production, pause that
   auto-deploy until the relay is verified; otherwise new clients ask for
   authority tokens the old relay cannot serve. There is no automated
   production check for an authority room; after the app is live, run a
   short manual smoke check on a test campaign: **Open Table**, **Go live**,
   **Show this scene**, then **Open display** and confirm the scene appears on
   the TV.
2. Then deploy the app. A new app build talks only the v1 protocol.
3. Already-open relay sockets are not closed by the app deploy. When an old
   browser tab needs a new token, `battlemap-token` answers 426 "Client
   upgrade required — please refresh your browser"
   (`src/app/api/campaign/[code]/battlemap-token/route.ts`):
   - any scene request (a present `sceneId`, or any request that is not a
     no-scene `kind: 'location'` claim) must negotiate
     `protocols: { fog: 1, authority: 1 }`;
   - a no-scene `kind: 'location'` claim stays on the legacy room path and
     needs only `fog: 1`, and only when `BATTLEMAP_FOG_PROTOCOL_REQUIRED` is
     `true`.

   Tokens live 5 minutes (`TOKEN_TTL_MS`).

## Release notes (behaviour changes for existing users)

- **Restore needs the live tab.** "Restore checkpoint" and "Reapply changes"
  work only in the tab that holds live control; elsewhere they are disabled
  with "Only the live tab can restore. Go live first." Two tabs of the same
  DM share one principal, so the server checks the tab's control session and
  writer fence, not only the DM. The relay's provision Lua re-checks the
  session when the app sends it (`relay/src/authority-lua.ts`), and the app
  forwards the tab's own fence so a takeover between the read and the write
  is refused. Scene-room seeding sends the same lease.
- **Mini scale is square-grid only, silently.** On a scene whose live grid
  is not square (hex, none or invalid), the TV shows no calibration UI at
  all (no Calibrate minis, Check scale or Setup tips, no grid message) and
  uses the normal view; it reports `uncalibrated`, so the DM sees no
  mini-scale warning (and no scale line at all for a scene whose record has
  no square grid). Nothing scale-related shows while a scene is still
  attaching, before its grid is known. A calibrated TV keeps its saved scale and returns to it
  on the next square scene (`calibration/session.ts`,
  `tableDisplayController.ts`). `unsupported` now means only a square grid
  whose scale is out of range.
- A TV tab that is not visible while attaching shows "Keep this screen
  visible to show the map." and attaches as soon as it is visible again,
  instead of retrying every 15 s. The DM status does not name this case (the
  ACK protocol has no hidden phase); it keeps its existing wording.
- Combat value edits (hide, initiative, HP, conditions) queue behind a save
  in flight instead of being dropped; turn and lifecycle steps still run one
  at a time. A failed edit is named in the panel footer ("Orc initiative
  wasn't saved."). A storage or conflict failure offers Retry for that one edit
  while nothing else is saving and until any other edit saves; a rejection
  never does. Edits that fail together are listed by name with no Retry, so
  the DM redoes them. The next action the DM starts clears the list, so
  nothing old is replayed over newer values. Other notices, such as "Still
  saving" or the Show + Start outcome, show beside it; a save clears only
  "Still saving".
- Legacy shared-state writers are retired: `POST /shared` with
  `initiative`, `initiativeRequest` or `battlemap` answers 426, and any feature
  outside `TABLE_V1_SHARED_FEATURES` answers 400
  (`src/app/api/campaign/[code]/shared/route.ts`). Initiative publishes through
  the Table control session (`src/hooks/useDmInitiativeSync.ts`).
- `POST /battlemaps/[id]` (legacy map publication) and `POST /display-key`
  always answer 426 (`.../battlemaps/[id]/route.ts`, `.../display-key/route.ts`).
- The battle-map editor's "Share with players" toggle is disabled; the join
  banner follows Show on a Table scene. Starting combat no longer pushes the
  linked map live. The original editor opens no relay connection (only a
  Table scene has a live room), so its top bar shows "Private. Players don't
  see this map." (or, once the map is on the Table, "Private copy. Players
  see the Table scene, not edits here.") instead of a connection status
  (`src/components/ui/campaign/dm-vtt/DmBattleMapCanvas.hooks.ts`). It hides
  the controls that only work through a live room (measure, move and camera
  sharing, send view, viewers and cursor sharing, ping); the laser pointer
  stays because it draws locally.
- Authority connections (DM Table stage, players, display, fog;
  `src/lib/battlemapAuthority.ts`):
  - A player's (or display's) edits made before its connection is first
    live, for example a token placed right after opening the shown scene or
    the player's own layer, are held, coalesced per element or layer, and
    sent once, in order, when the room is first live. The queue is capped;
    an edit that cannot be kept shows a notice. The DM's connection does not
    hold: before live the SDK refuses edits and the scene's localDraft keeps
    them.
  - After the first live state, edits made while offline or reconnecting are
    SDK drafts and are never replayed. Once the room is live again and its
    document applied, the live room wins: those drafts (and operations whose
    outcome was lost with the connection) are released. The DM sees "Map
    edits made while offline were not sent. To send them, open Details and
    choose Reapply offline changes." A player sees "Changes you made while
    offline weren't saved."
  - The DM's offline version is copied into the scene's offline changes
    slot (`offlineFork` on the scene record: `savedAt`, `replacedEarlier`,
    `draft`) when those drafts are released
    (`onOfflineDraftsReleased` in `src/lib/battlemapAuthority.ts`, then
    `captureOfflineFork` in `src/lib/table/sceneAdapter.ts`). Later edits and
    "Save checkpoint" never change or clear it. Details shows "Offline
    changes from <time>" with "Reapply offline changes" (the live-tab restore
    used by "Restore checkpoint", from the slot) and "Discard"; either one
    empties the slot (`clearOfflineFork` removes the key). There is one slot:
    a newer offline episode replaces it and Details says "These replaced
    earlier offline changes that were not reapplied." "Reapply changes"
    still re-sends the scene's localDraft, which follows the latest edits.
  - A send refused for capacity waits and is retried in the same room
    generation only, otherwise dropped with a notice.
  - Accepted operations, rejected ones once restored on screen (players) or
    with a notice (DM), and the offline work above are released from the SDK
    journal, so a connection does not fill its 64-operation journal and
    checkpoints are not blocked by leftover drafts. Work pinned by a
    checkpoint barrier is released once the barrier is.
  - The DM's sync notices show as a "Live map" toast on the Table stage.
  - A later change of shown scene discards unsent edits, with a notice.
- **Offline changes slot and older builds.** The scene record (still
  `schemaVersion: 1`, database version 1, bundle version 1) gained the
  optional `offlineFork` field. A build from before it validates scene keys
  exactly, so while any scene holds offline changes it opens the whole Table
  read-only ("This Table's data is in a format the app can't edit") and
  refuses such a bundle on import. Nothing is deleted, and it reads normally
  again once a newer build reapplies or discards the offline changes
  (`src/lib/table/offlineFork.olderReader.test.ts`). Accepted because no
  released build had the Table.
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
| App rolled back to a Table build without the offline changes slot while a scene holds offline changes (`offlineFork`) | That build opens the Table read-only (`invalid-schema`) and refuses bundles that carry the slot; nothing is lost | Open the newer build and reapply or discard the offline changes (Details), or roll forward |
| IndexedDB created by a newer database version | Open fails, workspace unavailable (`openTableDatabase` strict version/store check) | Upgrade the app |
| Bundle with `bundleVersion > 1` | Import rejected `future-bundle` | Import with the newer build |
| App rolled back to a pre-Table build | Table data stays in IndexedDB untouched; tagged Redis keys are ignored and expire by TTL | Redeploy a Table build; data reappears |
| Relay rolled back without authority support | Scene rooms unavailable; app answers 503/unavailable for live play | Roll the relay forward first, then the app (deployment order) |

To roll back a live release:

1. Stop live play: stop broadcasting (the DM's live control lease lapses).
2. Export a Table bundle from each DM device.
3. Roll back the app and the relay together, to the recorded previous
   known-good pair (see "VTT v4 rollout and rollback" in `relay/README.md`):
   the app first, then the relay. Replacing or restarting the relay drains
   the already admitted v1 sockets; the app rollback alone never closes them.

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
- Real Redis: `npm run test:relay:redis` (needs `REDIS_TEST_URL` pointing at
  Redis 7 or newer; fails rather than skipping without it, and fails fast on
  an older server) and `npm run test:table-control:redis`
  (starts its own disposable Redis and serverless-redis-http containers). Both
  run in the CI job "Relay and Table control Redis suites".
