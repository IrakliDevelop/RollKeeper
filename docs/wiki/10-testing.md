# Testing

There are **three separate test runners** in this repo, plus a large family of
purpose-specific Playwright e2e suites. `package.json`'s `"test"` script name
history is confusing — read this before assuming what `npm run test` actually
does.

## 1. Vitest — component/unit tests

`vitest.config.ts` defines two **projects**:

- **`unit`** — jsdom, `src/**/*.test.{ts,tsx}`, setup at `src/test/setup.ts`.
  Node is launched with `--no-experimental-webstorage` to stop Node's native
  global `localStorage` from shadowing jsdom's implementation.
  → `npm run test` = `vitest run --project unit`. **This is plain jsdom, no
  real browser.**
- **`storybook`** — real Chromium via `@vitest/browser-playwright`, driven by
  `.storybook/` config and `.storybook/vitest.setup.ts` (Storybook Component
  Tests).
  → `npm run test:visual` = `vitest run --project storybook`.

`npm run test:all` runs both. `npm run test:watch` watches the `unit` project
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
| `test:rollback:drill` | `scripts/run-rollback-drill.mjs` — storage rollback verification |

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
