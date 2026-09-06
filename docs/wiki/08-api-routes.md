# API Routes (`src/app/api/`)

Two broad categories:

1. **Static game-data routes** — serve/filter the JSON in `/json`
   ([11](11-game-data-json.md)). Read-only, no auth.
2. **Sync/backend routes** — Redis live-session sync (`*-sync`), Supabase
   campaign/membership/guest-session flows, and internal projection endpoints
   for the durable-DM family ([05](05-cloud-backend-supabase.md)).

| Route | Purpose |
|---|---|
| `backgrounds`, `feats`, `races`, `senses`, `classes`, `items`, `weapons-db`, `armor-db` | Static game-data lookups |
| `bestiary` (+ `token`, `search`) | Monster stat block data + search |
| `spells` | Spell data |
| `magic-items` | Magic item reference data |
| `campaign` (+ `[code]`, `membership-readiness`, `membership-links`, `membership-invitations`, `guest-sessions`, `guest-session`, `guest-invitations`) | Supabase-backed campaign membership + guest-session flows ([05](05-cloud-backend-supabase.md)) |
| `campaign/[code]/battlemaps` (+ `[id]/fog-appearance`), `campaign/[code]/battlemap-token` | Battle map + fog state ([07](07-battlemap-fog-fieldnotes.md)) |
| `calendar-sync`, `combat-log-sync`, `encounter-sync`, `magic-item-sync`, `npc-sync` | Redis live-session sync endpoints ([04](04-campaign-sync-redis.md)) |
| `character` (+ `share`) | Character data, including character-sharing links |
| `npc` (+ `upload`, `delete`) | NPC library CRUD + asset upload |
| `campaign-settings` | Campaign-level settings |
| `internal` (`calendar-projection`, `campaign-settings-projection`) | Internal-only endpoints backing the durable-DM projection layer — not for client use outside that system |
| `avatar` (+ `upload`, `delete`), `banner` (+ `upload`, `delete`), `assets` (+ `upload`, `proxy`) | S3-backed image upload/serving |
| `tools` | Misc DM/utility endpoints |

For exact nested routes and request/response shapes, read the route file
directly — this table is a map, not a contract.
