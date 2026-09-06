# Cloud Backend (Supabase)

Supabase is the durable, cross-device backend — auth, campaign membership,
guest sessions, and the "durable DM" per-entity sync family. It is separate
from the ephemeral Redis session sync ([04](04-campaign-sync-redis.md)) and
from the player-facing backup/restore wizard ([06](06-player-backup-wizard.md)),
though the durable-DM family and the backup wizard both write to Supabase.

## Local development

```bash
npm run db:start   # supabase start (local stack)
npm run db:reset   # supabase db reset --local
npm run db:types    # regenerate src/types/database.generated.ts
```

## Schema evolution (read `supabase/migrations/` for ground truth)

18 migrations dated 2026-08-16 through 2026-08-26, evolving from a full schema
reset through: character table + RPC-only writes + hardened privileges →
manual backup table → DM workspace identity → hybrid guest sessions (private
RLS) → campaign membership cutover → a **generic `campaign_documents` table
pattern**, with per-entity-type documents then registered on top of it
(calendar, magic-item, npc, encounter, combat-log-archive) — plus one fix
migration for JSON-key collation. The generic documents table is the storage
substrate for the entire "durable DM family" system below, not a set of
separate per-entity tables.

## `src/lib/supabase/` — server-side gateways/services

`authService` / `authConfig`, `campaignMembershipGateway` /
`campaignMembershipGatewayServer`, `characterCloud` /
`characterCloudCodec` / `characterCloudGateway` / `characterCloudLinks` /
`characterCloudRecovery`, `dmWorkspaceGateway` / `dmWorkspaceService`,
`guestSessionGateway` / `guestSessionGatewayServer`, `encounterServer`,
`npcServer`, `magicItemServer`, `calendarServer`, `combatLogArchiveServer`,
`campaignSettingsServer`, and the `automaticCharacterSync*` family
(`Coordinator`/`Puller`/`Runtime`/`Service`/`Worker`/`Preferences`/
`Validation`) — the background engine that pulls/pushes character data to
Supabase automatically (distinct from the manual backup wizard in
[06](06-player-backup-wizard.md)).

## `src/lib/durableDm/` — the per-entity "family" migration

For each domain — `calendar`, `campaignSettings`, `combatLogArchive`,
`encounter`, `magicItem`, `npc` — there's a matching set:

- `*Family.ts` — the domain's sync family definition
- `*AwareStorage.ts` — storage wrapper aware of authority state
- `*HttpGateway.ts` — HTTP client to the Supabase-backed API route
- `*LegacyProjection.ts` / `*LegacyAuthority.ts` — bridges from the
  pre-migration (Redis-authoritative) shape
- `*SyncService.ts` — the sync orchestration itself
- `*ProjectionServer.ts` — server-side projection endpoint (used by
  `src/app/api/internal/*-projection` routes)

This is a **systematic migration from Redis-authoritative to
Supabase-authoritative storage, rolled out one domain at a time, flag-gated
per slice** (`slice8` … `slice11g` — see `config/vitest/sliceNN.config.ts` and
`src/lib/durableDm/slice11[a-g]Flags.ts`). Each slice has its own coverage test
command (`npm run test:sliceNN:coverage`). Don't assume a domain has fully cut
over to Supabase-authoritative just because its `durableDm` files exist —
check the slice flag (see [13](13-feature-flags-and-gated-work.md)).

## Guest sessions & campaign membership

`src/lib/guestSessionService.ts`, `guestSessionCrypto.ts`,
`guestSessionSecurity.ts`, `guestPlayerProjection.ts`,
`guestRouteAuthorization.ts` handle the "join a campaign without a full
account" flow. `campaignMembershipAuthority.ts`,
`campaignMembershipService.ts`, `campaignMembershipSecurity.ts`,
`campaignMembershipToken.ts`, `campaignAuthorityRouter.ts` handle the
authenticated-DM/player membership model. Both are backed by the
`campaign/[code]/membership-*` and `campaign/[code]/guest-*` API routes — see
[08-api-routes.md](08-api-routes.md).

## Integration test coverage

Node's built-in test runner (not vitest) exercises this layer directly against
a local Supabase instance: `npm run test:db:integration`,
`test:guest:http`, `test:membership:integration` / `test:membership:http`,
`test:campaign-settings:integration` / `:http` / `:redis`,
`test:calendar:integration` / `:redis`, `test:magic-item:integration`,
`test:npc:integration`, `test:encounter:integration`,
`test:combat-log-archive:integration`, `test:auth:integration`,
`test:db:replay`. See [10-testing.md](10-testing.md).
