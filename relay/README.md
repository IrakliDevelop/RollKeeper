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
5. Version coupling: the relay runs `@fieldnotes/sync-server` 0.14.0, `@fieldnotes/sync-redis`
   0.5.0, `@fieldnotes/core` 0.66.0, `@fieldnotes/sync` 0.12.0. The app's fog-of-war UI requires
   this relay version. Deploy the relay BEFORE releasing an app build with fog support.
