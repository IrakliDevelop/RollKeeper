# RollKeeper Battle Map Relay

Authoritative WebSocket relay for live battle maps (`@fieldnotes/sync-server`).
Rooms are `{campaignCode}:{battleMapId}`; roles `dm` / `player` / `display`.
Auth = short-lived HMAC tokens minted by the Next.js app (`/api/campaign/[code]/battlemap-token`).

## Env

| Var                      | Required | Notes                                                                                           |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `BATTLEMAP_RELAY_SECRET` | yes | must equal the Vercel app's value |
| `PORT` | no | Railway injects it; default 8787 |
| `REDIS_URL` | no | Upstash TCP URL; enables buffered persistence and cross-instance ephemeral presence/poke fan-out |
| `FLUSH_INTERVAL_MS` | no | default 3000 |
| `ROOM_TTL_SECONDS` | no | default 172800 (2 days) |
| `RELAY_GATE_LOG` | no | `1` logs admitted identities and presence kinds + field names — manual verification only, never in production |

When Redis is enabled, the relay opens one backend connection plus dedicated publish and subscribe
connections. Element ops remain buffered in memory and instance-local. Fog-of-war ops are delegated
synchronously to a `RedisHubBackend` from `@fieldnotes/sync-redis` for atomic LWW persistence.
Fan-out carries presence, leave events, and fog ops across relay instances; element ops stay
instance-local. Only `role === 'dm'` may write fog (`authorizeFog` policy); player and display
fog writes are rejected with authoritative corrections.

## Local dev

    docker-compose up -d                 # repo root — Redis on localhost:6379
    cd relay && npm install
    BATTLEMAP_RELAY_SECRET=dev-secret-change-me REDIS_URL=redis://localhost:6379 npm run dev

App side (`.env.local`): `BATTLEMAP_RELAY_SECRET=dev-secret-change-me`,
`NEXT_PUBLIC_BATTLEMAP_RELAY_URL=ws://localhost:8787`.

## Railway deploy

1. New service from this GitHub repo; set **Root Directory = `relay`**.
2. Set env vars: `BATTLEMAP_RELAY_SECRET` (same as Vercel), `REDIS_URL` (Upstash TCP URL from the Upstash console — the `rediss://` one, not the REST URL), and `NIXPACKS_NO_CACHE=1` (without it, Nixpacks mounts its build cache inside `node_modules/.cache` and `npm ci` fails with `EBUSY` trying to remove it).
3. Railway builds via `relay/railway.json` and health-checks `/healthz`.
4. Set `NEXT_PUBLIC_BATTLEMAP_RELAY_URL=wss://<service>.up.railway.app` on Vercel and redeploy the app.
5. Version coupling: the relay runs `@fieldnotes/core` 0.86.0, `@fieldnotes/vtt` 0.12.0,
   `@fieldnotes/sync` 0.21.0, `@fieldnotes/sync-server` 0.20.0, and
   `@fieldnotes/sync-redis` 0.12.0. The web app runs the same core/VTT/sync versions plus
   `@fieldnotes/react` 0.13.0. Deploy and verify the relay before releasing the coupled web build.

## VTT v4 rollout and rollback

Production changes require an explicit authorization record, named operator, monitored cohort,
predefined abort thresholds, and exact previous web and relay artifacts. Deploy the relay before the
app so no client can outrun the protocol. The release order is:

1. Verify the coordinated Field Notes package set above and preserve CanvasState version 4 plus the
   v4 capability handshake marker (`elementEnvelope: true`).
2. Deploy the relay, verify `/healthz`, Redis-backed hydration and fanout, DM-only authorization,
   filtered snapshots, and failure-safe buffering before deploying the web app.
3. Deploy the web app, confirm `NEXT_PUBLIC_BATTLEMAP_RELAY_URL`, and verify the resolved package
   set from the immutable build artifact.
4. Start with the smallest authorized cohort and run the DM/player/display, reconnect, export,
   pointer, and immediately-previous/current v4 acceptance matrix before expanding.
5. Soak for 2–4 weeks while recording UTC cohort changes, incidents, artifact drift, monitoring
   evidence, and rollback events.

Rollback the web and relay to the recorded previous known-good artifacts as a coordinated set. Do
not partially roll back either side unless the approved runbook proves that combination safe. This
release no longer translates legacy v3 grid/template wire shapes or dual-writes top-level `fog`;
plugin snapshot state exists only under `extensions`. Persisted CanvasState versions 1–3 remain
readable and migrate to version 4, but that storage migration is not wire-protocol compatibility.
Prove the exact rollback artifact pair with a real rehearsal before rollout rather than relying on
the persisted-state migration contract.

Useful release evidence:

```sh
curl -fsS https://<relay-host>/healthz
git rev-parse HEAD
```

The optional real-Redis acceptance suite can be run against an isolated Redis database with `REDIS_TEST_URL=redis://127.0.0.1:6379 npm run test:redis` from `relay/`.
