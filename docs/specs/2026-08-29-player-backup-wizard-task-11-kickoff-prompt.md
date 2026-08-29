# Fresh-chat kickoff prompt: Player Backup Wizard Task 11 — regression gates and manual acceptance preparation

Copy the prompt below into a fresh Codex chat to implement Task 11 from the
approved Player Backup Wizard plan. Keep the work in one focused pull request.
This is the final implementation task in the plan; stop before rollout or
feature-flag enablement.

---

Implement **Player Backup Wizard Task 11: regression gates and manual
acceptance preparation** from
`docs/specs/2026-08-26-player-backup-wizard-plan.md`.

This task turns the completed Tasks 1–10 implementation into an explicit,
repeatable regression contract. Add a focused per-file Vitest coverage gate for
the player-backup safety boundary, wire it into CI, and extend the RollKeeper
manual-browser checklist with the complete player-wizard acceptance section.
Do not change player-backup behavior merely to make the gate easier to satisfy,
and do not enable the default-off feature.

## Start only from the merged Task 10 baseline

Before editing:

1. Read `AGENTS.md`.
2. Read the complete approved plan:
   `docs/specs/2026-08-26-player-backup-wizard-plan.md`. Pay particular
   attention to Task 11, the complete verification plan, all 19 final browser
   scenarios, the acceptance criteria, and the rollout/non-goal sections.
3. Confirm PR [#279](https://github.com/IrakliDevelop/RollKeeper/pull/279) is
   present on `master`. Its squash merge commit is
   `ccd421cb52ce498df9802ce33fb508267db1c3fb`.
4. Audit the current player-backup implementation and tests before choosing the
   coverage boundary:
   - `src/lib/playerBackup/`
   - `src/components/ui/character/PlayerBackupWizard/`
   - `src/components/ui/character/PlayerBackupManager.tsx`
   - `src/components/ui/character/PlayerBackupRecovery.tsx`
   - `src/components/ui/character/usePlayerBackupDashboard.ts`
   - `src/app/player/backup/`
   - `src/components/PersistenceBootstrap.tsx`
   - the character authority, recovery, and automatic-sync modules reused by
     those surfaces.
5. Audit the existing regression infrastructure:
   - `config/vitest/slice8.config.ts`
   - `config/vitest/slice9.config.ts`
   - `config/vitest/slice10b.config.ts`
   - `package.json`
   - `.github/workflows/ci.yml`
   - `.agents/skills/rollkeeper-manual-browser/SKILL.md`
   - `.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`
   - `.agents/skills/rollkeeper-manual-browser/scripts/generate-fake-seed.mjs`
6. Record the existing gates instead of replacing them. In particular, CI
   already runs the automatic-sync coverage contract and an IndexedDB per-file
   contract over `src/lib/indexeddb/*.ts`; Task 11 adds the missing
   player-wizard safety contract alongside those gates.
7. Confirm the merged Task 10 recovery coverage remains above the existing
   IndexedDB thresholds. `characterRecovery.ts` was raised to 94.5% statements
   and 88.41% branches before merge; a new gate must not hide or weaken that
   contract.
8. Update `master`, then create a fresh branch named
   `feat/player-backup-regression-gates`. Do not continue on the merged Task 10
   branch.
9. Preserve unrelated local and untracked files. Files under `docs/specs/` may
   be excluded locally; do not force-add this kickoff prompt to the
   implementation PR.

Write a short implementation plan after the audit, then begin. Additional
product planning is not expected unless the merged safety boundary differs
materially from the approved plan.

## Pull request outcome

Deliver one focused PR that:

- adds `config/vitest/playerBackupWizard.config.ts` with explicit test and
  production-module lists for the player-backup safety boundary;
- adds a stable package script for that contract and runs it as a named CI
  quality step;
- enforces per-file thresholds without weakening any existing coverage gate;
- adds only the tests required to cover real destructive, consent,
  account-routing, conflict, recovery, and stale-response branches;
- adds a complete **Player Backup Wizard** section to the existing RollKeeper
  manual-browser acceptance checklist while retaining every current section;
- makes the checklist self-contained about flags, isolated origins,
  deterministic seed evidence, fake auth/cloud requirements, artifacts,
  failure paths, durability, accessibility, and verdict reporting;
- keeps the player-backup umbrella flag and every lower capability flag
  default-off; and
- changes no product behavior, persistence schema, API, copy, or rollout
  configuration unless a newly exposed regression proves the merged contract
  is actually broken.

## Focused coverage contract

Create `config/vitest/playerBackupWizard.config.ts` following the repository's
existing focused Vitest configs:

- repository-root resolution and the `@` alias;
- `jsdom`, the shared test setup, and the current web-storage execution option;
- V8 coverage with text and JSON-summary reporters;
- a dedicated reports directory such as `coverage/player-backup-wizard`;
- explicit `test.include` and `coverage.include` lists; and
- per-file thresholds of at least 90% statements, 90% functions, and 85%
  branches.

Do not use a broad glob that lets well-tested pure copy or presentation modules
mask an under-tested destructive module. Coverage must be per-file. Do not
lower another slice's thresholds, remove an existing CI step, or merge the
player gate into the broad IndexedDB command.

At minimum, audit these production modules for inclusion:

- `playerBackupCoordinator.ts`
- `playerBackupConflictCoordinator.ts`
- `playerBackupRunFence.ts`
- `playerBackupRunRepository.ts`
- `playerBackupActiveSelection.ts`
- `playerBackupOnlineExecution.ts`
- `playerBackupOngoingExecution.ts`
- `playerBackupSafety.ts`
- `playerBackupRecoveryPolicy.ts`
- `playerBackupManagement.ts`

Include each module that owns player consent, selection partitioning, account
or run identity, destructive cloud action, conflict preservation, recovery
write eligibility, acknowledgement, or stale-response rejection. Exclude a
module only with a concrete reason documented in the config or PR. Do not add
React components to `coverage.include` merely to inflate the gate; component
behavior remains covered by its focused unit and Storybook tests.

The test list should reuse the existing focused player-backup, automatic-sync,
IndexedDB, recovery, route, dashboard, manager, wizard, and bootstrap tests
that execute those modules. Add small red-first tests only for uncovered real
branches. Do not add assertions that merely call lines without proving the
safety outcome.

Add a package script named `test:player-backup-wizard:coverage` unless the
repository has adopted a clearer current naming convention during the audit.
Add one named step to the CI quality job immediately after the related
player/IndexedDB coverage gates. The local command and CI command must be
identical.

## Safety branches the gate must prove

The focused tests selected by the new contract must collectively prove:

- view, navigation, sign-in, sign-out, reload, and account discovery never
  create consent, local authority, preferences, links, documents, pending work,
  or cloud writes;
- confirmation is account-locked and compare-and-replace fenced to the active
  run;
- selected and cleared IDs are disjoint and exactly partition the locked
  eligible snapshot;
- the consent run and complete preference partition are durable before local
  preparation or online work begins;
- stale tabs, stale accounts, stale responses, and unavailable locks fail
  closed without mutation;
- ongoing and one-time modes preserve their recorded scope across reload and
  resume;
- paused, cleared, archived, future-format, unavailable, unreadable, newer, and
  different rows cannot be silently enrolled or overwritten;
- degraded manual-only mode admits only missing, identical, and exact
  recognized linked rows and rechecks them under the account lock;
- response loss reuses mutation identity, while an explicit conflict preserves
  both candidates and does not auto-retry;
- keep-local, use-online, and keep-both retain the losing candidate, and
  keep-both starts with ongoing backup off;
- account switching removes the old account's render and action authority
  synchronously and never adopts its run;
- pause, resume, future-default changes, back-up-now, and soft online removal
  affect only the intended account and character;
- generic recovery trusts the code-owned key policy rather than file-provided
  classification, preserves collisions, and writes no control record;
- active-character recovery remains staged and inactive until separate
  confirmation, and success requires exact bytes plus visible IDs from the
  selected authority; and
- rollback, activation, and rebind remain evidence-, parity-, reopen-, epoch-,
  journal-, quarantine-, and account-gated as applicable.

If an uncovered branch represents impossible defensive code, prove why before
using a narrowly targeted ignore. Do not use coverage ignores for reachable
error, account-switch, lock, conflict, recovery, or destructive branches.

## Manual-browser checklist update

Extend
`.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`.
Do not replace, reorder away, or weaken the shared Baseline, UI/navigation,
character persistence, IndexedDB, auth/cloud, network/offline, downloads, Slice
11F, Slice 11G, or evidence-template sections.

Add a new top-level section named **Player Backup Wizard** before the
slice-specific DM sections. State that it applies when a PR changes the player
backup wizard, dashboard summary/manager, backup coordinator, account routing,
character cloud controls, local character authority, recovery, or relevant
flags.

The section must require:

- the Codex desktop in-app Browser through the existing skill;
- ephemeral local servers and isolated `.localhost` origins only;
- the deterministic fake seed, created through the visible character UI and
  then supplemented with the seed script's unrelated entries;
- local fake auth, fake cloud/gateway services, and no real credentials or
  production endpoint;
- exact flag values, branch, commit, port, origin labels, seed version,
  counts/bytes, and abbreviated hashes in the report;
- independent validation of every downloaded recovery artifact; and
- an explicit passed, failed, or blocked verdict without raw payloads,
  credentials, cookies, or secrets.

Use the approved origins or equivalent fresh labels:

- `rk-player-control.localhost` for umbrella-off compatibility;
- `rk-player-a.localhost` and `rk-player-b.localhost` for participating
  account and account-switch isolation;
- `rk-player-conflict.localhost` for independent same-account conflict work;
- `rk-player-race.localhost` for two-tab run fencing and lock behavior; and
- `rk-player-degraded.localhost` for lower-capability combinations.

Preserve the plan's full scenario coverage. The checklist may make the wording
more operational, but it must not collapse away any of these numbered areas:

1. Deterministic seed creation and identical starting raw-pair/hash evidence.
2. Umbrella-off legacy control plus a fresh wizard-on passive-view database
   non-creation check.
3. Visible launcher, signed-out/sign-in return, read-only status discovery, and
   zero implicit mutation.
4. Broad and current-character safety-file download, independent validation,
   verified receipt, re-selection, and full-vector source-change refusal.
5. Cancellation before confirmation and safe durable resume after reload.
6. Default all-character ongoing setup, previously paused selection, atomic
   selected-on/cleared-off/future-default partition, activation, and validated
   online acknowledgement.
7. Durable compact dashboard status after reload, navigation, acknowledged
   edit, and second same-origin tab.
8. One-time mode with a cleared character, crash/reload before the first link,
   exact-scope resume, no later automatic work, and explicit **Back up now**.
9. Offline confirmed edits, retained pending work, reconnect/retry, and
   committed-response-loss mutation identity reuse.
10. All three conflict resolutions from fresh deterministic resets, including
    losing-candidate retention and keep-both default-off behavior.
11. Future-format online data, exact recovery artifact retention, friendly
    vocabulary, and no active-local overwrite.
12. Account A to B switching with unfinished work, immediate isolation, zero B
    write before new confirmation, and exact A resume after switching back.
13. Pause/resume, future-default off/on, soft online removal, local-data
    retention, and character scoping.
14. Generic and dedicated recovery before/after cutover, forged
    classifications, invalid/checksum/aggregate failures, inactive quarantine,
    explicit activation, divergent candidates, artifacts, and gated rollback.
15. End-of-run byte identity for unrelated DM, encounter, NPC, calendar,
    location, battle-map, combat-log, magic-item, canvas, theme, and sentinel
    data except an explicitly targeted recovery value.
16. Desktop and 390 px layouts; light, dark, and parchment themes; keyboard,
    focus, accessible names, live regions, contrast, and horizontal overflow.
17. Same-account two-tab compare-and-replace race, one winning run, zero stale
    mutation, account-lock serialization through acknowledgement, and
    unavailable-lock fail-closed behavior.
18. Every degraded lower-flag combination, safe-row-only selection, all-
    contested refusal, locked recheck drift, explicit post-consent conflict,
    recovery guidance, and a clean manual copy with no authority or automatic
    work change.
19. First-activation recovery evidence, stale compatibility mirror and failed
    retry, separate active-row artifact, account-B rebind preserving immutable
    activation fields, missing/mismatched evidence refusal, explicit inactive
    recovery import/activation, divergent recovery, and later reconciled
    single-file parity.

For every scenario, require visible user actions, durable storage/server
evidence, relevant network mutation counts, reload or multi-tab proof, failure
path evidence, and final unrelated-data hashes. A success label, HTTP status,
Playwright result, or storage screenshot alone is insufficient.

Keep the shared evidence template compact. Add player-specific fields only if
the existing eight-part structure cannot express an essential proof.

## Red-first implementation sequence

1. Add the new config and package script with the intended explicit boundary.
2. Run the new command and record the initial per-file failures.
3. Add the smallest behavior-focused tests for real uncovered branches.
4. Re-run until every included file meets the threshold.
5. Add the named CI step without changing any existing gate.
6. Add the Player Backup Wizard checklist section and check its 19 scenarios
   against the approved plan one by one.
7. Run the new gate exactly as CI will run it, followed by the existing related
   coverage and regression commands.

Do not write low-value tests before observing the actual coverage gaps. Do not
change production code unless a focused test demonstrates a real merged defect;
if that occurs, keep the fix narrow and report that Task 11 is no longer a
configuration/checklist-only change.

## Hard scope boundary

Do not include:

- feature-flag enablement, environment rollout, rollout percentages, or removal
  of any default-off gate;
- player-backup UI, copy, orchestration, recovery, authority, or cloud behavior
  changes solely for coverage;
- new APIs, RPCs, SQL migrations, object stores, persistence formats, cloud
  services, dependencies, or test frameworks;
- weaker thresholds, aggregate-only thresholds, broad coverage globs that hide
  per-file gaps, or exclusions for reachable safety branches;
- removal or renaming of existing coverage scripts without a separately proven
  repository-wide need;
- execution of real-account or production-cloud manual tests;
- claiming the final 19-scenario browser acceptance passed merely because the
  checklist was written; or
- unrelated cleanup, refactors, formatting churn, or generated-session links.

Task 11 prepares the final product acceptance gate. Because the expected PR
changes only test configuration, CI wiring, tests, and checklist documentation,
the PR's own manual-browser gate is normally **not applicable** under
`AGENTS.md`; state that reason explicitly. If the implementation changes any
browser-visible behavior, navigation, auth, persistence, IndexedDB, offline,
downloads, failure handling, or cloud controls, the normal in-app Browser gate
becomes mandatory before the PR is ready.

## Required automated verification

Run and report at minimum:

```text
npm run test:player-backup-wizard:coverage
npm run test:slice8:coverage
npm run test:slice9:coverage
npm test -- src/lib/indexeddb src/lib/playerBackup --coverage.enabled=true --coverage.provider=v8 --coverage.reporter=text --coverage.include='src/lib/indexeddb/*.ts' --coverage.thresholds.perFile=true --coverage.thresholds.statements=90 --coverage.thresholds.functions=90 --coverage.thresholds.branches=85
npm run test:indexeddb:e2e
npm run test:automatic-sync:e2e
npm test
npm run test:visual
npm run type-check
npm run lint:ci
npm run format:ci
npm run build
npm run test:ci-tools
```

If no SQL, server route, authentication runtime, or database type changes are
made, the database/auth suites may be recorded as not applicable for this
configuration/checklist PR because the latest Task 10 baseline already passed
them. If production code changes, expand verification proportionally and run
every affected integration/database gate from the plan. Treat an
environment-blocked check as blocked, not passed.

Review the resulting CI run and confirm the new named player-wizard coverage
step executes the same command and thresholds as the local script. Do not call
the PR ready while that step is absent, skipped, or failing.

## Pull request handoff

Keep the PR concise per `AGENTS.md`. Include only:

- the focused coverage boundary and thresholds;
- the new CI command/step;
- the added Player Backup Wizard checklist coverage;
- exact automated checks run and their outcomes; and
- any real uncovered defect, limitation, or prerequisite blocker.

Do not include an implementation diary, raw logs, repeated rationale, or
generated-session links. Do not merge the PR. Stop after Task 11 is implemented,
verified, pushed, and ready for review. Do not enable rollout flags in this
branch.
