# Live Campaign Sync (Redis)

This is the real-time DM ↔ player sync used during an active session — rosters,
initiative, effects, battle map state, calendar. It is **ephemeral** (Upstash
Redis, no long-term durability guarantee) and entirely separate from the
Supabase-backed durable storage covered in [05](05-cloud-backend-supabase.md)
and [06](06-player-backup-wizard.md). Don't conflate the two: this system
answers "what is happening in the session right now"; Supabase answers "what
survives across devices/sessions/backups."

## Core hook: `useCampaignSync`

`src/hooks/useCampaignSync.ts`. Polls `GET /api/campaign/{code}/players` on an
interval (default 10s). Auto-pauses after 5 minutes of user inactivity
(mousemove/keydown/mousedown/touchstart/scroll listeners reset the idle
timer) — don't assume it polls forever in the background.

**Self-healing:** if the poll returns `data.campaign === null` (the DM's Redis
campaign record expired or was evicted), the hook recreates it via
`PUT /api/campaign/{code}` (`restoreCampaign`). This means a DM's Redis record
can silently expire and get transparently recreated — if you're debugging
"campaign state reset unexpectedly," check for this path before assuming a bug
elsewhere.

## The wider sync-hook family

`useCampaignSync` is the roster/session-level hook, but there's a whole family
of narrower ones, each polling/pushing one slice of live state — don't build a
new one without checking if an existing one already covers your domain:

| Hook | Domain |
|---|---|
| `usePlayerSync` | A single player's pushed character snapshot |
| `usePartySync` | Party-wide aggregate state |
| `useDmEffectsSync` | DM-broadcast effects/notifications |
| `useDmBattleMapSync` | Battle map state |
| `useSharedCampaignState` | Generic shared campaign state |
| `useMaterializeCampaignStackable` | Stackable campaign resources |
| `useInitiativeSubmissionSync` / `useDmInitiativeSync` | Initiative rolls |
| `useCharacterRosterSync` | Roster-level sync |
| `useDmSettingsSync` | Campaign settings |
| `useLocationSync` | Campaign locations |
| `useTurnRequestSync` | Turn-taking requests |
| `useDmCounterSync` | DM counters |
| `useDmCalendarSync` | Campaign calendar |

## API routes

The `*-sync` routes under `src/app/api/` (`calendar-sync`, `combat-log-sync`,
`encounter-sync`, `magic-item-sync`, `npc-sync`) back these hooks. See
[08-api-routes.md](08-api-routes.md) for the full inventory — these are
distinct from the `campaign/[code]/*` membership/guest-session routes, which
are Supabase-backed auth, not Redis session sync.

## Local development

Start Redis before working on anything in this file:

```bash
docker-compose up -d   # Redis + serverless-redis-http on port 8079
```

`.env.local` defaults (from `.env.example`) point at this local stack.
