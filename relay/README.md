# RollKeeper Battle Map Relay

Authoritative WebSocket relay for live battle maps (`@fieldnotes/sync-server`).
Rooms are `{campaignCode}:{battleMapId}`; roles `dm` / `player` / `display`.
Auth = short-lived HMAC tokens minted by the Next.js app (`/api/campaign/[code]/battlemap-token`).

## Env

| Var | Required | Notes |
|---|---|---|
| `BATTLEMAP_RELAY_SECRET` | yes | must equal the Vercel app's value |
| `PORT` | no | Railway injects it; default 8787 |
| `REDIS_URL` | no | e.g. `rediss://default:<pass>@<host>:6379` (Upstash TCP). Unset → in-memory |
| `FLUSH_INTERVAL_MS` | no | default 3000 |
| `ROOM_TTL_SECONDS` | no | default 172800 (2 days) |

## Local dev

    docker-compose up -d                 # repo root — Redis on localhost:6379
    cd relay && npm install
    BATTLEMAP_RELAY_SECRET=dev-secret-change-me REDIS_URL=redis://localhost:6379 npm run dev

App side (`.env.local`): `BATTLEMAP_RELAY_SECRET=dev-secret-change-me`,
`NEXT_PUBLIC_BATTLEMAP_RELAY_URL=ws://localhost:8787`.

## Railway deploy

1. New service from this GitHub repo; set **Root Directory = `relay`**.
2. Set env vars: `BATTLEMAP_RELAY_SECRET` (same as Vercel), `REDIS_URL` (Upstash TCP URL from the Upstash console — the `rediss://` one, not the REST URL).
3. Railway builds via `relay/railway.json` and health-checks `/healthz`.
4. Set `NEXT_PUBLIC_BATTLEMAP_RELAY_URL=wss://<service>.up.railway.app` on Vercel and redeploy the app.
