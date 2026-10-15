# Testing

There are **three separate test runners** in this repo, plus a large family of
purpose-specific Playwright e2e suites. `package.json`'s `"test"` script name
history is confusing — read this before assuming what `npm run test` actually
does.

## 1. Vitest — component/unit tests

`vitest.config.ts` defines three **projects**:

- **`unit`** — jsdom, `src/**/*.test.{ts,tsx}` (minus `*.browser.test.tsx`),
  setup at `src/test/setup.ts`.
  Node is launched with `--no-experimental-webstorage` to stop Node's native
  global `localStorage` from shadowing jsdom's implementation.
  → `npm run test` = `vitest run --project unit`. **This is plain jsdom, no
  real browser.**
- **`storybook`** — real Chromium via `@vitest/browser-playwright`, driven by
  `.storybook/` config and `.storybook/vitest.setup.ts` (Storybook Component
  Tests).
- **`browser`** — plain component tests in real Chromium,
  `src/**/*.browser.test.tsx`. Use it when real layout, hit-testing or CDP
  input matters (jsdom has no layout), e.g. a click that a layout shift
  could lose. Real IndexedDB persists across tests in the page; delete the
  databases in `afterEach`.
  → `npm run test:visual` = `vitest run --project storybook --project
  browser` (the CI Storybook job runs it).

`npm run test:all` runs all three. `npm run test:watch` watches the `unit` project
only. **Correction to a common assumption:** `npm run test` alone does *not*
touch Storybook or a real browser — only `test:visual` does.

There's also a large family of scoped coverage configs for in-progress
migration slices: `npm run test:sliceNN:coverage` for slices 8, 9, 10a1,
10a2, 10b, 11a–11g (`config/vitest/sliceNN.config.ts`), and
`test:player-backup-wizard:coverage`. Run the slice-specific one when working
inside that slice's domain rather than the full suite.

## 2. Playwright — end-to-end

`npm run test:e2e` is the general suite. Purpose-specific configs, each with
its own npm script:

| Script | Covers |
|---|---|
| `test:fog:e2e` | Fog of war ([07](07-battlemap-fog-fieldnotes.md)) |
| `test:indexeddb:e2e` | IndexedDB migration + player-backup recovery together ([03](03-persistence-and-storage-migration.md), [06](06-player-backup-wizard.md)) |
| `test:automatic-sync:e2e` | Automatic character cloud sync |
| `test:auth:e2e` | Auth + auth wizard flows |
| `test:reconnect:nightly` | Cross-tab/single-writer sync repeated 3x, plus a dedicated reconnect drill — nightly, not part of normal CI |
| `test:checkpoint-matrix:nightly` | Storage checkpoint matrix — nightly |
| `test:sheet-drawer:e2e` | Player battle-map character-sheet drawer and party limited view on a live Table scene ([relay](07-battlemap-fog-fieldnotes.md)-backed), the DM creature drawer plus roster placement in the private original editor, and the DM's offline changes kept through a later edit and a checkpoint, then reapplied (`e2e/table-offline-changes.spec.ts`); CI job "Table relay e2e" and nightly |
| `test:loot:e2e` / `test:shop:e2e` | Marker loot claim and shop purchase across DM and player on a live Table scene; CI job "Table relay e2e" |
| `test:rollback:drill` | `scripts/run-rollback-drill.mjs` — storage rollback verification |

**Redis isolation (PR08 repair 07).** A developer's `.env` may point
`UPSTASH_REDIS_REST_*` at a real Upstash database, and Next loads it for any
key the process does not set. Every Playwright app server is therefore
started through `withLocalRedis` (`config/playwright/e2eRedis.ts`), which sets
both keys explicitly: empty (no Redis, the same as CI) for most suites, or
the local serverless-redis-http on `localhost:8079` for the relay-backed
loot, shop and sheet-drawer suites. A non-local URL exported in the shell
fails the run before any server starts, and app servers never reuse an
already running dev server (`reuseExistingServer: false`), so stop your own
`npm run dev` first. The relay dev server is started the same way
(`withLocalRelayRedis`): `REDIS_URL` is set to `redis://localhost:6379` on
its command (which wins over `relay/.env`, loaded with
`--env-file-if-exists`), a non-local `REDIS_URL` in the shell fails the run,
and a running relay is never reused. The relay-backed suites need Redis on 6379 and
serverless-redis-http on 8079 (`docker compose up -d`, or disposable
containers) plus `npm ci --prefix relay`.

Real-Redis Table suites (CI job "Relay and Table control Redis suites", see
[15](15-scenes-and-table.md)):

| Script | Covers |
|---|---|
| `test:relay:redis` | Relay authority, fog CAS and transport suites; needs `REDIS_TEST_URL` pointing at **Redis 7 or newer** (fails fast otherwise, never skips) |
| `test:table-control:redis` | Table control Lua against disposable Redis and serverless-redis-http containers it starts itself (needs Docker) |

Nightly/drill suites are **not** expected to run on every PR — they exist for
scheduled verification of the storage-migration and sync subsystems
specifically. If you're changing code in [03](03-persistence-and-storage-migration.md)
or [05](05-cloud-backend-supabase.md), consider running the relevant one
manually rather than relying on default CI.

## 3. Node's built-in test runner — backend integration tests

`node --test scripts/*.integration.test.mjs`, run against a real local
Supabase instance. Covers: DB integration, guest-session HTTP, membership
(integration + HTTP), campaign-settings (integration + HTTP + Redis),
calendar (integration + Redis), magic-item, npc, encounter,
combat-log-archive, auth, backup-restore drill, and a Supabase reset/replay
check. Scripts: `test:db:integration`, `test:guest:http`,
`test:membership:integration`/`:http`, `test:campaign-settings:integration`/
`:http`/`:redis`, `test:calendar:integration`/`:redis`,
`test:magic-item:integration`, `test:npc:integration`,
`test:encounter:integration`, `test:combat-log-archive:integration`,
`test:auth:integration`, `test:db:backup-restore`, `test:db:replay`. Requires
`npm run db:start` first.

## Quality gates (not tests, but adjacent)

`npm run lint:ci` / `format:ci` run `scripts/quality-ratchet.mjs` — a
ratchet script, not a plain lint/format pass. `npm run db:types:check`
verifies generated Supabase types match the schema
(`scripts/verify-supabase-types.mjs`).

## Manual browser acceptance (Claude-specific)

For PRs touching browser-visible UI, navigation, auth, local persistence,
IndexedDB, offline behavior, downloads, network failures, or cloud-sync
controls: run `/rollkeeper-manual-browser` after automated checks pass. See
[14-agent-guidance.md](14-agent-guidance.md) — do not substitute this with
Storybook/Vitest/Playwright/curl/headless Chromium.
