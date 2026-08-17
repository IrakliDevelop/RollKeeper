# Slice 10A.1 acceptance evidence

## Scope and environment

- Branch: `feat/slice-10a1-dm-cloud-workspace-identity`
- Implementation commit tested manually: `a04bc8a8`
- Baseline: `168bec08f9bb051843bc190beffc4a47c436b8cf`
- Feature flag: `NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED`; absent/false by default
- Manual enabled run: local auth plus the workspace flag, port `3110`
- Manual disabled run: local auth only, port `3110`
- Isolated origins: `rk-pr-seed.localhost`, `rk-pr-a.localhost`, and
  `rk-pr-b.localhost`
- Cloud schema target: the connector-verified empty `Rollkeeper-dev` project;
  no deployed feature flag was enabled

Slice 10A.2 guest invitations and sessions are not present. This slice changes
no player enrollment, character links, guest namespace, automatic upload,
durable-family cutover, Redis/relay runtime, combat, presence, initiative, HP,
or legacy player join/play behavior.

## Red/green evidence

The initial focused suites failed because the authority router, transactional
workspace repository, service, gateway, browser adapter, and controls did not
exist. The pre-migration pgTAP run failed 26 assertions because the tables and
RPCs did not exist. The foreign-key advisor follow-up was also captured as four
failing pgTAP index assertions before the index migration made them green.

Final focused result:

- 6 files, 34 tests
- 99.27% statements, 97.84% branches, 100% functions, 100% lines
- Includes ownership, wrong-account denial, claim replay/race, changed-input
  replay denial, sanitized provenance, fail-closed authority routing,
  transaction rollback, account-isolated durability, offline outbox state,
  default-off behavior, and keyboard activation

## Database and remote review

- Clean local reset applied both Slice 10A.1 migrations successfully.
- pgTAP: 4 files, 65 tests passed.
- Database lint: no schema warnings.
- Generated types match the reset local schema.
- Database integration: 2 tests passed, including simultaneous one-time claim
  serialization and account isolation.
- Auth integration: 2 tests passed.
- Reset/replay: 2 tests passed; two clean resets produced identical schema
  fingerprints and migration lists.
- The exact connector project was matched to the reviewed local project before
  remote mutation. Its RollKeeper tables and auth data were empty.
- `create_dm_workspace_identity` and `index_dm_workspace_foreign_keys` were
  applied remotely. Post-apply RollKeeper tables remained empty and RLS-enabled.
- Post-index advisor review left only the pre-existing mutation-receipt foreign
  key notice plus expected unused-index notices on the new empty tables.

## Automated regression gates

- Unit suite: 351 files passed, 1 skipped; 4,549 tests passed, 2 skipped.
- Production Next.js build passed.
- Type check passed.
- ESLint ratchet: 68 warnings within the allowance of 69.
- Prettier ratchet: 263 deviations within the allowance of 273.
- CI-tool tests: 3 passed.
- Storybook interactions: 29 files, 206 tests passed.
- Standard Chromium E2E: 15 passed.
- IndexedDB Chromium E2E: 3 passed.
- Auth Chromium E2E: 2 passed.
- Automatic-sync gating E2E: 1 passed.
- Relay tests: 53 passed; relay build passed.
- Real Redis equal-revision CAS integration: 1 passed against a disposable
  Redis 8.10 container, which was then removed.

## Desktop in-app Browser evidence

### Synthetic seed

- Seed format version: 1
- Generator entries: 9, 882 UTF-8 bytes, manifest `00fabc6abe39…`
- After visibly creating `Mira Vale — Synthetic Acceptance`, the complete
  copied profile contained 13 RollKeeper entries and 8,616 UTF-8 bytes.
- Abbreviated per-entry hashes:
  `battlemap fdc8a5bbae78`, `calendar 85d01fe20867`,
  `character 64d7a1d56ff4`, `combat d67b3dae10c5`,
  `DM add542425d6c`, `magic-items 9acb049faad2`,
  `encounter 8a8c15852939`, `initiative b5bea41b6c62`,
  `location a8c4f61bc672`, `sentinel 8a0792543b8c`,
  `NPC 19bb25001f48`, `party-HP fcbcf165908d`, and
  `player 59e5300ca088`.
- Seed, participating, and control profiles had identical raw pairs, byte
  counts, and per-entry hashes before testing.

### Visible actions and outcomes

1. Loaded `/dm` on participating and control origins. With the local flag on,
   the owner-only card appeared; viewing created no cloud mutation.
2. Clicked fork while signed out. The UI requested sign-in, made no request,
   and created no RollKeeper IndexedDB database.
3. Signed in through `/account` with local fake auth and Mailpit only. Login and
   back navigation left every seeded RollKeeper entry unchanged and created no
   workspace database.
4. Forked `Synthetic Acceptance Campaign` through the visible button. A new
   opaque code appeared, while the UI stated that the `MANUAL` legacy campaign,
   membership, every durable family, Redis, and relay were unchanged.
5. Created `Synthetic Owner Workspace` through the visible name input and
   button. It received a separate opaque code.
6. Proved both acknowledgements were already durable in `rollkeeper-local`:
   each document had a cloud ID/code, legacy membership and family authority,
   `redis_relay` live authority, and no acknowledged outbox entry.
7. Reloaded, navigated away/back, and opened a second same-origin tab. The
   explicit local-load action recovered both acknowledged codes each time.
8. Verified empty-name validation, native input/button labels and roles, and
   keyboard activation. The narrow 390x844 check had no horizontal overflow;
   all controls remained within the viewport. Light and dark theme colors both
   rendered with distinct surface/text values.

### Failure, isolation, and authority outcomes

- With network disabled only for the participating tab, owner creation showed
  the durable queued message. IndexedDB contained the unacknowledged document
  plus one `offline` outbox entry. Restoring network and reloading did not
  transmit it automatically because retry is intentionally disabled in this
  slice; the outbox remained durable.
- The untouched control origin never created `rollkeeper-local`, never made a
  cloud mutation, and retained all 13 seeded entries byte-identically.
- Restarting the same isolated server without the dedicated flag removed the
  card entirely and still created no RollKeeper database on the control origin.
- Logout preserved the local database and all seeded entries but exposed no
  account workspace code while signed out.
- Read-only local SQL for the two acknowledged workspaces showed 22 independent
  authority records: 2 legacy memberships, 16 legacy durable-family records,
  2 `redis_relay` live-runtime records, and 0 unexpected authorities.
- The fork action's observed requests were local Auth and the local Supabase
  workspace RPC only. It made no player mutation, legacy campaign mutation,
  Redis write, or relay request.
- Provenance contained one `new_workspace` row with no source fingerprint and
  one `import_fork` row with a 64-character sanitized fingerprint. It exposed
  zero raw campaign-code, dmId, recovery, token, or evidence columns.
- The participating profile's 13 seeded entries and the control profile's 13
  seeded entries remained byte-identical. The only added participating
  RollKeeper localStorage key was the intentionally exercised theme preference.
- Console review found no errors. Two existing layout-library position warnings
  appeared on the participating dashboard; control and second-tab logs were
  clean.

Downloads, recovery bundles, selection cancellation, stale migration response,
and authority rollback are not applicable: Slice 10A.1 adds none of those flows
and performs no migration or authority cutover. Guest invitations/sessions and
retry transmission remain explicitly outside this slice.

## Cleanup and verdict

All three synthetic origins were cleared individually: localStorage and
sessionStorage were empty and their IndexedDB databases were deleted. All
temporary in-app Browser tabs were finalized, the ephemeral server was stopped,
and no user browser origin/session was inspected or modified.

Verdict: **PASS** for Slice 10A.1. The PR is ready for review after CI and Vercel
checks complete; it must not be merged without explicit approval.
