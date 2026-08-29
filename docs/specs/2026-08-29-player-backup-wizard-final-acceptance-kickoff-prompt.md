# Fresh-chat kickoff prompt: Player Backup Wizard final acceptance and rollout readiness

Copy the prompt below into a fresh Codex desktop task to perform the final
Player Backup Wizard acceptance phase. This is a verification milestone after
Tasks 1–11, not a new implementation slice. Do not enable or roll out any
feature flag in this task.

---

Perform the **Player Backup Wizard final design review, regression run, and
interactive acceptance gate** from
`docs/specs/2026-08-26-player-backup-wizard-plan.md`.

Tasks 1–11 are merged. The objective now is to prove the complete shipped
default-off implementation against the approved prototypes, automated
contracts, and all 19 manual-browser scenarios. Do not invent Task 12 product
scope. If a real defect is found, reproduce it with the smallest focused test,
fix it narrowly, rerun proportional checks, and repeat every affected browser
action. If no defect is found, the deliverable is an evidence-backed acceptance
verdict; do not create code churn merely to produce a pull request.

## Start from the merged baseline

Before testing:

1. Read `AGENTS.md`.
2. Read the complete approved plan:
   `docs/specs/2026-08-26-player-backup-wizard-plan.md`, especially the design
   fidelity review, regression gates, final interactive browser gate, risks,
   and acceptance criteria.
3. Read the complete project browser skill and checklist:
   - `.agents/skills/rollkeeper-manual-browser/SKILL.md`
   - `.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`
   - `.agents/skills/rollkeeper-manual-browser/scripts/generate-fake-seed.mjs`
4. Confirm PR [#280](https://github.com/IrakliDevelop/RollKeeper/pull/280)
   is present on `master`. Its merge commit is
   `b01adeba1575202a9f328c791684b228e3463edb`.
5. Confirm the focused Task 11 contract exists and runs in CI:
   - `config/vitest/playerBackupWizard.config.ts`
   - `npm run test:player-backup-wizard:coverage`
   - the named **Player backup wizard coverage contract** CI step
6. Update `master`. Run acceptance from the exact clean merged commit. If a
   defect requires a code change, then create
   `feat/player-backup-final-acceptance`; do not create a branch merely for a
   clean verification run.
7. Preserve unrelated local and untracked files. Do not alter or force-add the
   design archive or generated/downloaded evidence.

No additional product planning is expected. Stop and report a genuine blocker
only when the approved contract cannot be exercised safely or a missing
product decision would change behavior. A missing manual-test harness is an
acceptance blocker to identify precisely, not permission to replace the
scenario with a unit test.

## Hard boundaries

- Do not enable player-backup flags in a deployed environment.
- Do not change `.env.example`, production environment values, rollout
  percentages, or default-off behavior in this task.
- Do not use production Supabase, real accounts, real email addresses, real
  OTPs, existing browser profiles, user cookies, or user storage.
- Do not use standalone Playwright, screenshots, Storybook, or component tests
  as a substitute for the Codex desktop in-app Browser gate.
- Do not weaken, collapse, skip, or reinterpret any of the 19 scenarios.
- Do not call an HTTP status, toast, screenshot, or test pass durable evidence.
- Do not print raw payloads, cookies, auth tokens, OTPs, recovery contents, or
  secrets in commentary, logs, reports, commits, or PR text.
- Do not modify the prototype archive. Extract it only to a temporary
  directory outside the repository when needed.
- Do not ship manual-only fault injection or fake gateway code in the product
  bundle. Temporary local fixtures must remain isolated and uncommitted unless
  a reusable test-only harness is explicitly approved.
- Do not merge a corrective PR. Stop after it is reviewed, green, and ready.

## Phase 1: baseline and test topology

Record before running anything:

- branch and full commit;
- dirty/untracked state without modifying unrelated files;
- Node/npm versions;
- local Supabase status;
- exact feature-flag profiles to be used;
- origin-to-port mapping, with one Next.js process per distinct
  `NEXT_PUBLIC_*` flag profile;
- the synthetic seed version, entry count, total UTF-8 bytes, manifest hash
  prefix, and abbreviated per-entry vector from:

```text
node .agents/skills/rollkeeper-manual-browser/scripts/generate-fake-seed.mjs --manifest
```

`NEXT_PUBLIC_*` values are fixed per Next.js process. Hostname isolation alone
cannot create different flag combinations. Bind every ephemeral server only to
`127.0.0.1`, use a new unused port, and record which isolated hostname uses
which port. Stop all processes when finished.

At minimum prepare separate profiles for:

- umbrella off with all lower player capabilities on;
- full wizard capability;
- integrated ongoing without manual backup;
- each unavailable/degraded lower-capability combination required by scenario
  18;
- any no-lock or held-response fixture needed for scenario 17.

All auth, database, mail, cloud, gateway, and network-failure behavior must be
local and synthetic.

## Phase 2: prototype fidelity review

Perform this before the final interactive product gate.

Use the read-only archive:
`docs/specs/Rollkeeper Cloud Migration Wizard.zip`.

Extract it to a fresh temporary directory and serve the prototype through a
local HTTP server. Review the actual player prototype files, not only the
archive thumbnail:

- `Player Backup Wizard.html`
- `Player Backup Wizard.dc.html`
- `Player Dashboard.dc.html`
- the archive README and support assets when needed to understand scenario
  controls

Compare the prototypes against deterministic production component fixtures:

- all 19 wizard prototype scenarios;
- all six dashboard scenarios;
- desktop comparison for every scenario;
- 390 px comparison for account, safety-file pending, safety-file mismatch,
  character selection, partial result, conflict, management, recovery,
  dashboard not-started, and dashboard ongoing;
- representative dark and parchment comparisons in addition to the default
  theme.

For each comparison, check hierarchy, spacing, widths, typography, icon size,
badges, semantic status tones, action grouping, selected and disabled rows,
responsive behavior, and the compact completed state. Also check focus order,
accessible names, live regions, obvious contrast, and horizontal overflow.

The following differences are expected and do not count as drift:

- prototype scenario/design-state controls;
- prototype-only inline runtime or bundled fonts;
- literal prototype colors replaced by semantic production tokens;
- prototype file metrics and synthetic characters.

Record every other intentional difference with a concrete safety,
accessibility, or responsive reason. A component test or archive thumbnail is
not evidence that the design matches.

If a material mismatch appears, determine whether it is a production defect or
an approved divergence before changing code. Do not polish unrelated UI.

## Phase 3: automated regression gates

Run the focused contracts separately so a broad pass cannot hide a safety
failure:

```text
npm run test:player-backup-wizard:coverage
npm test -- src/lib/indexeddb/__tests__/persistenceBootstrap.test.ts src/lib/indexeddb/__tests__/migrationEngine.test.ts src/lib/indexeddb/__tests__/migrationCapture.test.ts src/lib/indexeddb/__tests__/migrationValidation.test.ts
npm run test:slice8:coverage
npm run test:slice9:coverage
npm test -- src/lib/indexeddb src/lib/playerBackup --coverage.enabled=true --coverage.provider=v8 --coverage.reporter=text --coverage.include='src/lib/indexeddb/*.ts' --coverage.thresholds.perFile=true --coverage.thresholds.statements=90 --coverage.thresholds.functions=90 --coverage.thresholds.branches=85
npm run test:indexeddb:e2e
npm run test:automatic-sync:e2e
```

Then run the complete repository regression set:

```text
npm test
npm run test:visual
npm run test:e2e
npm run test:auth:e2e
npm run type-check
npm run lint:ci
npm run format:ci
npm run build
npm run test:ci-tools
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
npm run test:db:replay
npm run test:db:integration
npm run test:auth:integration
```

Run database and auth gates even though this phase plans no SQL or auth code
change: player backup reuses security-sensitive character RPCs and account
routing. Start and stop local dependencies safely. Treat any environment-
blocked command as blocked, not passed. Record exact commands and outcomes,
keeping automated evidence separate from browser evidence.

Review the current CI run as well. Confirm that the player-wizard contract is
present, executes the package command unchanged, enforces per-file 90%
statements, 90% functions, and 85% branches, and does not weaken the IndexedDB
or automatic-sync gates.

Do not begin the final interactive gate until automated checks are green. If a
check fails, diagnose it before deciding whether the failure belongs to the
product, the test harness, or the environment.

## Phase 4: full interactive browser acceptance

Use `.agents/skills/rollkeeper-manual-browser/SKILL.md` and the Codex desktop
in-app Browser. If the in-app Browser is unavailable, the verdict is
**blocked**. Do not substitute another browser surface.

Execute the complete **Player Backup Wizard** section of
`.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`,
scenarios 1–19, exactly as written. The checklist is the operational source of
truth; the summary below is only a cross-check and cannot replace it.

Required isolated origins include fresh equivalents of:

- `rk-player-control.localhost`
- `rk-player-a.localhost`
- `rk-player-b.localhost`
- `rk-player-conflict.localhost`
- `rk-player-race.localhost`
- `rk-player-degraded.localhost`
- a fresh untouched wizard-on probe origin
- a fresh recovery-only profile

Create the seed character once through the visible
`/player/characters/new` UI, add the deterministic unrelated entries, capture
the exact complete character family plus unrelated raw pairs, then copy those
exact pairs into every required origin before first app load. Prove identical
counts, bytes, and hashes before testing. Never print the raw values.

The 19-scenario gate must visibly and durably cover:

1. Deterministic identical starting profiles.
2. Non-vacuous umbrella-off compatibility and passive wizard-on database
   non-creation.
3. Launcher, signed-out/sign-in return, read-only discovery, and zero implicit
   mutation.
4. Broad and current-character safety downloads, independent validation,
   exact re-selection, verified receipts, and source-change refusal.
5. Cancellation before confirmation and safe resume after reload.
6. Default ongoing setup, previously paused selection, atomic partition,
   activation, and refetched online acknowledgement.
7. Durable compact dashboard state after reload, navigation, edit, and a
   second same-origin tab.
8. One-time exact-scope crash/resume, no later automatic work, and explicit
   **Back up now**.
9. Offline acknowledgement, durable pending work, reconnect/retry, and
   committed-response-loss identity reuse.
10. Fresh deterministic runs of **Keep my changes**, **Use online version**,
    and **Keep both**, with losing-candidate retention.
11. Future-format online data, exact recovery retention, friendly language,
    and no active overwrite.
12. Immediate account A/B isolation and exact A resume.
13. Pause/resume, future-default off/on, and soft online removal without local
    deletion.
14. Generic and dedicated recovery before/after cutover, forged control
    classifications, invalid/checksum failures, quarantine, explicit
    activation, divergent candidates, artifacts, and gated rollback.
15. Final byte identity for every unrelated family and sentinel value.
16. Desktop/390 px, light/dark/parchment, keyboard, focus, accessible names,
    live regions, contrast, and overflow.
17. Same-account two-tab compare-and-replace, lock serialization through
    acknowledgement, and no-lock fail-closed behavior.
18. Every specified lower-capability profile, safe-row-only selection,
    all-contested refusal, locked recheck drift, explicit conflict, and clean
    degraded manual copy with no authority/automatic mutation.
19. First-activation evidence, stale mirror and failed retry, separate active
    bundle, account-B rebind, mismatched-evidence refusal, inactive recovery
    import/activation, divergent recovery, and later reconciled single-file
    parity.

For every scenario record:

- exact visible actions and visible outcomes;
- local authority, run, preference, link, document, work, receipt, journal,
  conflict, quarantine, recovery, and pointer evidence that applies;
- relevant server row and mutation counts;
- reload, close/reopen, navigation, or multi-tab evidence;
- injected failure and recovery evidence;
- every downloaded filename/category plus independent format/version,
  per-entry byte/hash, aggregate hash, and manifest/bundle validation;
- final unrelated-entry hashes.

Use visible UI controls for product actions. Page evaluation is limited to
deterministic seeding, scoped fault injection, and durable evidence the UI
cannot show. A success label is accepted only after authoritative storage or
server acknowledgement is independently proved.

## Defect protocol

When any automated, visual, or manual check exposes a product defect:

1. Capture the smallest reproducible sequence and affected flag/origin profile.
2. Add the smallest focused automated test and observe it fail for the same
   contract.
3. Create `feat/player-backup-final-acceptance` if it does not already exist.
4. Implement the minimum production correction. Avoid unrelated refactors.
5. Run proportional focused and full regression gates.
6. Repeat the affected prototype comparison and every affected manual-browser
   action from a fresh deterministic profile.
7. Push a concise corrective PR, but do not merge it or enable rollout flags.

If the blocker is missing deterministic fault injection or inspection tooling,
identify the exact missing seam. Do not claim the scenario passed based on a
unit-test double. Ask before adding a new reusable repository harness when that
would materially expand scope.

## Final report and verdict

Use the checklist's eight-part evidence structure:

1. Environment: branch, commit, exact local flags, origin-to-port mapping,
   origin labels, and local-only dependencies.
2. Seed: version, exact entry count, total bytes, manifest prefix, and
   abbreviated per-entry vector.
3. Design fidelity: scenarios compared, viewport/theme coverage, intentional
   divergences, and defects.
4. Manual actions: visible action followed by outcome for scenarios 1–19.
5. Durability and failure paths: authoritative proof, reload/multi-tab,
   offline/retry/conflict/recovery/rollback results, and mutation counts.
6. Artifacts: filenames/categories and independent validation results without
   raw contents.
7. Automation: exact commands and CI results, separate from browser evidence.
8. Verdict: **passed**, **failed**, or **blocked**, with remaining risks.

The final verdict is **passed** only when:

- all required automated gates are green;
- all required prototype comparisons are complete with no unexplained drift;
- all 19 interactive scenarios have complete visible and durable evidence;
- every required artifact is independently validated;
- unrelated data remains byte-identical;
- all local servers and test tabs are cleaned up; and
- no unresolved safety, account-isolation, recovery, conflict, accessibility,
  or durability defect remains.

If any required scenario is skipped, environment-blocked, or supported only by
automated evidence, the verdict is **blocked** or **failed**, never passed.

Stop after the acceptance verdict or after handing off a corrective PR. Do not
enable the umbrella flag. A separate, explicitly approved rollout task should
handle `.env.example` normalization, deployment configuration, staged
enablement, monitoring, and rollback only after this acceptance phase passes.
