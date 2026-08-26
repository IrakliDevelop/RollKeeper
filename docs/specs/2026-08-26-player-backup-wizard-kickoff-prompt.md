# Fresh-chat kickoff prompt: Player Backup Wizard foundation

You are working in the RollKeeper repository. Implement the first reviewable,
default-off foundation slice of the approved Player Backup Wizard plan.

This is an implementation task. You are authorized to create a feature branch,
edit code and tests, run verification, commit the scoped work, and open a pull
request when the required gates pass. Do not merge the pull request.

## Start from the approved handoff

1. Read `AGENTS.md` and `CLAUDE.md` completely before taking task actions.
2. Read the complete implementation plan:
   `docs/specs/2026-08-26-player-backup-wizard-plan.md`.
3. Inspect the design archive as directed by the plan:
   `docs/specs/Rollkeeper Cloud Migration Wizard.zip`.
   Its expected SHA-256 is
   `c384671c54c2fc1d0250dc8b5b1279505abf7518ecad692d69456a48335cd628`.
   Treat the archive as a read-only design reference. Do not copy its prototype
   runtime, inline styles, bundled fonts, literal colors, or synthetic data into
   production.
4. Fetch and inspect the current merged `master`. The plan was audited against
   `0db4717b57fff293b6ac6f3feda32964c0dbce7c`, the merge commit for PR #270.
   At kickoff, local `master` and `origin/master` were both at that commit. If
   `origin/master` has advanced, report it and inspect every relevant intervening
   change before treating the plan's code references as current.
5. Confirm the worktree before creating a branch. The plan, design archive, and
   this kickoff prompt are currently untracked and must be preserved. The
   unrelated untracked files `BACKPORT_EVIDENCE.md` and
   `SLICE_5_AUTH_PREREQUISITES.md` belong to the user; do not modify, delete,
   stage, or include them.
6. Create a focused branch from the verified current `master`, for example
   `feat/player-backup-wizard-foundation`. Add the plan, design archive, and this
   kickoff prompt in a documentation checkpoint commit before implementation so
   the handoff is durable on the branch. Stage only those three exact handoff
   paths for that commit.

The GitHub token used during planning could not read GitHub Projects because it
lacked `read:project`. Do not invent external roadmap commitments. This is not a
blocker because the local roadmap, merged code, tests, approved plan, and design
archive are the implementation authority.

## Scope of this pull request

Implement only Tasks 1 through 4 from the plan:

1. Umbrella feature flag, capability matrix, and non-vacuous route ownership.
2. Pure user-facing copy and status projection, including the strict vocabulary
   guard.
3. Account-aware, read-only cloud preview and non-creating local run discovery.
4. Verified safety-file gates, stable protected-source comparison, active
   character mirror coverage inspection, and the restorable active-row recovery
   bundle.

Do not implement Tasks 5 through 11 in this pull request. In particular, do not
create the durable consent run, change account preferences, select or activate
character storage, create online documents/work, upload characters, resolve
conflicts, replace the dashboard panels, or build the final management and
recovery UI. The foundation APIs and tests must make those later tasks possible,
but no online-backup mutation may be introduced in this slice.

If a failing red-first test proves the approved plan is internally impossible or
requires a server/SQL contract change, stop and report the exact evidence before
expanding scope. Do not silently redesign the product or add a parallel
persistence system.

## Product and safety contract

The single player goal is **Back up my characters online**. The umbrella wizard
flag owns the new surface only when it is exactly `true`; it and all lower
capabilities remain off by default. With the umbrella flag off, the existing
player dashboard and all legacy lower-flag behavior must remain unchanged.

Preserve these invariants:

- Viewing, signing in, signing out, navigating, opening recovery, or reloading
  never uploads a character, changes character ownership, creates setup consent,
  or starts first-upload work.
- No online write starts before a later explicit final confirmation.
- Account reads are isolated to the current authenticated account. A stale
  response from another account is discarded and never rendered or adopted.
- Passive route rendering and resumable-run discovery do not create
  `rollkeeper-local`. Use the plan's non-creating existing-database probe.
- Final online-backup confirmation, implemented in a later task, may create the
  database for setup. A separate explicit, validated recovery import, also
  implemented later, may create it only to stage inactive recovery data. Do not
  let the foundation's non-creation rule make that later recovery boundary
  impossible.
- A downloaded file or receipt initiation is not verified safety. Require the
  exact file to be reselected and cryptographically validated.
- Before a local selection write, the broad safety bundle's complete entry
  vector must still match. Later tasks may exclude only the one exact semantic
  character-selection record under the path-specific rules in the plan.
- After character activation, never claim the broad browser file contains
  current characters unless reopened, presence-aware mirror parity is exact and
  the matching character mirror journal is empty.
- If that parity cannot be proved, generate the extra character file as a
  character-only `DeviceBackupV1` from the present rows of exactly one reopened,
  verified active generation. Use `captureDeviceBackup(ReadonlyMap)` so the
  exact downloaded file is accepted by existing validation and inactive
  recovery import. Do not use the diagnostic
  `rollkeeper-current-character-export` as the safety artifact.
- Generation purity is a capture-helper invariant before serialization.
  `DeviceBackupV1` contains no source-generation provenance, so no importer may
  claim to detect mixed-generation origin after the file exists.
- Keep bundle validity separate from character usability. Invalid JSON/shape,
  checksums, aggregate hashes, empty character sets, or duplicate character keys
  fail before creation or staging. A structurally and cryptographically valid
  bundle containing malformed or future-version character data is later retained
  as quarantined inactive evidence and cannot activate.
- Generic recovery must never trust the file's classification to restore control
  keys. Do not broaden `restoreRecoveryEntries` in this slice.
- Do not change cloud tables, RPCs, SQL, or generated database types unless a
  failing test demonstrates a genuine contract gap and the user approves the
  scope expansion.

## Language contract

All rendered copy and accessible names in the new player-backup subtree must be
plain language. Never render raw lower-layer errors or implementation
discriminants.

Reject these terms case-insensitively in visible text and accessible-name
sources:

`IndexedDB`, `localStorage`, `manifest`, `schema`, `authority`, `epoch`,
`cutover`, `migration`, `namespace`, `mutation`, `outbox`, `tombstone`,
`quarantine`, `CAS`, `device`, `workflow`, `canary`, `workspace`, `sync`,
`synchronization`, and `synchronized`.

Also reject the Unicode em dash character. Cover visible text plus
`aria-label`, resolved `aria-labelledby`, `title`, `placeholder`, and `alt`,
including violations on the root element and phrases split across descendants.
Use the exact copy deck and state meanings in Section 4 of the plan.

## Required implementation method

- Follow the plan's exact likely file groups unless current code proves a
  narrower reusable boundary.
- Write focused failing tests first for each behavior and record the red result
  before implementation.
- Keep pure flags, status, and copy logic separate from React and persistence.
- Keep cloud preview read-only. It must not construct the automatic runtime,
  open the creating database path, attach links, or write run, preference,
  document, work, or ownership records.
- Implement all eight `M`/`C`/`S` combinations and their permitted-call policy.
- The umbrella flag controls surface ownership; lower flags remain capability
  enforcement boundaries.
- Normalize duplicated relevant `.env.example` flags so each appears once and
  defaults false.
- Preserve all flag-off component tests and existing Slice 7, 8, and 9
  contracts.
- Avoid unrelated refactors. Preserve user changes in the dirty worktree.

For Task 4, test at minimum:

- initiated-only, wrong, tampered, stale, or mismatched broad files cannot pass;
- the full fresh entry vector is rechecked before any future confirmation;
- passive route/account/selection activity never retries the character mirror
  journal;
- explicit safety-file saving may retry already-authorized mirror work once;
- one broad file is sufficient only after reopened exact parity, empty matching
  journal, and stable generation/epoch;
- the active-row helper reads only the verified active generation, includes all
  present character rows, skips absence rows, and rejects empty, duplicate,
  malformed, or mixed-generation source rows before serialization;
- the emitted file is `rollkeeper-device-backup`, passes the existing validator,
  and has a verified durable receipt after re-selection;
- no failure creates setup consent, selection, active pointer, preference,
  document, online work, link, or cloud mutation.

## Verification and pull request gate

Run focused tests throughout. Before opening the pull request, run every
relevant command required by the plan and repository, including at minimum:

```text
npm test -- src/lib/playerBackup/__tests__/playerBackupFlags.test.ts src/lib/playerBackup/__tests__/playerBackupStatus.test.ts src/lib/playerBackup/__tests__/playerBackupCopy.test.ts src/lib/playerBackup/__tests__/playerBackupCloudPreview.test.ts src/lib/playerBackup/__tests__/playerBackupSafety.test.ts src/app/player/backup/__tests__/page.test.tsx src/lib/indexeddb/__tests__/localDatabase.test.ts src/test/__tests__/expectPlayerBackupVocabulary.test.ts
npm test -- src/lib/indexeddb/__tests__/characterAuthority.test.ts src/lib/indexeddb/__tests__/characterRecoveryExport.test.ts src/lib/indexeddb/__tests__/characterCutoverControl.test.ts
npm run test:slice8:coverage
npm run test:slice9:coverage
npm run test:indexeddb:e2e
npm test
npm run type-check
npm run lint:ci
npm run format:ci
npm run build
```

Run broader regression gates from Section 8 when affected code or repository
instructions require them. Report environment-blocked checks as blocked, never
passed. A successful HTTP response, download click, receipt row, or rendered
toast is not durable-completion evidence.

Because this slice changes browser-visible routing, local persistence probes,
downloads, and safety controls, the final interactive browser gate is required
after automated checks. Read and follow
`.agents/skills/rollkeeper-manual-browser/SKILL.md` completely. Use only the
Codex desktop in-app Browser, isolated local origins, deterministic fake data,
and fake accounts. Never inspect or reuse normal browser sessions. If desktop
Browser access is unavailable, report the PR as blocked rather than substituting
standalone Playwright.

The manual control must be non-vacuous: with the umbrella flag off and lower
flags on, prove the wizard route is absent, legacy panels remain, and passive
view/sign-in/sign-out/reload create no player-wizard record, local database, or
character cloud write. On a wizard-on untouched origin, prove passive route
discovery leaves `rollkeeper-local` absent. Exercise relevant narrow/desktop,
light/dark, keyboard, accessible-name, safety-file reselect, tamper, stale-source,
and stale-mirror branches implemented by this slice.

Open a concise pull request only after required checks and the manual gate pass.
The PR should include the outcome, essential design/contracts, exact checks run,
and unresolved risks or blockers. Do not include an implementation diary or raw
logs. Stop after the pull request is ready for review; do not merge it and do not
begin Task 5.
