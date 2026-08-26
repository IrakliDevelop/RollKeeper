# Player Backup Wizard implementation plan

Date: 2026-08-26  
Status: implementation-ready product and engineering plan  
Scope: player character safety, online backup, recovery, and backup management  
Base: merged `master` at `0db4717b57fff293b6ac6f3feda32964c0dbce7c`

## Evidence and planning constraints

- PR [#250](https://github.com/IrakliDevelop/RollKeeper/pull/250), manual character backup and restore, merged as `25340631`.
- PR [#252](https://github.com/IrakliDevelop/RollKeeper/pull/252), character IndexedDB cutover, merged as `ba8b00a4`.
- PR [#255](https://github.com/IrakliDevelop/RollKeeper/pull/255), automatic character sync, merged as `168bec08`.
- PR [#270](https://github.com/IrakliDevelop/RollKeeper/pull/270), DM migration wizard, merged as `0db4717b` on 2026-08-26.
- The local canonical roadmap, `SUPABASE_CLOUD_SYNC_PLAN.md`, explicitly identifies a separately flagged player variant over the Slice 8 character family and Slice 9 automatic behavior. Its execution snapshot is historical, so current code and merged PR state take precedence.
- The current GitHub token cannot read GitHub Projects because it lacks `read:project`. No external Projects commitment is assumed or recorded here.
- This plan does not include code, database changes, a branch, or a PR.

The product decision is to present one goal, **Back up my characters online**, while preserving the current independent safety contracts underneath it. Storage engines, version counters, and queue mechanics remain implementation details.

### Design handoff and fidelity contract

The implementation design source is
`docs/specs/Rollkeeper Cloud Migration Wizard.zip`, inspected at SHA-256
`c384671c54c2fc1d0250dc8b5b1279505abf7518ecad692d69456a48335cd628`.
Despite the archive name, it contains a complete player handoff in addition to
the earlier DM references:

| Archive file | Implementation use |
| --- | --- |
| `Player Dashboard.dc.html` | High-fidelity reference for the compact `/player` card in not-started, resumable, ongoing, one-time, no-character, and unavailable states. |
| `Player Backup Wizard.dc.html` | Canonical high-fidelity reference for route chrome, wizard shell, account, safety-file, selection, result, conflict, management, and recovery states. |
| `Player Backup Wizard.html` | Standalone browser preview of the same player flow. Use for visual review, not as production source. |
| `player-backup-wizard-export.dc.html` | Export copy of the canonical wizard with thumbnail metadata. It is not a second design variant. |
| `.thumbnail` | Quick visual index only. It is not a product asset. |
| `Cloud Migration Wizard.dc.html`, `DM Dashboard.dc.html`, and `design_handoff_cloud_migration_wizard/` | Existing DM handoff and design-system precedent only. Do not import DM family semantics into the player flow. |

Treat the two player `.dc.html` files as the desktop visual and interaction
baseline. Recreate them with RollKeeper's existing React components, semantic
Tailwind tokens, icons, typography, and dialog primitives. Do not copy the
self-contained prototype runtime, inline styles, bundled fonts, `support.js`,
hard-coded colors, or synthetic character data into production.

The design is authoritative for visual hierarchy, spacing, card and dialog
composition, status placement, action grouping, and the distinction between
setup and compact management. The audited safety contracts, feature gates,
state model, and copy deck in this plan are authoritative when prototype
behavior or wording differs. An implementation PR must document any additional
visual departure rather than silently redesigning the handoff.

Required adaptations to the prototype are settled now:

- Omit the dashed **Design states** strip and all scenario-picker controls.
- Omit the prototype's file size, byte estimate, and verified-size tile. The
  normal flow reports that the safety file was checked, without technical or
  storage metrics.
- Do not ship the em dashes used only in prototype scenario labels. The full
  rendered subtree, including accessible names, remains subject to the copy
  guard in Section 4.
- Replace the fixed two-column desktop body with the plan's narrow-screen
  `Step n of 3` treatment. Preserve the desktop rail at larger breakpoints.
- Use semantic tokens so light, dark, and parchment themes work. The prototype
  is a light-theme reference, not permission to add literal color values.
- Wire close and back controls to the route rules in this plan. A closed
  wizard must navigate to a meaningful page rather than leave a blank route.
- Add real labels, focus behavior, disabled reasons, live status semantics,
  and keyboard behavior. Visual-only prototype switches and rows are not an
  accessibility implementation.
- Render the prototype assurance that setup may be closed safely only after
  the confirmed work is represented durably. Never infer completion from the
  prototype's in-memory scenario state.
- Keep recovery and management actions shown by the handoff, but bind them to
  the existing soft-archive, restore, verified-download, and conflict
  contracts described below.

## 1. Current-state audit

### Existing player surfaces and contracts

| Surface | Current action and actual behavior | Underlying contract | Product problem |
| --- | --- | --- | --- |
| `/player` header `Export All` | Downloads a character-roster JSON through `exportAllCharactersToFile`. It is not the full RollKeeper recovery bundle and has no receipt or reselect verification. | `src/utils/fileOperations.ts`, `playerStore` character roster | It looks like the primary backup action but has different recovery guarantees from the required safety file. |
| `DataSafetyBanner` | One-time dismissible warning. Calls the same character-only export. Dismissal is stored under `rollkeeper-data-warning-dismissed`. | `DataSafetyBanner.tsx`, `exportAllCharactersToFile` | It can claim characters exist only in this browser even when they are protected online. It duplicates the header export and can be permanently dismissed. |
| `DeviceRecoveryControls` | Captures recognized RollKeeper `localStorage` entries, exact raw values, UTF-8 byte counts, per-entry SHA-256 values, and an aggregate hash. Download initiation records a receipt. Import validates hashes, stages an inactive recovery generation, previews collisions/future data, and restores only missing selected values. Existing different values are preserved. | `deviceRecovery.ts`, `browserRecoveryRepository.ts` | The capability is valuable but the UI exposes implementation concepts, internal keys, counts, bytes, versions, and activation mechanics. Download initiation alone is not proof the file was retained. |
| `CharacterStorageMigrationControls` | When `NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED` is exactly `true`, previews the full browser bundle, initiates a download, records a guest character-family selection, reloads, waits for preparation, and separately activates the prepared character generation. Rollback is parity, reopen, and empty-journal gated. | `characterCutoverSelection.ts`, `characterPersistenceBootstrap.ts`, `characterCutoverControl.ts`, `characterAuthority.ts`, Slice 7 migration modules | This is a technical setup panel for an internal prerequisite. Its current gate accepts an initiated receipt via `hasDownloadReceipt`; it does not require the wizard-style reselect and verified receipt demanded by this plan. |
| `CharacterRecoveryExportControls` | Exports either the current character-family state, including active data, mirrors, journal and recovery artifacts, or an immutable capture. It stays usable in recovery-required state. Neither exported format is accepted by `importCharacterRecoveryGeneration`, which validates only `rollkeeper-device-backup`. | `characterRecoveryExport.ts`, `migrationRecovery.ts`, `characterRecovery.ts` | Necessary diagnostic evidence, but the current-data file is download-only rather than a player-restorable artifact. It cannot satisfy the wizard safety gate. Keep diagnostics in recovery management and generate the conditional safety file in the existing importable format. |
| `CharacterCloudBackupControls` | Hidden unless auth and `NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED` are enabled. Each character is uploaded only after an explicit account confirmation. Success requires RPC success, refetch, decode, and fingerprint equality. Cloud rows load only on request. It supports verify, soft archive, restore, restore as copy, and recovery download. | `useCharacterCloudBackup.ts`, `characterCloud.ts`, `ManualCharacterCloudService`, gateway, codec, links, recovery download | It is per-character, repetitive, and technical. Raw service errors can reach the UI. It does not provide the automatic-conflict resolver for a differing pre-existing online copy. |
| `CharacterAutomaticSyncControls` | Hidden unless `NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED` is exactly `true`. Existing characters default off. Per-character enable requires active character cutover and target-account confirmation. Account preview is read-only; confirmation enables eligible current characters and a future-character default, while explicit off overrides win. | `useCharacterAutomaticSync.ts`, `AutomaticCharacterSyncService`, preferences, repository, worker, puller, coordinator | It duplicates manual backup and storage setup, exposes internal distinctions, and maps a paused aggregate to `local-only`, so the current UI cannot distinguish never protected from paused after an acknowledged online copy. |
| `PersistenceBootstrap` recovery screen | If an activated character generation cannot be verified, the app refuses fallback and exposes current/capture downloads. | `PersistenceBootstrap.tsx`, character bootstrap and recovery export modules | The fail-closed behavior is correct, but the rendered copy exposes forbidden implementation terms. The wizard flag needs a friendly recovery shell over the same exports. |
| Global account UI | `/account` performs email-code sign-in and sign-out without touching local data. `/player` has a global account indicator, but backup controls discover the account only when used. | `AuthForm`, `AccountControls`, `authService`, server claims | The wizard needs a deliberate return path after sign-in and must reset all account-scoped status immediately on account change. |

### Verified safety invariants

The following are established by current code and tests and must remain true:

- Feature flags use exact string equality and are inert when absent or false. Manual cloud construction makes zero Supabase character calls while disabled. Automatic browser setup makes zero auth, IndexedDB, or cloud calls for a non-participating character profile.
- Sign-in and sign-out touch only the account session. They do not claim guest data, select character cutover, or upload a character.
- Character-family activation is scoped to namespace plus family and atomically commits the active pointer and epoch only after readiness gates pass. Failure before that commit leaves the legacy path primary.
- After activation, an edit is acknowledged only after an IndexedDB commit or durable journal outcome. A failed compatibility mirror is retried and does not invalidate an already durable edit. An active transaction failure is not reported as saved.
- Immutable source captures, numbered captures, current mirrors, journals, conflicts, recovery bundles, and tombstones are retained. Rollback refuses unless parity, reopen, and journal checks succeed.
- Manual upload is explicit and account-targeted. It reuses a mutation ID after response loss and does not claim success until the exact refetched online payload matches.
- The character table is isolated by authenticated owner. Browser cloud links are keyed by account plus legacy character ID. Automatic documents, preferences, pending work, conflicts, and held-aside data use `user:<account-id>` namespaces.
- Automatic work is opt-in. Turning it off writes an explicit off preference and pauses retained work; it does not delete the local character, online row, link, pending work, conflict, or recovery data.
- Automatic upload and pull preserve both sides of a version conflict. `keep-mine`, `use-cloud`, and `keep-both` snapshot or retain the losing candidate before resolution. `keep-both` creates a new local character that starts with online backup off.
- Offline, expired-auth, response-loss, retry, and worker-restart states are durable. One conflicted character does not stop unrelated characters.
- Future-format or malformed online candidates are held aside and exportable. They are never activated as current character data.
- Online deletion is a recoverable soft archive/tombstone path. Ordinary updates cannot resurrect it.

One wording clarification is necessary for acceptance tests: merely viewing, signing in, signing out, or navigating must never enroll a character, select cutover, enqueue a first upload, or change local ownership. After the player has explicitly enabled ongoing backup, the already-authorized durable worker may resume previously queued work on startup, focus, or reconnect. Treating that authorized retry as a new implicit opt-in would make ongoing backup impossible and would contradict the merged Slice 9 contract.

### Duplication and contradiction to remove under the wizard flag

- `Export All`, the safety banner, and the full recovery download appear to be three versions of the same action but produce two different file types and three different guarantees.
- Manual backup and automatic backup each list every character and use different status vocabularies.
- The storage transition appears as a separate decision even though it is only a prerequisite for durable ongoing backup.
- `Cloud: local only` conflates never selected, explicitly paused, and an acknowledged one-time online copy.
- Current recovery and error strings expose implementation terms and sometimes raw exceptions.
- The full browser recovery import can restore `localStorage` entries, but after character cutover the active character data must instead be imported through `importCharacterRecoveryGeneration`; restoring only a compatibility mirror would not restore the active character state.

### Resolved persistence gaps

Eight audited gaps require explicit local contract changes. They do not require
new server tables or SQL:

1. **Expected selection write during safety verification.** The safety file
   remains a broad, exact capture. Immediately before confirmation, its entire
   entry vector must still match. After confirmation, cutover readiness compares
   every captured key except the one exact
   `characterCutoverSelectionKey(namespace)`. That selection record is not
   ignored blindly. On first activation it must parse, identify the same
   namespace and character family, and contain the current verified receipt's
   run ID, aggregate hash, and creation time. On already-active rebind it must
   instead preserve and validate the original activation evidence while the new
   consent run independently validates the newly saved safety evidence. Extend
   the wizard-written selection shape with the confirmed player-backup run ID
   and account ID, while keeping legacy readers backward compatible. No other
   added, removed, or changed key is permitted. This stable protected-data
   projection reconciles the one expected orchestration write without weakening
   protection for character or unrelated browser data.
2. **Durable consent before cutover.** Final confirmation creates a versioned,
   account-scoped player-backup run in the existing `rollkeeper-local` `meta`
   store before any cutover selection or online write. It records the active
   account ID, one-time or ongoing mode, the complete eligible-ID snapshot,
   selected IDs, cleared IDs, desired future default, verified safety receipt
   identity, confirmation time, and per-character execution checkpoints. It is
   the authoritative scope of consent and resume, but never proof that an
   online copy succeeded.
3. **Recovery allowlist.** A broad file may retain control and unknown keys for
   evidence, but generic restore may write only keys derived from the code-owned
   user-data allowlist: registered managed data keys, character envelopes, and
   registered canvas keys. Bundle-provided classification is never trusted for
   this decision. Retained-only keys and all selection, ownership, cloud-link,
   account, preference, pending-work, and other control records are excluded
   from generic restore. Active character keys use the dedicated character
   recovery path after cutover.
4. **Atomic confirmed preferences.** Add one transaction that writes the
   confirmed run and the complete preference result together: selected
   characters are explicitly `on` in ongoing mode and `off` in one-time mode,
   cleared characters are explicitly `off`, and the future default is written
   as the confirmed `on` or `off` value. A prior explicit-off record cannot
   override a newly confirmed selection. Online documents and work are created
   only after this transaction is durable and the run reaches a separately
   verified `local-ready` checkpoint through either first activation or the
   already-active rebind.
5. **Already-active selection rebind.** Never call `selectCharacterCutover`
   when the real character authority is already active. Add a separate rebind
   operation that acquires the account lock and existing character migration
   lock, reopens the local database, verifies the active pointer and generation,
   and requires the current selection's activation fields to match them. It then
   preserves `selectedAt`, recovery receipt fields, `activatedEpoch`, and
   `activatedGeneration` byte-for-byte while updating only the player-backup
   run ID, account ID, and authorization time. A missing or inconsistent marker
   enters recovery instead of being reconstructed or overwritten.
6. **Current-character safety coverage after activation.** A broad browser
   bundle captures compatibility mirrors, not the authoritative active
   generation. Before describing that bundle as containing current characters,
   inspect the reopened active generation, require exact mirror parity for every
   present and absent character key, and require no matching character mirror
   journal entry. The explicit save action may first retry the existing mirror
   journal, but route view may not. If parity still cannot be proved, keep the
   broad file for the other browser data and additionally require a generated,
   reselected, hash-verified `DeviceBackupV1` containing the present rows from
   the reopened active character generation. Build it through
   `captureDeviceBackup(ReadonlyMap)` so the exact file is accepted by existing
   recovery validation and `importCharacterRecoveryGeneration`. Its fresh
   authoritative projection must still match immediately before confirmation.
7. **Degraded manual eligibility.** Without the integrated local path, only a
   missing online row, an identical validated row, or a recognized linked row
   whose ID, acknowledged server version, and fingerprint exactly match the
   retained account link is eligible for one-time backup. Newer, different,
   archived, unreadable, unavailable, future-format, or otherwise untrusted
   rows are unavailable and unselected. Revalidate eligibility before creating
   the consent run; if any selected row becomes contested, abort with no run,
   link, pending mutation, or network mutation.
8. **The conditional character file must restore, not only verify.** Do not use
   `rollkeeper-current-character-export` as the extra safety artifact because no
   importer accepts it. Generate present active rows as `DeviceBackupV1` through
   `captureDeviceBackup`, then reuse validation and inactive-generation import.
   Harden explicit activation for a truly empty profile, generate the required
   runtime selection marker from verified recovery evidence, reopen and hydrate,
   and compare exact character IDs/content hashes before claiming restoration.

### Resolved discovery and concurrency rules

1. **Read-only cloud discovery is pre-confirmation behavior.** When auth and
   the relevant lower capability are enabled, the wizard may call `getUser`,
   list/fetch the current account's online rows, decode them, and compare them
   with local characters before confirmation. Those calls may not attach a
   link, write a preference/run/document/work item, restore/archive anything,
   or invoke an upload/update RPC. “No online backup starts” means no local or
   remote mutation starts; it does not prohibit account-scoped reads needed to
   show an informed choice. Implement this through a narrow gateway/codec
   preview adapter. Do not construct the automatic runtime or any repository
   that opens `rollkeeper-local` merely to perform the preview.
2. **The active run is fenced across tabs.** Every run-related local write
   receives `expectedActiveRunId` and verifies the account-scoped active-run
   pointer inside the same IndexedDB transaction. Final confirmation and every
   network mutation also run under one account-scoped exclusive browser lock,
   re-read the pointer under that lock immediately before the gateway call, and
   hold the lock through durable acknowledgement handling. A stale tab whose
   expected run was replaced aborts without creating local work or making a
   network mutation. If the exclusive-lock capability is unavailable, wizard
   confirmation and backup mutations fail closed with friendly copy; read-only
   discovery and recovery downloads remain available.
3. **Passive run discovery never creates the local database.** Add a dedicated
   non-creating `openExistingRollkeeperDatabase` probe. It opens without a
   requested upgrade version; if `onupgradeneeded` fires because the database
   is absent, it aborts that creation transaction and returns `null`. It never
   delegates to `openRollkeeperDatabase`. View/resume discovery treats `null`
   as no run and performs no fallback write. Final online-backup confirmation
   may create the database because that is an explicitly authorized setup write
   boundary. Separately, choosing a validated recovery file through the explicit
   recovery import action may create the database solely to stage an inactive
   recovery generation under the recovery policy. That exception creates no
   player-backup run, preference, active pointer, selection marker, online work,
   or network mutation. Only the later explicit restore confirmation may
   activate the staged characters.
4. **Selection visibility is not selection mutation.** The choice screen may
   render every eligible local character so the player can select or clear it.
   The prohibition applies to uploading or modifying an unselected character
   and to rendering, adopting, or modifying another account's online row.

## 2. Recommended product model

### Single goal and entry points

Place one compact backup card directly below the `/player` dashboard heading and above character statistics.

- Before setup: primary button **Back up my characters online**.
- While setup is safely resumable: primary button **Continue character backup**.
- After at least one character has an acknowledged online copy: a compact summary headed **Online backup is on** or **Online copies saved**, with counts for protected, backing up, paused, and needs attention.
- Completed-state actions: **Manage backups** and **Restore characters**.

All entry buttons go to the dedicated, flag-checked `/player/backup` route. A dedicated route is preferable to an always-mounted dashboard dialog because it survives reloads, gives sign-in a deterministic return target, and can remount after the local character transition before any editor/dashboard owner resumes.

The route chooses its initial view from durable facts, not a stored `wizardCompleted` boolean:

- no acknowledged current-account online copy and no confirmed setup intent: setup;
- an active current-account consent run with unfinished local preparation or recorded selected characters lacking a terminal result: resume that run's exact scope;
- at least one acknowledged copy or a retained paused/attention state: management summary, with an explicit **Protect more characters** action to re-enter selection.

### Minimum visible flow

Use three actionable screens plus the result. Steps 3 and 4 from the hypothesis are combined because the choices and their consequence fit in one reviewable confirmation without weakening consent.

1. **Protect your characters**
   - Explain the single outcome.
   - Check account status without writing anything.
   - If signed out, link to `/account?returnTo=/player/backup`; validate the return path against an internal allowlist.
2. **Save a safety file**
   - Inspect current-character safety coverage without changing ownership.
   - On explicit save, retry already-authorized mirror work once, then require
     exact mirror parity and no matching pending mirror entry before claiming
     the broad bundle contains current characters.
   - Capture and download the existing full RollKeeper browser bundle.
   - If current-character parity cannot be proved, also generate and download a
     restorable current-character bundle in the existing browser-backup format.
   - Require the player to choose every required downloaded file again.
   - Validate each file's shape, internal hashes, exact identity, and a fresh
     matching source projection before marking this step complete.
3. **Choose characters**
   - Select all eligible active and archived characters by default.
   - Show a single account-level switch, on by default: **Keep these backups up to date**.
   - Show one explicit confirmation panel naming the account, selected count, what will be copied, what will remain local, and that nothing is deleted.
   - The confirmation button is the only operation that records setup intent, prepares the safer browser storage path, or starts an online write. Its first durable action atomically records the exact account, mode, selected and cleared IDs, future default, safety receipt, and preference result.
4. **Finished**
   - Verify and summarize each selected character independently.
   - Never turn partial success into a whole-run success claim.
   - Give the next safe action for conflicts, offline work, held-aside data, or retryable failure.

The account screen and safety-file screen may share the first route render, as the DM wizard does, but the progress rail and accessible step headings must continue to present them as separate obligations. On narrow screens, use a compact `Step n of 3` label instead of a side rail.

### Safety file recommendation

Use the existing broad browser safety bundle as the baseline. After character
authority is active, conditionally pair it with a character-only instance of
that same validated format, generated from the authoritative active rows.

In user terms, the broad file includes other RollKeeper data currently saved in
this browser and includes current characters only when RollKeeper has proved the
browser copies match the active character data. Only selected characters are
sent to the account. The file must be described as private because it can also
contain local campaign material. If the proof fails, explain that RollKeeper
needs one extra recovery file for the current characters. Do not claim the broad
file alone contains them.

In recovery terms, the broad bundle preserves exact raw bytes for recognized
RollKeeper browser keys, including the character compatibility roster and
envelopes, DM families, canvases, and retained RollKeeper keys. Before character
cutover, that is the independent copy needed to restore the complete character
source and prove it did not change. After activation, call a new read-only
`inspectCurrentCharacterSafetyCoverage` helper, extracted from the parity and
journal checks already used by character rollback. It must reopen the database,
verify the active pointer/generation/epoch, compare every active character row
including absence markers to the compatibility storage, and require no
`character-compatibility-mirror` entry for that namespace, generation, and
epoch. Checking only that character rows exist is insufficient.

The explicit **Save safety file** action may call
`retryCharacterMirrorJournal` once because it is completing already-authorized
local mirror work. Viewing the route, signing in, previewing, or selecting must
not call it. If the subsequent read-only inspection proves parity and an empty
matching journal, one reselected broad file is sufficient. If it does not, call
a new `captureActiveCharacterRecoveryBundle` helper. In one reopened read
snapshot it must verify the pointer, read only that generation's
character-family rows, include every present row in a `ReadonlyMap`, reject
duplicate/malformed rows and an empty generation, and pass that map to
`captureDeviceBackup`. Absence rows stay absent rather than becoming values.
Download those exact `DeviceBackupV1` bytes and require the player to reselect
them through `verifyDownloadedDeviceBackup`.

Immediately before confirmation, repeat the reopened authority read and
regenerate the active-row bundle with the same run ID and timestamp. Require
the entry vector, manifest hash, generation, and epoch to match the verified
file. Store both verified receipt identities in the consent run. Failure to
generate, reselect, validate, or freshly match the current-character bundle
blocks confirmation and routes to recovery options. Do not use
`exportCurrentCharacterData` for this gate: its
`rollkeeper-current-character-export` format is diagnostic today and has no
matching importer.

Do not overclaim that the broad file contains every internal journal or recovery
record. The restorable current-character bundle protects the active character
values. Existing `exportCurrentCharacterData` and immutable-capture downloads
remain technical evidence for journals, conflicts, held-aside rows, and other
recovery diagnostics, but they are not presented as restorable safety files.
The setup copy deck should say what the player receives, not “all browser
storage.”

### Character selection and ongoing behavior

- Default: all eligible active and archived characters selected.
- Provide **Select all** and **Clear all** plus individual checkboxes.
- Require at least one selected character before confirmation.
- Explain an unavailable character beside its name and leave it unselected. Do not expose payload-size, encoding, or format-version details in the normal flow.
- In degraded manual mode, derive the eligible set only after current-account
  preflight. Missing rows, identical validated rows, and recognized linked rows
  with an exact acknowledged base are eligible and selected by default. Newer,
  different, archived, unreadable, unavailable, future-format, or untrusted rows
  are unavailable and unselected. If none remain eligible, do not render an
  online confirmation.
- The account-level **Keep these backups up to date** switch defaults on. When on, selected current characters are enabled and new eligible characters default on; any cleared current character receives an explicit off override. This uses the existing account-default policy instead of making the player repeat setup for each character.
- When off, the selected characters receive one verified online copy through the manual backup contract and later edits remain only in this browser until the player chooses **Back up now** or turns ongoing backup on.

The internal character storage transition is not a visible step. In a full-capability rollout with both `C` and `S` enabled, after the verified safety file and final confirmation the coordinator first commits the account-scoped consent run and complete preference set in one `meta` transaction. If character authority is still legacy, it then selects, prepares, validates, and activates the character family using existing Slice 7 and 8 services. This happens once for the family, not once per character, for either the ongoing or one-time choice in the full-capability flow. Cutover readiness compares the stable protected-data projection and separately validates the expected character-selection record, so that record cannot invalidate its own safety gate or conceal any other changed key.

If character authority is already active, the coordinator does not select or activate again. It performs the verified already-active rebind defined in Section 5, preserving the activation and original recovery fields while changing only the current backup authorization metadata. If `S` is false, `C=true` alone does not authorize preparation: `M=true, C=true, S=false` is degraded manual-only backup, identical in persistence behavior to the other manual-only combinations. If `M=true` and either `C` or `S` is false, only the preflight-proved degraded-eligible characters may use the existing manual contract without changing local authority. Contested characters never enter that run. If `M=false` and either `C` or `S` is false, online setup is unavailable and only safety-file/recovery actions remain.

| Available setup | Existing character authority | Local action after confirmation | Confirmation copy |
| --- | --- | --- | --- |
| No one-time capability and `C`/`S` pair incomplete | Either | None; there is no online confirmation | Unavailable surface |
| Degraded one-time with `M=true` and incomplete `C`/`S` pair | Either | None | One-time without preparation |
| Integrated ongoing with `C=true`, `S=true` | Legacy | Select, prepare, verify, activate | Ongoing with preparation |
| Integrated ongoing with `C=true`, `S=true` | Already active | Verify and rebind only | Ongoing already ready |
| Full-capability one-time with `M=true`, `C=true`, `S=true` | Legacy | Select, prepare, verify, activate | One-time with preparation |
| Full-capability one-time with `M=true`, `C=true`, `S=true` | Already active | Verify and rebind only | One-time without preparation |

### Existing online copies

Before confirmation, list only the signed-in account’s rows and compare by legacy character ID with validated payloads:

- Identical active row: label **Already protected**. Do not upload it again. Attach or refresh the account-scoped link only after validation.
- Active row with a greater validated character revision: label **Online copy has newer changes**.
- Active row with different content but no trustworthy revision ordering: label **Different online copy**.
- Soft-archived row: label **Online copy was removed** and require an explicit restore or keep-both choice. Never silently resurrect it.
- Missing/unavailable response: leave the character local and show **Could not check online backup** with retry.
- Future-format or unsafe row: keep it held aside, offer a recovery download, and do not activate or overwrite it.

The integrated flow may take newer, different, and archived rows into its
durable conflict path after confirmation. Degraded manual mode may not. In that
mode, project every newer, different, archived, unreadable, unavailable,
future-format, or otherwise untrusted row as unavailable, clear it from the
ephemeral selection, and exclude its ID from the eligible snapshot. Offer a
read-only retry and, when validated bytes are available, **Download online
recovery copy**. Do not offer a conflict choice, restore, archive, link attach,
or upload from the setup confirmation. Immediately before committing consent,
repeat the account and row preflight under the account lock. If a selected row
is no longer missing, identical, or an exact recognized linked base, abort the
whole confirmation before writing a run or invoking the manual service. Show
the changed character for review; do not silently continue with fewer selected
characters.

A different browser can still change an eligible row after that locked local
recheck. The server compare-and-set result remains the final guard. If it
returns conflict or archived after consent committed, degraded mode must not
seed or present the integrated conflict resolver and must not automatically
retry. Preserve both existing copies, restore the prior acknowledged link state
or remove only the newly created rejected pending attempt, mark that character
**Needs attention**, and offer the validated online recovery download. A lost
response retains the mutation identity for verification/retry as today; an
explicit conflict result does not. The no-run guarantee applies to contested
rows detected by preflight or the locked pre-consent recheck. A post-consent
server race is a truthful partial result with no accepted online overwrite.

For a differing row, do not let the manual service’s generic conflict error become the product behavior. Create the local document and conflict using the existing automatic repository/conflict service after the safe local transition, then present the existing three semantics in friendly language. This reuses the durable snapshots and prevents a one-time backup choice from becoming last-write-wins. For one-time mode, turn ongoing backup back off only after the selected resolution reaches a verified terminal result.

Rows belonging to another account are not discoverable through RLS and must not be inferred from a prior account’s UI cache. An account-scoped local link for a different account is ignored. The character appears **Not backed up to this account**. Switching back to the original account may reveal its status again after a fresh account-scoped read.

### Completed management surface

The setup wizard collapses into management after completion. Keep these actions:

- **Check now**: refresh current-account online rows and durable local status. It is read-only unless already-authorized work is waiting.
- **Back up now**: explicit one-time copy for a paused or one-time character.
- **Pause updates** and **Keep up to date**: per character. Pausing never removes either copy.
- **Protect new characters automatically**: account-level future default, with a corresponding off operation added to the existing preference service.
- **Restore here**, **Restore as another character**, and **Download recovery copy** for current-account online rows.
- **Remove online copy**: soft archive only, behind a confirmation that local data remains and the online copy can still be recovered. It is separate from pausing.
- **Save a new safety file** and **Restore from a safety file**.
- Recovery-only disclosure: **Save current character recovery file**, **Download original recovery details**, and **Use the earlier browser saving method**. The first action creates the same restorable active-row bundle used by the conditional safety gate. Keep these reachable but outside routine setup. The existing diagnostic `rollkeeper-current-character-export` may remain available only in an explicitly technical diagnostics view and must not be labeled as restorable.

Do not expose a hard-delete action. Do not automatically archive an online row when the player pauses updates.

## 3. State and transition model

Completion and status are derived from the account session, verified safety receipt, confirmed account-scoped backup run, character-family selection and authority, account-scoped preferences/documents/work, current cloud rows, conflicts, and held-aside records. A wizard step index is ephemeral. The run is authoritative only for what the player confirmed and which work may resume. It is never sufficient evidence of cutover readiness or a successful online copy.

| State | Durable/read source | What the player sees | Allowed transition and write boundary |
| --- | --- | --- | --- |
| Signed out | Server claims plus browser auth client | Sign-in call to action; local play and safety-file restore remain available | Sign-in changes session only. Return to `/player/backup`; re-run account discovery. |
| No prior local database | Non-creating existing-database probe returns `null` | Fresh setup state | Passive setup view/resume never calls the creating opener. Final online-backup confirmation may create it for setup. An explicit validated recovery import may independently create it only to stage inactive recovery data; activation still requires the separate restore confirmation. |
| No characters | Hydrated `playerStore` roster | Empty state with create and restore actions | No upload or local transition. |
| Eligible local characters | Roster plus cloud codec preflight | Names, active/archived label, selection checkboxes | Selection is ephemeral until final confirmation. Confirmation persists the exact eligible, selected, and cleared ID sets. |
| Safety file required | No matching verified receipt for current capture hash | Save and choose-back controls | Download records initiation only. Reselect validation records verified receipt. No cutover or upload. |
| Active characters not covered by broad file | Reopened active authority lacks exact mirror parity or has a matching pending mirror entry | One extra current-character recovery file is required | Explicit save may retry the existing mirror queue once. Generate the active rows in the existing restorable bundle format, then download, reselect, hash-check, and freshly compare it. No confirmation without both verified files. |
| Safety file ready | Verified broad receipt plus fresh identical entry vector; when active parity was not proved, also a verified restorable current-character bundle with a fresh identical active-row projection | Checked status, naming one or both required files accurately | Continue to selection. Any drift before confirmation invalidates readiness and requires fresh affected files. |
| Degraded contested character | Current-account preflight finds a newer, different, archived, unreadable, unavailable, future-format, or otherwise untrusted row | Unavailable and unselected, with review/recovery guidance | Retry the read or download a validated recovery copy. Setup confirmation cannot create a run, link, pending mutation, or network mutation for it. |
| Ready | Signed-in account, all required safety evidence freshly unchanged, at least one selected eligible character | Final consequence/account confirmation | Recheck account ID, required source projections, and degraded eligibility, then atomically commit the consent run and complete preferences. No cutover or cloud write may precede that transaction. |
| Confirmed, not prepared | Account-scoped run and preferences committed; local selection may be absent | Continue setup | Resume the exact recorded account, mode, selected IDs, and cleared IDs. Write or validate the character selection record. Never recompute consent from current defaults. |
| Preparing this browser | Confirmed run exists, character selection exists, local authority not active | Neutral progress; characters remain usable if the pre-commit path fails | Compare all protected entries exactly, validate the one expected selection record, then run capture, reopen, parity, journal, and activation gates. No online write yet. |
| Already active, new confirmed account/run | Reopened active authority plus an activated selection owned by an earlier backup authorization | Continue setup without preparation copy | Preserve original selection/recovery/activation fields and rebind only the new account/run authorization after both locks and reopened verification. No select or activate call. |
| Active profile lacks original activation evidence | Real active authority exists but the immutable evidence required for safe rebind is absent or inconsistent | Earlier setup needs attention; characters remain available | Create no run or online work. Save a restorable current-character file. If reopened parity and an empty journal permit the existing confirmed rollback, use the earlier browser saving method and restart setup from legacy authority; otherwise remain in recovery. |
| Backing up | Manual operation in flight or automatic queued/inflight work | Per-character progress | Success only after refetch, decode, identity/version checks, and fingerprint equality. |
| Protected, ongoing | Preference on, validated document, no blocking work, server version greater than zero | Online backup on | Future acknowledged local edits enqueue durable work. |
| Protected, one-time | Preference off, validated acknowledged document/link, no pending initial work | Online copy saved; later changes stay here | Back up now or enable ongoing backup. |
| Paused | Explicit off preference plus retained acknowledged document and possibly paused work | Backup paused | Resume preserves work identity; remove online copy is separate. |
| Offline | Durable work marked offline, or account read failed due network | Waiting for internet; local character stays usable | Reconnect or explicit retry. Do not claim online completion. |
| Sign-in required | Durable work marked auth-required or session absent | Sign in again | Reauthenticate same account, resume its work, never switch namespaces implicitly. |
| Conflict | Unresolved account-scoped conflict with both candidates retained | Needs attention plus three choices | Each explicit resolution snapshots/retains the losing candidate before apply or upload. |
| Recovery required | Character bootstrap or recovery import cannot prove safe activation | Friendly fail-closed recovery screen | Export current/capture data, inspect candidates, retry repair, or parity-gated rollback. Never fall back silently. |
| Current-character file staged | Exact validated `DeviceBackupV1` character file plus inactive recovery generation; active pointer unchanged | Restore preview; nothing changed yet | Explicit restore confirmation compares the real current source. Divergence remains recovery required; a truly empty or identical source may activate. |
| Current-character restore verifying | New pointer/evidence committed and semantic marker finalized from the verified file | Checking restored characters | Close/reopen, initialize and hydrate, then compare every character ID/content hash to the file. Only that proof renders success. |
| Unsupported future data | Held-aside record plus raw recovery content | This copy needs a newer RollKeeper version | Download recovery copy. Never parse into active character or overwrite it. |
| Account changed | Auth subscription reports a different account ID | Checking this account; no prior-account names or rows | Close the old context, clear ephemeral rows/statuses, stop old worker, and rebuild under the new namespace. Stale async results are discarded by account token. |
| Run replaced in another tab | Transactional active-run check differs from `expectedActiveRunId` | Backup choices changed in another tab | Abort the local transaction and make no network call. Discard stale UI state and load the current account's active run for review. |
| Safe cross-tab lock unavailable | Required exclusive browser lock is absent | Online setup unavailable; safety-file and recovery actions remain | Make no confirmation, work, link, or cloud mutation. Do not silently use reduced guarantees. |
| Partial success | Mixed per-character terminal states | Exact protected and attention counts | Retry only failed characters. Do not roll back successes or start unselected characters. |
| Retry | Retained mutation identity/pending manual link | Try again | Reuse the same mutation ID for response-loss retry; revalidate the acknowledgement. |
| Closed or reloaded before confirmation | Verified receipt may exist; no setup choices written | Resume at the safety or selection step | No automatic continuation and no upload. |
| Closed or reloaded after confirmation | Confirmed run plus preferences, selection, authority, documents, pending work, and cloud links | Continue setup with already-finished work skipped | Load only the active account's run and resume only its recorded selected IDs and mode. Require an explicit **Continue setup** click before an unfinished local transition. Already-authorized pending online work may resume under Slice 9 rules. |

The status projector must explicitly distinguish these cases. Do not reuse the current `paused -> local-only` display mapping.

## 4. User-facing copy deck

Everything between the following markers is proposed rendered copy. It contains no forbidden storage vocabulary, no em dash, and no raw service text.

<!-- PLAYER_BACKUP_COPY_START -->

### Dashboard

| State | Copy |
| --- | --- |
| Not started | Title: **Protect your characters**. Description: **Save a safety file, choose your characters, and protect them with your account.** Button: **Back up my characters online**. |
| Resumable | Title: **Character backup is not finished**. Description: **Your completed steps are still safe. Continue when you are ready.** Button: **Continue character backup**. |
| Ongoing complete | Title: **Online backup is on**. Description: **{protected} characters are protected. {attention} need attention.** Buttons: **Manage backups**, **Restore characters**. |
| One-time complete | Title: **Online copies saved**. Description: **{protected} characters were saved online. Later changes stay in this browser until you back up again.** Buttons: **Manage backups**, **Restore characters**. |
| No characters | Title: **No characters to back up**. Description: **Create a character or restore one from a backup first.** Buttons: **Create a character**, **Restore characters**. |
| Service unavailable | Title: **Online backup is unavailable right now**. Description: **Your characters are still safe in this browser. You can save or restore a safety file.** Buttons: **Save a safety file**, **Restore characters**. |

### Step 1: account

- Eyebrow: **Step 1 of 3: Account**
- Title: **Protect your characters**
- Description: **Sign in to keep private online copies of the characters you choose. Signing in alone does not copy or change anything.**
- Signed out status: **Not signed in**
- Signed out button: **Sign in to continue**
- Signed in status: **Using {email}**
- Recheck button: **Check my account**
- Account error: **RollKeeper could not check your account. Nothing in this browser was changed. Try again.**

### Step 2: safety file

- Eyebrow: **Step 2 of 3: Safety file**
- Title: **Save a safety file**
- Description: **Save a private recovery file for RollKeeper data in this browser. RollKeeper will check whether one extra file is needed for your current characters.**
- One-file description: **This file includes your current characters and campaign data saved in this browser. Keep it private and somewhere you can find later.**
- Extra-file title: **Save one more recovery file**
- Extra-file description: **Some current character changes are not included in the first file. Save this extra file so those characters can be recovered too.**
- First instruction: **1. Save the file**
- Download button: **Save safety file**
- Second instruction: **2. Choose the file you just saved**
- File input accessible name: **Choose safety file**
- Extra download button: **Save current character file**
- Extra file input accessible name: **Choose current character file**
- Preparing: **Preparing your safety file...**
- Checking characters: **Checking your current characters...**
- Download started: **Now choose the file you just saved so RollKeeper can check it.**
- Verified title: **Safety file checked**
- Verified description: **The required file or files match the current data in this browser. You can continue safely.**
- Existing verified receipt: **Your checked recovery files still match this browser, so you do not need to save them again.**
- Mismatch title: **That file does not match**
- Mismatch description: **The data in this browser changed, or the file came from somewhere else. Save a new safety file and choose that one instead.**
- Read failure: **This browser could not read that file. Save a new safety file and try again.**
- Current-character failure: **RollKeeper could not verify a recovery file for your current characters. Nothing was changed. Try again, or open recovery options.**
- Earlier-setup title: **Earlier character setup needs attention**
- Earlier-setup description: **RollKeeper cannot safely start online backup from the current setup. Your characters are still available. Save a current character recovery file, then open recovery options.**
- Earlier-setup actions: **Save current character recovery file**, **Open recovery options**

### Step 3: selection and consent

- Eyebrow: **Step 3 of 3: Characters**
- Title: **Choose characters**
- Description: **All available characters are selected. Clear any character you do not want to protect with this account.**
- Buttons: **Select all**, **Clear all**
- Archived label: **Archived**
- Already protected: **Already protected**
- Not protected: **Not backed up**
- One-time protected: **Saved online once**
- Paused: **Backup paused**
- Different: **Different online copy**
- Newer: **Online copy has newer changes**
- Removed: **Online copy was removed**
- Unavailable: **Cannot be backed up yet**
- Unavailable description: **RollKeeper cannot safely read this character right now. Nothing will be changed.**
- Degraded review status: **Review needed first**
- Degraded different description: **This account already has another copy of this character. This backup option cannot safely choose between them. Nothing will be changed.**
- Degraded newer description: **The online copy has changes that are not in this browser. This character cannot be included here.**
- Degraded removed description: **A removed online copy already exists. This character cannot be included here.**
- Degraded unavailable description: **RollKeeper could not safely check the online copy. Try again before including this character.**
- Degraded next action: **Download online recovery copy**
- Degraded selection changed: **The online copy of {name} changed while RollKeeper was checking it. Nothing was copied. Review this character and confirm again.**
- Degraded online race: **The online copy of {name} changed before backup finished. Nothing was replaced. Download a recovery copy, or try again when full online backup is available.**
- No degraded eligible characters: **None of these characters can be safely copied with the backup option available right now. You can download recovery copies or try again later.**
- Switch label: **Keep these backups up to date**
- Switch description: **Recommended. After a change is saved in this browser, RollKeeper will update the online backup for you.**
- Switch-off title: **Save one online copy now**
- Switch-off description: **Later changes will stay only in this browser until you choose Back up now.**
- Ongoing confirmation when preparation is required: **RollKeeper will prepare character saving in this browser, copy {count} selected characters to {email}, and keep their online backups up to date. New characters will also be protected unless you turn backup off for them. Your characters stay available here. Nothing is deleted.**
- Ongoing confirmation when character saving is already ready: **RollKeeper will copy {count} selected characters to {email} and keep their online backups up to date. New characters will also be protected unless you turn backup off for them. Your characters stay available here. Nothing is deleted.**
- One-time confirmation when preparation is required: **RollKeeper will prepare character saving in this browser and save one online copy of {count} selected characters to {email}. Later changes stay here until you back up again. Nothing is deleted.**
- One-time confirmation without preparation: **RollKeeper will save one online copy of {count} selected characters to {email}. Later changes stay in this browser until you back up again. Your characters stay available here. Nothing is deleted or moved.**
- Ongoing button: **Turn on online backup**
- One-time button: **Save online copies**
- No selection: **Choose at least one character to continue.**
- Account changed: **The signed-in account changed. Check the account and confirm again before anything is copied.**
- Data changed: **Your character data changed after the safety file was checked. Save a new safety file before continuing.**

### Progress and result

- Preparing: **Preparing safe character saving in this browser**
- Uploading: **Backing up {name}**
- Verified: **{name} is protected**
- Queued: **{name} will be backed up when the connection is ready**
- Partial title: **Some characters need attention**
- Partial description: **{protected} are protected. {attention} still need attention. Nothing was deleted.**
- Complete title: **Your characters are protected**
- Ongoing complete: **Online backup is on for {count} characters.**
- One-time complete: **Online copies were checked for {count} characters.**
- Buttons: **Manage backups**, **Try again**, **Done**
- Generic local failure: **RollKeeper could not finish preparing this browser. Your existing characters were not replaced. Try again, or open recovery options.**
- Generic online failure: **Online backup could not finish just now. Your characters are still safe in this browser. Try again.**
- Offline: **You appear to be offline. Your changes are safe in this browser and online backup will continue when the connection returns.**
- Sign-in expired: **Sign in again to continue online backup. Your local characters and waiting changes were kept.**
- Choices changed elsewhere: **Backup choices changed in another tab. Nothing new was copied. Review the current choices before continuing.**
- Safe locking unavailable: **Online backup cannot start safely in this browser right now. Your characters were not changed. You can still save or restore a safety file.**

### Conflict

- Title: **Choose which copy to use**
- Description: **RollKeeper kept both versions. Nothing will be discarded until you choose.**
- Button: **Keep my changes**
- Keep-mine description: **Use the version in this browser for the online backup. The online version stays in recovery history.**
- Button: **Use online version**
- Use-online description: **Use the online version in this browser. Your current version stays in recovery history.**
- Button: **Keep both**
- Keep-both description: **Keep this browser's version and add the online version as another character. The added character will not be backed up until you choose it.**
- Future-data title: **This online copy needs a newer RollKeeper version**
- Future-data description: **Nothing was replaced. Download a recovery copy, then update RollKeeper before trying to use it.**
- Download button: **Download recovery copy**

### Management

- Page title: **Character backups**
- Summary: **{protected} protected, {paused} paused, {attention} need attention**
- Read-only refresh: **Check now**
- Per-character actions: **Back up now**, **Pause updates**, **Keep up to date**, **Restore here**, **Restore as another character**, **Download recovery copy**
- Future default on: **Protect new characters automatically**
- Future default description: **New characters will use online backup after they are first saved in this browser.**
- Remove action: **Remove online copy**
- Remove confirmation: **Remove the online copy of {name}? The character in this browser will stay. RollKeeper keeps the removed online copy available for recovery.**
- Remove success: **The online copy was removed. The character in this browser was not changed.**
- Pause success: **Online updates are paused. Existing local and online copies were kept.**
- Resume success: **Online backup is on again.**

### Safety-file recovery and rollback

- Section title: **Safety files and recovery**
- Description: **Save a fresh safety file, restore missing data, or open recovery options when something needs attention.**
- Buttons: **Save a new safety file**, **Restore from a safety file**, **Recovery options**
- Import title: **Review safety file**
- Import description: **Your current characters and other saved data have not changed. RollKeeper will keep existing data and show different copies for review.**
- Safe restore button: **Restore missing data**
- Restore confirmation: **Restore data that is missing from this browser? Existing data will not be replaced.**
- Restore result: **Missing data was restored. Different copies were kept for review.**
- Current recovery file: **Save current character recovery file**
- Technical evidence download: **Download recovery details**
- Restore current-character file: **Restore current characters**
- Restore preview: **Your current characters are ready to restore. The characters already in this browser have not changed.**
- Restore confirmation: **Restore these characters in this browser? RollKeeper will keep any different local data for review.**
- Restore success: **Your characters were restored and checked after loading them again.**
- Restore difference: **This browser already has different character data. Nothing was replaced. Review both copies in recovery options.**
- Restore verification failure: **RollKeeper could not verify the restored characters after loading them again. Your recovery file was not changed. Open recovery options before trying again.**
- Invalid recovery file: **RollKeeper could not check this recovery file. Nothing was changed. Choose another file.**
- Unusable recovery data: **Some character data cannot be restored with this version of RollKeeper. It was kept for recovery and nothing was replaced.**
- Original export: **Download original recovery copy**
- Rollback action: **Use the earlier browser saving method**
- Rollback description: **RollKeeper can do this only after it checks that the current saved copies match and no changes are waiting.**
- Rollback confirmation: **Use the earlier saving method now? Your safety files and recovery copies will be kept.**
- Rollback refusal: **RollKeeper could not prove that every current copy matches, so nothing was changed. Open recovery options.**
- Recovery-required title: **Your characters need recovery**
- Recovery-required description: **RollKeeper could not safely open the current saved copy and did not fall back to an older one. Download the available recovery files before trying another action.**

<!-- PLAYER_BACKUP_COPY_END -->

### Vocabulary regression guard

Add a stricter `expectPlayerBackupVocabulary` helper beside `expectCloudProductVocabulary` in `src/test/helpers.ts`. It must collect separate visible text nodes and all accessible-name sources on the root and descendants: `aria-label`, resolved `aria-labelledby`, `title`, `placeholder`, and `alt`. Exercise every conditional state, including errors and dialogs.

The guard must reject case-insensitive whole-word variants of:

`IndexedDB`, `localStorage`, `manifest`, `schema`, `authority`, `epoch`, `cutover`, `migration`, `namespace`, `mutation`, `outbox`, `tombstone`, `quarantine`, `CAS`, `device`, `workflow`, `canary`, and `workspace`.

Also reject the Unicode em dash `\u2014`. Treat `sync`, `synchronization`, and `synchronized` as forbidden in the new player backup subtree even though the product brief classifies them as avoidable rather than absolutely forbidden. This keeps the new surface consistently goal-oriented.

Write mutation-resistant tests that first prove the helper fails for every forbidden word in visible text and in each accessible-name channel, including a phrase split across sibling nodes and a violation on the root element. Do not allowlist internal filenames because they should never be rendered. Scan mapped runtime failures too; raw `Error.message`, DOM exceptions, transport strings, and internal discriminants must be logged for diagnostics and replaced by channel-specific friendly copy before rendering.

## 5. Architecture and reuse map

### Reuse and required boundaries

| Capability | Reuse |
| --- | --- |
| Full pre-change safety capture | `captureDeviceBackup`, `initiateDeviceBackupDownload`, `verifyDownloadedDeviceBackup`, `browserRecoveryRepository` |
| Current-character safety coverage after activation | `readCharacterAuthority`, parity/journal logic extracted from `rollbackCharacterAuthority`, `retryCharacterMirrorJournal` on explicit save only, and new `captureActiveCharacterRecoveryBundle` using `captureDeviceBackup(ReadonlyMap)` when parity cannot be proved |
| Safety-file import before character cutover | Reuse `validateDeviceBackupJson`, staging, and preview. Harden restore with the code-derived user-data allowlist below; do not reuse unrestricted `restoreRecoveryEntries` behavior. |
| Safety-file import after character cutover | `validateDeviceBackupJson`, `importCharacterRecoveryGeneration`, and hardened `activateImportedCharacterGeneration`; the same exact active-row file stages inactive before explicit activation and never restores only the compatibility mirror |
| Character preparation and activation | For legacy authority only: `selectCharacterCutover`, `bootstrapCharacterPersistence` or its existing migration primitive, `inspectCharacterCutoverReadiness`, `activatePreparedCharacterCutover`, and `markCharacterCutoverActivated`. For already-active authority: the verified rebind below, never `selectCharacterCutover`. |
| Character recovery and rollback | Restorable `captureActiveCharacterRecoveryBundle`; diagnostic-only `exportCurrentCharacterData`; `exportMigrationRecovery`, `readCharacterAuthority`, `verifyCharacterRollbackGenerationAfterReopen`, `rollbackCharacterAuthority` |
| One-time online copy | `ManualCharacterCloudService`, gateway, codec, account-scoped link repository, recovery download |
| Ongoing backup | `AutomaticCharacterSyncService`, preferences, IndexedDB repository, worker, puller, coordinator, runtime |
| Conflict preservation | `IndexedDbAutomaticCharacterSyncRepository.preserveConflict`, `AutomaticCharacterConflictService` |
| Account lifecycle | Supabase browser client, `getUser`, `onAuthStateChange`, current `/account` form and controls |
| Character store application | `addCloudRecoveredCharacter`, `replaceCloudRecoveredCharacter`, `awaitCharacterPersistenceResult` |
| Interaction shell | DM wizard’s dedicated route, derived-state controller, progress rail, safety-file reselect pattern, error mapper, final live verification, and legacy-panel hiding pattern |

### New client orchestration

Add `src/lib/playerBackup/` with narrow modules rather than putting persistence calls in React components:

- `playerBackupFlags.ts`: umbrella flag and capability matrix.
- `playerBackupStatus.ts`: pure status projection that distinguishes never protected, one-time, ongoing, paused, queued, offline, sign-in required, conflict, failed, and held-aside.
- `playerBackupSafety.ts`: exact verified-receipt gates, active-character mirror coverage inspection, restorable active-row bundle projection, full pre-confirmation entry-vector comparison, protected-entry projection, and path-specific validation of the one expected character-selection record.
- `playerBackupRunRepository.ts`: versioned account-scoped consent and execution checkpoints in the existing `meta` store. It exposes a transaction boundary that commits the run and complete preference result together.
- `playerBackupRunFence.ts`: account-scoped exclusive-lock adapter plus `expectedActiveRunId` guards shared by confirmation, manual backup, automatic work creation/dispatch, conflict resolution, archive, restore, pause, and resume mutations.
- `playerBackupActiveSelection.ts`: lock-ordered, reopened-authority and original-activation-evidence verification plus selection-marker rebind for a new confirmed account/run over an already-active character family.
- `playerBackupCloudPreview.ts`: read-only authenticated list/fetch/decode/compare adapter that never opens the local database or writes a link, run, preference, document, or work item.
- `playerBackupRecoveryPolicy.ts`: code-owned restore allowlist and routing between generic missing-data restore and dedicated active-character recovery.
- `playerBackupCoordinator.ts`: account-token guarded orchestration for preview, confirmation, one-time backup, ongoing setup, partial results, and idempotent resume.
- `playerBackupConflictCoordinator.ts`: correlate validated existing rows and seed the existing durable conflict path without overwriting either candidate.
- `playerBackupCopy.ts`: the only mapping from internal failures/discriminants to rendered copy.

The coordinator must use an incrementing request/account token for stale React responses and the durable run fence for cross-tab writes. Every async result checks the token and target account before applying UI state. Every local mutation additionally checks `expectedActiveRunId` transactionally, and every gateway mutation performs the same check while holding the account lock. On account change it closes the old context, clears rows and statuses synchronously, and rebuilds from the new account. It must not derive completion from the last React state or a success toast.

Add a durable consent run, not a `wizardCompleted` boolean. Use a versioned key such as `player-backup-run:<run-id>` plus an account-scoped active-run pointer in the existing IndexedDB `meta` store. The run contains no character payload. It records `runId`, `accountId` and `user:<account-id>` namespace, mode, eligible/selected/cleared ID snapshots, future-default choice, verified broad recovery run/hash/creation time and protected-entry digest, active authority identity, the conditional current-character bundle run/hash/entry-vector receipt when required, confirmation time, lifecycle stage, and per-character checkpoint/result references. The exact row shape is internal, but all those invariants are required.

The run is written only by final confirmation and must commit in the same `meta` transaction as the selected, cleared, and account-default preference rows. It is the sole authority for the scope of resumable consent. Completion still comes from local authority plus validated documents, pending work, cloud acknowledgements, conflicts, and held-aside records. A run status or pointer can never by itself render **Protected**. If a crash occurs before this transaction commits, reopening returns to selection and requires confirmation again. If it commits, all later steps are idempotent and use exactly the recorded scope even when current defaults, roster order, or prior explicit-off records differ.

The confirmation transaction records lifecycle stage `confirmed`, not
`local-ready`. Only successful first activation or a verified/read-back
already-active rebind may advance the run to `local-ready`. Initial automatic
document/work creation checks that checkpoint in the same transaction as its
run fence. Thus committed preferences cannot start online work if rebind fails.

Read-only route discovery must call a new
`openExistingRollkeeperDatabase` helper in
`src/lib/indexeddb/localDatabase.ts`. On a missing database, its aborted
`onupgradeneeded` path returns `null` and leaves no database behind. Do not use
`indexedDB.databases()` as the sole implementation because availability varies
and its result races creation/deletion; it may be used only as an optimization
or test observation. A present but incompatible database is closed and reported
as a friendly recovery/unavailable state, never upgraded merely by viewing.
This non-creation rule governs route rendering, run discovery, account checks,
cloud preview, and setup resume. It does not govern the separate explicit
recovery-import command: after a selected file passes in-memory format and hash
validation, that command may call `openRollkeeperDatabase` to stage an inactive
generation. File validation failure still leaves the database absent. Staging
does not authorize setup or activation.

### Required local contract hardening

#### Verified receipt and stable protected source

The wizard must require `hasVerifiedDownloadReceipt`, not `hasDownloadReceipt`, before any character authority change. Prefer strengthening `inspectCharacterCutoverReadiness` and its `recoveryGate` interface so every caller gets the stronger guarantee. If legacy flag-off behavior must retain the old initiation-only contract for compatibility, add a distinct verified wizard gate and test that the wizard cannot call activation through the weaker path. The first option is recommended because it closes the real gap globally without a schema change.

Do not compare the post-confirmation full aggregate hash directly with the
pre-confirmation aggregate hash. `selectCharacterCutover` necessarily changes
the exact character-selection key and would make that check fail. Add a shared
comparison that uses the verified receipt's entry vector and a fresh capture:

- before confirmation, every key, byte count, and hash must match exactly;
- during readiness and activation, remove only the exact
  `characterCutoverSelectionKey(namespace)` from both vectors and require the
  remaining sorted vectors to be identical;
- require every non-selection addition, removal, or byte change to fail the
  gate, including newly created `rollkeeper-` keys;
- for first activation only, parse the new selection independently and require
  version, namespace, family, recovery run ID, aggregate hash, and creation time
  to match the current consent run's verified broad receipt; require its
  `playerBackupRunId` and `playerBackupAccountId` to match the active consent run
  and current account;
- for already-active rebind only, validate the preserved selection/recovery and
  activation fields against immutable original activation evidence and the
  reopened real authority. Validate the new broad receipt and any required
  current-character bundle through the new consent run, not through the
  selection's original recovery fields. After rebind, require only the three
  player-backup authorization fields to match the new run/account/time;
- legacy selections without the player-backup fields cannot authorize wizard
  upload, and active selections without independently verifiable original
  activation evidence cannot be rebound by inventing it;
- do not use the bundle's `classification` field to decide which keys are
  protected.

The selection record may gain only fields produced by the selection,
activation, and rebind APIs. A malformed, wrong-account/namespace, or
wrong-family record fails closed. First activation also fails on a wrong current
run/receipt; rebind fails on wrong original activation evidence or wrong new
authorization fields. `sourceManifestUnchanged` should be renamed or
supplemented with a gate such as `protectedSourceUnchanged` so tests cannot
mistake the weaker post-confirmation projection for a full aggregate match.

The observable proof is:

1. every required file was generated;
2. each download initiation was recorded;
3. the player selected every required file;
4. the selected bytes passed the applicable internal hash and projection
   validation;
5. run ID and aggregate hash matched the expected capture;
6. a verified receipt was durable;
7. a fresh full entry vector still matched immediately before confirmation;
8. the confirmed run and complete preference result committed together;
9. immediately before preparation and activation, every protected entry still
   matched and the sole excluded selection record passed the first-activation
   rule; or, for active rebind, the original activation evidence and current
   run's separate safety evidence both passed their respective rules.

#### Current-character coverage after activation

Add `inspectCurrentCharacterSafetyCoverage` as a read-only helper over the
active pointer, `kvGenerations`, and character mirror journal. Reuse the exact
presence-aware parity logic from `rollbackCharacterAuthority`; do not use the
weaker “at least one family row exists” check. Its result must include the
reopened authority identity, parity, matching-journal count, and exact active
row set suitable for a before-confirmation comparison.

For active authority, the safety step follows this order:

1. On the explicit save action only, retry the existing character mirror
   journal once.
2. Close and reopen, verify the authority identity, and inspect parity plus the
   matching journal.
3. If parity is exact and the matching journal is empty, generate and verify the
   broad file after that proof. Record that its character coverage was proved
   for the authority generation/epoch.
4. Otherwise, generate both the broad file and
   `captureActiveCharacterRecoveryBundle`. The latter converts the exact
   present active rows to a `ReadonlyMap` and calls `captureDeviceBackup`, so it
   produces `rollkeeper-device-backup`, not the diagnostic
   `rollkeeper-current-character-export`. Require re-selection through the
   existing validator and receipt service for both. Record the character
   bundle's run, manifest, entry vector, and source authority generation/epoch
   in the consent preview.
5. Immediately before confirmation, repeat the read-only coverage inspection.
   The one-file branch must still have parity, an empty matching journal, and
   the same authority. The two-file branch must regenerate the active-row bundle
   with the original run/time and match its entry vector, manifest, generation,
   and epoch. Any drift invalidates the affected receipt and creates no run.

This adds no server or SQL contract. The conditional receipt is stored in the
existing local run metadata. It does not make the broad restore path eligible
to write active character control records. The conditional file itself is
restorable through the dedicated character path described below.

#### Already-active marker rebind

When `readCharacterAuthority` reports active IndexedDB authority, the
coordinator must not call `selectCharacterCutover`; that function constructs a
new record and would discard the activation fields required by
`initializeActivatedRuntimeFromSelection` after reload. Under the
account-scoped run lock, acquire the existing character migration lock in that
fixed order, then:

1. read and validate the current character-selection record;
2. close and reopen the local database;
3. use a new `verifyActiveCharacterAuthorityAfterReopen` helper, extracted from
   the current rollback verification logic, to prove the active namespace,
   generation, epoch, presence of character-family rows, and the separately
   required current-character safety coverage;
4. require the selection's `activatedGeneration` and `activatedEpoch` to equal
   that real authority and require its namespace/family to match. Read the
   immutable `character-activation-evidence:<namespace>:<generation>` record and
   require it to reproduce the selection's original `selectedAt`, recovery run,
   recovery hash, recovery creation time, activation generation, and activation
   epoch;
5. rewrite the selection with the original `selectedAt`, recovery run/hash/time,
   activation generation, and activation epoch unchanged, updating only
   `playerBackupRunId`, `playerBackupAccountId`, and
   `playerBackupAuthorizedAt` for the newly
   confirmed run;
6. read the record back and reverify both the preserved authority fields and
   new authorization fields before creating online work.

The initial legacy selection path writes the same three player-backup
authorization fields, then `markCharacterCutoverActivated` adds activation
fields as it does today. Extend the activation transaction in the existing
`meta` store to add the immutable activation-evidence record with the original
selection/recovery fields and the newly committed generation/epoch; an existing
different record aborts activation. Read back both records before marking the
run `local-ready`. Because the active-pointer transaction and compatibility
selection write cannot be atomic, add one narrowly idempotent crash repair: if
the pointer and immutable evidence committed but the selection lacks activation
fields, the locked coordinator may add only the generation/epoch reproduced by
that evidence after proving every original selection/recovery/authorization
field still matches the same run. Any other missing or changed field fails
closed. Mere sign-in, account switch, preview, or reload never rebinds or repairs
the marker; an explicit **Continue setup** action performs the repair.

A missing marker or activation-evidence record, a mismatch with the original
evidence or reopened authority, or write/readback failure is recovery-required
and leaves online work absent. Do not reconstruct activation evidence from the
current wizard receipt or UI state. Pre-wizard active profiles that lack
independently verifiable activation evidence remain usable locally but require
the restorable current-character bundle first. They may return to legacy authority only
through the existing explicit rollback after reopened parity and empty-journal
proof, then restart setup and create new activation evidence. If rollback is not
safe, wizard enrollment stays blocked and the recovery surface remains
available; the coordinator must not synthesize evidence merely to unblock it.

This rebind applies only when the capability plan authorizes the integrated
local path, meaning `C=true` and `S=true`. Degraded manual-only backup does not
use the selection marker as upload authorization and performs no select,
prepare, rebind, or activate call; its account-scoped consent run authorizes the
manual copy.

#### Durable consent and idempotent resume

The final-confirmation transaction must commit before
`selectCharacterCutover`, service enablement, manual link creation, pending
work, or any cloud call. Cross-storage atomicity is not possible between the
IndexedDB `meta` transaction and the selection key, so ordering and
idempotency are required: a committed run with no selection resumes by writing
the validated selection; a selection for this run with no committed run is
invalid and cannot authorize upload; failure of either step leaves all online
work absent.

Every post-confirmation entry point loads the active-account run first and uses
its recorded ID sets and mode. It must not rebuild selection from “all
eligible,” current checkboxes, preference defaults, roster order, or existing
links. Account change closes the context immediately; another account cannot
see or continue the run. Per-character checkpoints may advance only after the
underlying local or online fact is durable, and retries are idempotent. A
completed run may be retained for audit and status derivation, but its status
cannot replace acknowledgement verification.

#### Same-account run fence

Use an exclusive browser lock named from a constant prefix plus the account ID.
Both final confirmation and every run-scoped gateway mutation must acquire it.
The confirmation API is compare-and-replace:
`replaceActiveRun(expectedActiveRunId, nextRun)`. Inside the same multi-store
transaction that writes the run and preferences, it reads the active pointer
and aborts unless it equals the caller's observed ID, including `null` for a
fresh account. Two tabs confirming from the same observed state therefore
cannot both win.

Every document, intent, pending-work, manual-link checkpoint, and conflict
created for initial setup carries `originPlayerBackupRunId`. A run-scoped local
transaction includes `meta` with its other object stores and checks that the
active pointer equals `expectedActiveRunId` before writing. Immediately before
a gateway mutation, while still holding the account lock, the caller opens the
existing database, repeats that pointer check, validates the active account and
work origin, sends the request, and holds the lock until the response is
durably acknowledged or retained for retry. A newer confirmation cannot commit
mid-request because it needs the same lock.

If the pointer differs, the stale tab creates no work and makes no gateway
mutation. It drops its ephemeral state and reloads the newer run. Broadcast or
storage notifications may wake other tabs, but they are not the fence. A
missing Web Locks API is a fail-closed capability state for wizard confirmation
and mutation. Do not fall back to the existing reduced-guarantee writer mode.

After setup is terminal, later ordinary edits are authorized by the durable
per-character preference rather than by reopening the completed setup run.
They still use the same account lock and re-read the current preference before
dispatch, so a newer confirmation that clears or pauses that character stops
new updates. This distinction prevents the run pointer from accidentally
disabling established ongoing backup for unrelated characters.

#### Safe recovery routing

Harden `restoreRecoveryEntries` or replace the wizard caller with a safe API
whose restorable decision is derived from the key, never from the file's
classification or UI selection alone. The allowlist is the registered exact
managed-data keys, `rollkeeper-character:<id>` envelopes that pass character
validation, and registered location/battle-map canvas keys. Under active
character authority, remove all character-family keys from generic restore and
route them to `importCharacterRecoveryGeneration`.

The conditional current-character file is deliberately a character-only
`DeviceBackupV1`, not `rollkeeper-current-character-export`. Add
`captureActiveCharacterRecoveryBundle` beside the current character recovery
code. It reads a reopened, verified active generation, rejects an empty or
malformed row set, converts only present character-family rows to a map, and
delegates all per-entry and aggregate hashing to `captureDeviceBackup`. The
exact downloaded bytes therefore pass `validateDeviceBackupJson` and
`importCharacterRecoveryGeneration` without format conversion.

Harden the recovery path so that validation is not mistaken for restoration:

1. The recovery UI routes this file by validated content and action, never by
   filename. Opening recovery and inspecting an unselected file control are
   passive and use the non-creating probe. Parse and hash-check the selected file
   in memory first. When actual authority or the enabled recovery policy selects
   the staged path, the player's explicit import action authorizes creation of
   `rollkeeper-local`, when absent, only for
   `importCharacterRecoveryGeneration` to write a fresh inactive generation and
   source bundle hash. It does not change the active pointer, compatibility
   values, selection marker, account links, backup preferences, or online state.
   Invalid JSON, an invalid `DeviceBackupV1` shape, a per-entry checksum failure,
   an aggregate mismatch, an empty character entry set, or a duplicate character
   key fails before the creating opener or staging transaction. By contrast, a
   structurally and cryptographically valid bundle whose character envelope is
   malformed or from a future version is valid recovery evidence: create/stage
   the inactive generation, retain the exact raw value with quarantine evidence,
   and report it as blocked from activation.
2. Extend `activateImportedCharacterGeneration` to compare against the real
   current character source. A valid active pointer with a missing generation is
   corruption and fails closed. Existing active or legacy character data that
   differs produces retained conflicts exactly as today. A truly empty profile
   with no active pointer and no character-family compatibility value may, after
   explicit confirmation, activate the staged generation. Identical current
   data may also activate. Quarantined rows or a matching journal still block.
3. The activation transaction retains every prior generation, commits the new
   pointer/epoch and immutable evidence in the same
   `character-activation-evidence:<namespace>:<generation>` shape used by first
   activation, and never imports control records from the file. After commit, a
   code-generated semantic character selection marker receives the verified
   bundle's run/hash/time and committed generation/epoch. It carries no account
   or online-backup authorization. Use the same explicit-continuation crash
   repair as first activation if the pointer committed before that marker write.
4. Close and reopen the database, initialize the runtime from the generated
   marker, hydrate the character stores, and compare every restored character ID
   and content hash with the exact validated file before showing success. A
   pointer write, import return value, or toast is not proof of restoration.
5. When the real authority is legacy and the local transition capability is
   unavailable, the same validated character-only file may use the hardened
   generic missing-data restore into compatibility storage. It may write only
   absent allowlisted character keys, preserves every collision, then reloads
   and verifies the same ID/content hashes. This keeps recovery available during
   a lower-flag rollback without inventing a second file format.

Both restore branches consume the exact file the player downloaded. Neither
branch enrolls online backup or adopts an account. The diagnostic
`exportCurrentCharacterData` remains downloadable only as recovery evidence
until a separate importer exists; the player wizard must not label it as a file
that can restore characters. This needs no server, SQL, object-store, or database
version change; recovery and activation evidence use the existing `meta` store.

All `retained-only` keys are evidence-only in this flow. Explicitly deny
`rollkeeper:indexeddb-selection:*`, every DM family selection prefix,
`rollkeeper-character-cloud-links-v1`, migration/ownership markers, account
and preference records, pending-work references, recovery receipts, and any
unknown `rollkeeper-` key. They remain in the downloaded/staged file and may be
exported for diagnostics, but the generic restore function never writes them.
Preview must report them as unavailable for automatic restore and must not
preselect them. A forged bundle classification cannot bypass the key policy.

#### Atomic confirmed selection

Replace `confirmAccountEnable` for wizard confirmation with an
`applyConfirmedSelection` operation over one `meta` readwrite transaction. It
receives the confirmed account namespace, full eligible snapshot, selected and
cleared IDs, mode, future-default choice, confirmation time, and run record.
It validates that selected and cleared are disjoint and exactly partition the
eligible snapshot, then writes:

- the player-backup run and active-run pointer;
- explicit `on` rows for every selected character in ongoing mode, overwriting
  prior explicit-off rows;
- explicit `off` rows for every cleared character;
- explicit `off` rows for selected characters in one-time mode;
- an account future-default record with the confirmed `on` or `off` value.

Do not call the existing “preserve explicit off” loop from this path. After the
transaction, re-read and verify the exact preference partition before creating
documents or work. A transaction abort leaves the run, all character
preferences, and the future default unchanged. The existing legacy account
enable operation remains unchanged for flag-off compatibility unless it can be
safely implemented through the new primitive without changing its semantics.

### Behavior that stays outside the wizard

- Campaign membership, invitations, deliveries, and the later player inbox.
- DM campaign-family setup and management.
- Locations, battle maps, S3 objects, Redis live play, and relay behavior.
- Character creation, editing, archive, ordinary import, and campaign joining.
- Physical online deletion or local cleanup.
- Account ownership recovery policy.
- General offline application-shell work.

No SQL, Supabase migration, new RPC, or server route is justified. The existing character RPC, RLS, receipt, soft-delete, and version contracts cover the plan. Any implementation that proposes a server change must first add a failing client-contract test proving why the current gateway cannot satisfy a specific acceptance criterion.

## 6. Feature-flag and compatibility plan

Add `NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE=false`. It controls surface ownership only. Existing lower flags remain the enforcement boundary for each capability:

- `A`: valid auth configuration.
- `M`: `NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED` for one-time copy, listing, restore, verify, archive, and recovery download.
- `C`: `NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED` for the safe local transition.
- `S`: `NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED` for ongoing backup.
- `W`: new wizard flag.
- `L`: runtime availability of the required account-scoped exclusive browser lock. It is not a deployment flag and cannot enable a lower capability.

For this matrix, “read” means authenticated `getUser` plus current-account
list/fetch/decode/compare operations exposed by an enabled lower capability.
Reads are allowed before confirmation so the player can see existing online
copies and conflicts. They must be side-effect free locally and remotely.
“Mutation” includes link attachment, run/preference/document/work writes,
upload/update/archive/restore RPCs, and local ownership changes. Setup mutations
remain forbidden until final confirmation; later management mutations require
their own explicit action.

| Matrix | `/player` rendering | `/player/backup` behavior | Calls allowed |
| --- | --- | --- | --- |
| `W` absent or false | Exact current dashboard: header export, safety banner, full recovery section, and each legacy panel governed by its own lower flag | 404 | Exact existing behavior only |
| `W=true`, `A=false` | New compact surface; all old setup panels and header `Export All` hidden | Safety-file save/restore and friendly recovery available; online setup explains temporary unavailability | No auth client or character cloud calls |
| `W=true`, `A=true`, `L=false` | New compact surface only | Current-account status and safety-file/recovery actions remain available; confirmation and backup mutations show the fail-closed availability message | Enabled read-only account/list calls only; no run, preference, work, ownership, link, or cloud mutation |
| `W=true`, `A=true`, `L=true`, `M=false`, and (`C=false` or `S=false`) | New compact unavailable surface only | Neither one-time nor ongoing setup is offered. Safety-file save/restore and friendly recovery remain available | Auth plus any read-only current-account preflight exposed by an enabled lower capability; no run, preference, work, ownership, link, or cloud mutation |
| `W=true`, `A=true`, `L=true`, `M=true`, and (`C=false` or `S=false`) | New compact surface only | Degraded one-time online copy is available only for missing, identical, or exact recognized linked rows. Every contested row is unavailable and unselected. Ongoing switch is absent. Confirmation uses the no-preparation variant. `C=true, S=false` remains manual-only and does not select, prepare, rebind, or activate local authority | Read-only auth and manual current-account list/fetch before confirmation; eligible manual mutations only after a locked eligibility recheck, confirmation, and run fencing; contested recheck failure creates no run or mutation; zero local-authority calls |
| `W=true`, `A=true`, `L=true`, `C=true`, `S=true`, `M=false` | New compact surface only | Ongoing setup available. Manual restore/archive actions disabled; safety-file recovery remains | Read-only auth and automatic current-account preflight before confirmation; automatic local/cloud mutations only after confirmation, participation gates, and run fencing |
| `W=true`, `A=true`, `L=true`, `M=true`, `C=true`, `S=true` | Full recommended setup and management | Both one-time and ongoing choices, restore, and recovery | Enabled read-only account/list operations before confirmation; mutations only after the applicable confirmation/action and every lower-service, account, local, and run-fence check |
| `W=true`, lower flag turned off after setup | Compact degraded management, never the old technical panels | Existing local and online evidence remains visible in friendly status; the disabled setup action is unavailable, and restorable safety-file save/import plus diagnostics remain | No calls through the disabled setup capability; local recovery may validate, stage, or restore according to actual current/prior authority and the dedicated recovery policy, never as new setup enrollment |

The capability rows describe an account with no prior completed setup. The
final degraded-management row takes precedence when durable prior evidence
exists, so turning a lower flag off never makes recovery status disappear or
reopens setup as though nothing happened.

When `W=true`, the new surface is always the owner of setup layout even if a lower capability is unavailable. This prevents a runtime flag rollback from bringing the scattered technical panels back. A lower flag disables behavior, not the surface shell.

Clean `.env.example` so every relevant flag appears once and defaults false. It currently repeats auth, cutover, automatic, and manual settings with conflicting later values. Code is default-off when variables are absent, but the sample configuration does not communicate one trustworthy default.

Under effective wizard rendering, hide:

- `DataSafetyBanner`;
- the header `Export All` action;
- the `Full browser recovery` section containing `DeviceRecoveryControls` and `CharacterStorageMigrationControls`;
- `CharacterCloudBackupControls`;
- `CharacterAutomaticSyncControls`.

Keep ordinary `Import`, new character, archive, duplicate, and play actions. Replace the hidden surfaces with `PlayerBackupSummaryCard`; route recovery and management capabilities through the new management view. When `W=false`, do not alter any existing rendering or storage behavior.

## 7. Implementation plan

Every task starts with a focused failing test and records the red result before implementation.

### Task 1: umbrella flag and non-vacuous routing

Files:

- `src/lib/playerBackup/playerBackupFlags.ts`
- `src/lib/playerBackup/__tests__/playerBackupFlags.test.ts`
- `src/app/player/backup/page.tsx`
- `src/app/player/backup/__tests__/page.test.tsx`
- `.env.example`

Red tests:

- absent, `false`, `TRUE`, and `1` do not enable the umbrella;
- exact `true` enables the route;
- direct navigation is 404 when off;
- enabled lower capabilities permit only authenticated current-account reads before confirmation and record zero local or remote mutation calls;
- missing runtime lock keeps permitted reads and recovery available but disables every wizard confirmation and mutation;
- all eight `M`/`C`/`S` combinations have an asserted surface and call policy; specifically `M=false` with either `C=false` or `S=false` is safety-file/recovery only and creates no consent run;
- each lower capability matrix makes zero calls through disabled services;
- repeated sample flags are rejected by a configuration test.

### Task 2: pure copy and status projection

Files:

- `src/lib/playerBackup/playerBackupStatus.ts`
- `src/lib/playerBackup/playerBackupCopy.ts`
- matching tests
- `src/test/helpers.ts`
- `src/test/__tests__/expectPlayerBackupVocabulary.test.ts`

Red tests:

- every state in Section 3 maps to exactly one plain status;
- paused and one-time never collapse to not-backed-up;
- the safety step says the broad file includes current characters only after
  proved parity, and otherwise requests and names the extra recovery file;
- every degraded contested class maps to unavailable, friendly reason/next
  action copy, and an unchecked disabled selection control;
- a stale account token cannot project prior-account rows;
- every raw error/discriminant is mapped, not rendered;
- confirmation copy mentions preparation only when `C` and `S` are enabled and real authority is still legacy; degraded manual-only and already-active states use the no-preparation variants;
- every forbidden term and em dash reddens visible and accessible-name channels.

This task is pure and should land before layout or persistence orchestration.

### Task 3: account-aware read-only preview

Files:

- `src/lib/indexeddb/localDatabase.ts`
- `src/lib/indexeddb/__tests__/localDatabase.test.ts`
- `src/lib/playerBackup/playerBackupCloudPreview.ts`
- `src/lib/playerBackup/__tests__/playerBackupCloudPreview.test.ts`
- `src/lib/playerBackup/playerBackupRunRepository.ts`
- `src/lib/playerBackup/playerBackupCoordinator.ts`
- `src/components/ui/character/PlayerBackupWizard/PlayerBackupWizard.hooks.ts`
- `src/app/account/page.tsx`
- `src/components/auth/AuthPageClient.tsx`
- account and coordinator tests

Red tests:

- opening the route lists only the signed-in account through an enabled read capability and makes no write;
- current-account list/fetch/decode calls are allowed before confirmation through enabled capabilities, while link, run, preference, document, work, ownership, and remote mutation calls remain zero;
- read-only cloud preview does not construct the automatic runtime, open `rollkeeper-local`, or use a mutating service method;
- signed out makes no cloud call;
- account switch clears old rows synchronously, closes/stops the old context, discards stale responses, and performs no adoption;
- `returnTo` accepts only the exact internal backup route and cannot form an open redirect;
- a non-creating existing-database probe returns `null` for an untouched profile, aborts the creation upgrade, and leaves `rollkeeper-local` absent after the request settles;
- an existing compatible database can be read without upgrade, while a present incompatible database is closed and reported without mutation;
- sign-in, sign-out, view, and navigation create no cutover selection, preference, document, pending work, cloud write, or new local database for an untouched control profile.

### Task 4: verified safety-file gate

Files:

- `src/lib/playerBackup/playerBackupSafety.ts`
- `src/lib/deviceRecovery.ts` for shared entry-vector comparison, not a second capture format
- `src/lib/indexeddb/characterCutoverSelection.ts`
- `src/lib/indexeddb/characterCutoverControl.ts`
- `src/lib/indexeddb/characterAuthority.ts` for the extracted read-only
  presence-aware coverage inspector
- `src/lib/indexeddb/characterRecoveryExport.ts` for
  `captureActiveCharacterRecoveryBundle`; retain the existing current-data
  format as diagnostic only
- `src/lib/indexeddb/__tests__/characterAuthority.test.ts`
- `src/lib/indexeddb/__tests__/characterRecoveryExport.test.ts`
- `src/lib/browserRecoveryRepository.ts` only if its public interface needs narrowing
- current recovery/cutover tests plus new coordinator tests

Red tests:

- generated or initiated-only downloads cannot pass;
- wrong file, tampered entry, altered aggregate, wrong run, and source drift cannot pass;
- a matching reselected file creates a verified durable receipt;
- the full fresh entry vector is rechecked before confirmation;
- writing only the exact valid character-selection record does not invalidate readiness;
- changing, adding, or removing any other captured key does invalidate readiness, including another retained-only key;
- malformed, wrong-family, and wrong-namespace selections fail closed; first
  activation also rejects recovery fields that differ from the current receipt,
  while active rebind rejects preserved fields that differ from immutable
  original evidence without comparing them to the new receipt;
- the post-confirmation gate is explicitly reported as protected-source equality, not full aggregate equality;
- no selection, preparation, active pointer, preference, document, or cloud write occurs on every failure;
- a previously verified matching entry vector resumes without another download;
- route view, sign-in, preview, and checkbox changes never retry the character
  mirror journal;
- for active authority, one broad file is accepted as current-character coverage
  only after reopen, exact presence-aware mirror parity, an empty matching
  mirror journal, and stable generation/epoch;
- the explicit save action may retry an existing matching mirror journal once;
  if that establishes parity, the broad file is generated afterward and no
  extra file is required;
- stale mirrors, a retained matching journal, authority drift, or failed retry
  make the restorable active-row bundle mandatory and prevent copy from claiming
  the broad file contains current characters;
- the active-row helper emits `rollkeeper-device-backup` through
  `captureDeviceBackup`, includes every present row from only the verified active
  generation, skips absence rows, and rejects empty, duplicate, malformed, or
  mixed-generation input before serialization. The emitted `DeviceBackupV1`
  carries no source-generation provenance and the importer makes no claim that
  it can reconstruct or validate that provenance;
- the extra bundle must be downloaded, reselected through the existing
  validator, and freshly reproduce its entry vector, manifest, generation, and
  epoch before confirmation; missing, tampered, stale, or mismatched bundles
  create no run or later work;
- broad and conditional current-character receipt identities both survive
  reload and are committed into the consent run without being treated as proof
  of online completion.

### Task 5: durable consent and local preparation

Files:

- `src/lib/playerBackup/playerBackupRunRepository.ts`
- `src/lib/playerBackup/playerBackupRunFence.ts`
- `src/lib/playerBackup/playerBackupActiveSelection.ts`
- `src/lib/playerBackup/__tests__/playerBackupRunRepository.test.ts`
- `src/lib/playerBackup/__tests__/playerBackupRunFence.test.ts`
- `src/lib/playerBackup/__tests__/playerBackupActiveSelection.test.ts`
- `src/lib/playerBackup/playerBackupCoordinator.ts`
- `src/lib/supabase/automaticCharacterSyncPreferences.ts`
- `src/lib/indexeddb/characterCutoverSelection.ts`
- `src/lib/indexeddb/characterAuthority.ts`
- existing character migration/cutover modules only where a reusable public orchestration primitive is missing
- focused Slice 7 and 8 tests

Red tests:

- final confirmation atomically writes the account-scoped run, active-run pointer, selected/cleared preference partition, and future default before any selection or online work;
- transaction abort writes none of those records;
- the run records one-time versus ongoing mode and the exact eligible, selected, and cleared ID snapshots;
- a crash after the transaction but before `selectCharacterCutover` resumes by writing the selection for that same run;
- a crash after selection but before activation resumes only the run's recorded IDs and mode;
- a selection record without a matching committed run cannot authorize wizard upload;
- account B cannot read, continue, or modify account A's run;
- two same-account tabs confirming from the same observed active pointer are serialized; the first commit wins and the second compare-and-replace aborts;
- every run-scoped local work transaction checks `expectedActiveRunId` in the same transaction and writes nothing after pointer replacement;
- a stale tab rechecking immediately before a gateway call makes zero network mutations after another tab commits a newer run;
- the account lock is held through durable acknowledgement, so a newer confirmation cannot replace the pointer during an in-flight request;
- missing exclusive-lock capability fails closed before confirmation or mutation while leaving read-only discovery and recovery downloads available;
- legacy authority uses initial selection/preparation once, while already-active authority never calls `selectCharacterCutover` or activation again;
- first activation validates selection recovery fields against the current
  verified broad receipt and atomically records immutable activation evidence
  with the committed generation/epoch;
- a crash after pointer/evidence commit but before activation fields are written
  can be repaired only by explicit continuation under both locks, using the
  immutable evidence to add those two fields; view/reload does not repair, and
  any other mismatch creates no work;
- already-active rebind verifies the reopened generation/epoch, family rows,
  current-character safety coverage, and immutable original activation
  evidence; it preserves `selectedAt`, recovery fields, `activatedEpoch`, and
  `activatedGeneration`, and changes only run/account/authorization metadata;
- account B's new broad/current-character receipts are validated through B's
  consent run and are never compared to or written over account A's original
  activation recovery fields;
- confirmation leaves the run at `confirmed`; successful activation or verified rebind advances it to `local-ready`, and initial automatic document/work creation is impossible before that checkpoint;
- missing or mismatched activation fields or original activation evidence fail
  closed without rewriting the marker or creating online work;
- account A can complete setup, account B can explicitly confirm and rebind on the same browser, and reload plus switch back to A retain the same valid runtime generation and epoch;
- one final confirmation drives one family-level preparation, never one per character;
- pre-commit failure leaves legacy primary and characters usable;
- activation happens only after verified receipt, unchanged protected source, valid selection record, reopen, parity, empty journal, and no character quarantine;
- response loss/reload resumes idempotently from the committed run, selection, and local authority;
- closing before confirmation writes nothing;
- interrupted confirmed setup presents **Continue setup** and does not advance merely by viewing;
- unrelated RollKeeper keys and all DM-family authority remain byte-identical.

### Task 6: one-time and ongoing online orchestration

Files:

- `src/lib/playerBackup/playerBackupCoordinator.ts`
- `src/lib/playerBackup/playerBackupRunRepository.ts`
- `src/lib/supabase/automaticCharacterSyncPreferences.ts` for `applyConfirmedSelection`, explicit future-default-off records, and a transaction helper used by Task 5
- existing hooks/services only for small reusable API extractions
- coordinator, manual service, preference, and automatic service tests

Red tests:

- all eligible characters are selected by default; cleared characters get explicit off overrides;
- ongoing confirmation overwrites a selected paused character's prior explicit-off row with explicit on, writes every cleared character off, and writes the future default on in the same transaction;
- one-time confirmation writes selected and cleared characters off plus the future default off, then uses only the run's selected IDs for manual verified backup;
- `M=true` with `C=false` or `S=false`, including `C=true, S=false`, uses degraded manual-only copy and makes zero selection, preparation, rebind, activation, automatic-document, or automatic-work calls;
- degraded manual preflight selects only missing, identical, or exact recognized
  linked rows; newer, different, archived, unreadable, unavailable,
  future-format, and otherwise untrusted rows are unavailable and unselected;
- if every degraded character is contested, the page offers retry/recovery but
  no online confirmation;
- degraded confirmation repeats eligibility under the account lock before the
  consent transaction. A row that became contested aborts the whole confirmation
  with zero run, link, pending mutation, gateway call, or preference write and
  requires review rather than silently reducing the selected set;
- a degraded server conflict after consent does not overwrite either copy,
  enter the integrated resolver, or auto-retry. It restores the prior link
  state or removes only the rejected attempt, reports a partial needs-attention
  result, and retains the verified recovery actions; response loss instead
  retains the same mutation identity for acknowledgement checking;
- selected and cleared IDs must be disjoint and exactly partition the confirmed eligible snapshot or the transaction aborts;
- re-reading after commit proves the exact preference partition before any document or pending work is created;
- per-character completion requires refetch and fingerprint/version validation;
- partial failure continues to other selected characters and reports exact results;
- response-loss retry reuses identity;
- initial manual and automatic work carries `originPlayerBackupRunId`; stale-run work is retained but not dispatched;
- later ongoing edits re-read the current per-character preference under the account lock and stop when a newer confirmation clears or pauses that character;
- pause retains acknowledged online data and pending work;
- turning the future default off does not alter existing per-character choices;
- no unselected or other-account character is uploaded or changed.

### Task 7: existing-copy and conflict orchestration

Files:

- `src/lib/playerBackup/playerBackupConflictCoordinator.ts`
- `src/lib/playerBackup/playerBackupCoordinator.ts`
- existing automatic repository/conflict service only for a narrowly required public helper
- focused codec, manual, automatic conflict, worker, and coordinator tests

Red tests:

- identical row attaches/verifies without duplicate upload;
- newer/different/archived/future/unavailable states enter durable conflict or
  recovery handling only in the integrated path; degraded mode excludes them
  before consent;
- a differing manual candidate is preserved through the existing durable conflict path rather than overwritten;
- all three resolutions preserve the losing candidate and match current Slice 9 semantics;
- keep-both copy starts with ongoing backup off;
- one-time mode returns to off only after a verified terminal resolution;
- an archived online row is never resurrected by setup without explicit choice;
- another account’s links, rows, conflicts, and held-aside records are neither rendered nor modified.

### Task 8: wizard route and responsive UI

Files:

- `docs/specs/Rollkeeper Cloud Migration Wizard.zip` as the read-only design
  handoff, specifically `Player Backup Wizard.dc.html`
- `src/app/player/backup/PlayerBackupRoute.tsx`
- `src/components/ui/character/PlayerBackupWizard/index.tsx`
- `PlayerBackupWizard.types.ts`
- `steps/AccountStep.tsx`
- `steps/SafetyFileStep.tsx`
- `steps/CharacterSelectionStep.tsx`
- `steps/ResultStep.tsx`
- component and route tests

Red tests cover every state/copy item, back/close behavior, keyboard operation, focus on new alerts/headings, file-input accessible name, narrow layout without horizontal overflow, and light/dark semantic tokens. Use existing `Dialog`, `Button`, `Checkbox`, `Switch`, `Card`, and `Badge`; do not create new primitives.

Recreate the handoff's 896px desktop dialog, four-row setup rail, character
summary rail, consistent step header, consent card, per-character result list,
conflict choice cards, management grouping, and recovery presentation. Preserve
the information hierarchy and spacing while applying the explicit adaptations
in the design fidelity contract. Add deterministic component fixtures for all
19 prototype wizard scenarios so reviewers can compare every intended state,
not only the successful path.

### Task 9: dashboard replacement and compact management

Files:

- `docs/specs/Rollkeeper Cloud Migration Wizard.zip` as the read-only design
  handoff, specifically `Player Dashboard.dc.html`
- `src/app/player/page.tsx`
- `src/app/player/__tests__/page.test.tsx`
- `src/components/ui/character/PlayerBackupSummaryCard.tsx`
- `src/components/ui/character/PlayerBackupManager.tsx`
- their tests

Red tests:

- wizard on hides all five old backup/setup surfaces and header export in every lower-flag combination;
- wizard off keeps the exact existing surfaces and flags;
- summary is derived after reload and account change;
- status counts distinguish ongoing, one-time, paused, busy, and attention;
- completed setup is compact and does not leave the wizard expanded;
- manage/restore actions remain reachable.

Match the handoff's placement below the dashboard heading, tone-specific icon
container, compact status counts, and primary/secondary action grouping for all
six dashboard scenarios. Preserve the existing real character cards and page
statistics outside this replacement surface.

### Task 10: friendly recovery integration

Files:

- `src/lib/playerBackup/playerBackupRecoveryPolicy.ts`
- `src/lib/deviceRecovery.ts`
- `src/lib/indexeddb/characterRecoveryExport.ts`
- `src/lib/indexeddb/characterRecovery.ts`
- `src/lib/indexeddb/characterCutoverSelection.ts` for the code-generated
  recovered-authority marker, never a marker copied from the file
- `src/lib/indexeddb/__tests__/characterRecoveryExport.test.ts`
- `src/lib/indexeddb/__tests__/characterRecovery.test.ts`
- `e2e-indexeddb/player-backup-current-character-recovery.spec.ts`
- `src/components/ui/feedback/DeviceRecoveryControls.tsx` if the shared safe-by-default restore contract is hardened globally
- `src/components/ui/character/PlayerBackupRecovery.tsx`
- `src/components/PersistenceBootstrap.tsx`
- adapters around `DeviceRecoveryControls` and `CharacterRecoveryExportControls`, or replacements that call the same services
- recovery component and character recovery tests

Red tests:

- before cutover, restore adds only missing allowlisted user-data values and preserves collisions;
- retained-only, unknown, selection, ownership, cloud-link, account, preference, recovery-receipt, and pending-work keys are not preselected and can never be written by generic restore;
- a forged `managed` classification on a control key cannot bypass the code-derived allowlist;
- generic missing-data restore from a post-cutover broad file cannot install a
  character activation or selection marker or change authority initialization;
  only the dedicated staged character restore may create its own marker after
  explicit activation confirmation;
- after cutover, character entries import into an inactive character generation and never merely update a stale mirror;
- the exact conditional file emitted by `captureActiveCharacterRecoveryBundle`
  passes `validateDeviceBackupJson` and stages through
  `importCharacterRecoveryGeneration` without conversion;
- on a fresh origin, opening `/player/backup`, opening recovery, and selecting
  no file leave `rollkeeper-local` absent; invalid JSON/shape, checksum-invalid,
  wrong-aggregate, empty-character, or duplicate-character-key input also leaves
  it absent;
- after in-memory validation, the explicit recovery import may create
  `rollkeeper-local` and an inactive generation even though no online-backup
  confirmation exists. That creation writes no player-backup run, preference,
  active pointer, selection marker, account link, online work, or network call;
- invalid JSON/shape, per-entry checksum, aggregate, empty-character, and
  duplicate-character-key bundles are rejected before database creation,
  inactive rows, or a recovery record. Do not claim the importer can detect
  source-generation mixing because `DeviceBackupV1` carries no generation
  provenance; generation purity is enforced and tested only by the active-row
  capture helper before serialization;
- a structurally and cryptographically valid bundle containing a malformed or
  future-version character envelope creates/stages an inactive recovery
  generation, retains the exact raw value and quarantine evidence, cannot
  activate, and leaves the active pointer, runtime, compatibility values, and
  generated selection marker unchanged;
- importing alone changes no pointer, runtime, compatibility value, generated
  selection marker, account link, preference, or online work;
- on a truly empty profile, explicit activation of the inactive generation
  commits a new pointer/epoch and recovery evidence, writes a semantic marker
  from the verified file rather than importing one, then survives close/reopen
  and restores every character ID and content hash from the exact downloaded
  bytes;
- the generated recovery marker contains no account/run authorization, creates
  no online work, and can authorize a later rebind only after a fresh wizard
  consent run validates its immutable activation evidence;
- a valid active pointer whose generation rows are missing is corruption, not an
  empty profile, and fails closed;
- existing identical data may activate the imported generation, while any
  divergent active or legacy value remains preserved with the imported candidate
  in recovery required;
- a crash after recovery pointer/evidence commit but before the generated marker
  is repaired only by explicit continuation from immutable evidence; reload
  alone does not invent or replace the marker;
- with legacy authority and the local transition capability unavailable, the
  same exact validated file restores only missing allowlisted character keys,
  preserves collisions, reloads, and verifies the restored ID/content hashes;
- the IndexedDB browser test downloads the conditional file from an active
  profile with a deliberately stale mirror, retains those exact bytes, removes
  the local profile data, uploads that same file through the recovery UI,
  explicitly activates the staged generation, reloads, and proves the original
  character ID/content hashes are restored from the reopened authority;
- divergent active/imported data enters recovery required with both candidates retained;
- rollback remains parity/reopen/journal gated;
- the restorable current-character file and original diagnostic downloads
  remain reachable in fail-closed state, and diagnostics are never labeled as
  restorable;
- wizard-on recovery copy passes the strict vocabulary guard;
- wizard-off legacy recovery rendering remains compatible.

### Task 11: regression gates and manual acceptance preparation

Files:

- `config/vitest/playerBackupWizard.config.ts`
- `package.json`
- `.github/workflows/ci.yml` if the focused gate belongs in CI
- `.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`
- fake seed script only if additional deterministic player conflict fixtures are required

Add focused coverage thresholds for destructive/account-routing branches. Update the manual checklist with a player-wizard section; do not replace the existing DM checklist.

## 8. Verification plan

### Focused automated checks

- New player wizard flag, route, pure status/copy, coordinator, conflict, component, dashboard, management, and recovery tests.
- Existing `DataSafetyBanner`, `DeviceRecoveryControls`, `CharacterStorageMigrationControls`, cloud controls, automatic controls, and both hooks under flag-off compatibility.
- `deviceRecovery`, `browserRecoveryRepository`, all character cutover/bootstrap/authority/recovery tests, manual cloud service/gateway/codec/link tests, automatic repository/preferences/service/worker/puller/coordinator/runtime/conflict tests, and `playerStore` recovery application tests.
- The IndexedDB browser suite must retain the exact conditional download bytes,
  restore them after total local character loss, close/reopen, and compare visible
  characters plus durable IDs/content hashes. A regenerated equivalent fixture
  is not acceptable evidence for this test.
- Crash-boundary tests for the consent transaction, selection write, preparation, activation, first manual link, first automatic document/work item, and final acknowledgement.
- Adversarial recovery tests for forged classifications and every registered control-key prefix, plus preference-partition tests that start with a previously paused selected character.
- Mutation-resistant vocabulary-helper tests and rendered checks for every wizard/management/error state.
- Component checks at narrow and desktop sizes, light and dark themes, tab/shift-tab order, Enter/Space activation, Escape/close behavior, focus restoration, live-region roles, and complete accessible names.

### Design fidelity review

Before the final browser gate, open the player prototype files from the design
archive and compare them against deterministic production component fixtures.
Cover all 19 wizard prototype scenarios and all six dashboard scenarios. At a
minimum, capture desktop comparisons for every scenario and 390 px comparisons
for account, safety-file pending and mismatch, selection, partial result,
conflict, management, recovery, dashboard not-started, and dashboard ongoing.

The review checks hierarchy, spacing, widths, typography, icon sizing, badges,
status tones, action grouping, selected and disabled rows, and the compact
completed state. Repeat representative fixtures in dark and parchment themes
to verify the semantic-token adaptation. The prototype's design-state strip,
hard-coded colors, file metrics, and synthetic data are excluded by design.
Record every other intentional difference with its safety, accessibility, or
responsive reason. Do not call the design matched based only on component tests
or on the archive thumbnail.

### Existing Slice 7, 8, and 9 contracts

Run and record separately:

```text
npm test -- src/lib/indexeddb/__tests__/persistenceBootstrap.test.ts src/lib/indexeddb/__tests__/migrationEngine.test.ts src/lib/indexeddb/__tests__/migrationCapture.test.ts src/lib/indexeddb/__tests__/migrationValidation.test.ts
npm run test:slice8:coverage
npm run test:slice9:coverage
npm run test:indexeddb:e2e
npm run test:automatic-sync:e2e
```

The first command is the focused Slice 7 floor because the repository has no dedicated Slice 7 script. Do not call that path passed until it has actually run.

### Full regression gates

```text
npm test
npm run test:visual
npm run test:e2e
npm run test:auth:e2e
npm run type-check
npm run lint:ci
npm run format:ci
npm run build
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
npm run test:db:replay
npm run test:db:integration
npm run test:auth:integration
```

Run database gates because the wizard reuses security-sensitive character RPCs even though no SQL change is planned. Treat environment-blocked checks as blocked, not passed. Separate automated evidence from manual-browser evidence.

### Final interactive browser gate

After all automated checks pass, use `.agents/skills/rollkeeper-manual-browser/SKILL.md` through the Codex desktop in-app Browser only. If the desktop Browser is unavailable, the verdict is **blocked**. Standalone Playwright is supplemental and cannot satisfy this gate.

Use an ephemeral local server, local fake auth/cloud services, deterministic synthetic data, and new host-isolated origins. Suggested origins:

- `rk-player-control.localhost`: umbrella off, every lower flag on, proving a non-vacuous legacy control.
- `rk-player-a.localhost`: participating account A and the main setup.
- `rk-player-b.localhost`: identical starting profile and account B/account-switch isolation.
- `rk-player-conflict.localhost`: independent same-account changes for conflict paths.
- `rk-player-race.localhost`: same-account, two-tab confirmation and stale-run fencing.
- `rk-player-degraded.localhost`: sequential unavailable and manual-only lower-flag profiles.

Required scenarios:

1. Generate the skill seed, create the synthetic character through visible UI, add the emitted unrelated entries, and prove identical raw-pair counts, UTF-8 bytes, and hashes across starting origins.
2. On the control origin, prove no wizard launcher, direct route absence, legacy panels still present according to lower flags, no new player-wizard record, no cutover selection/database, and no character cloud write from view, sign-in, sign-out, reload, or navigation. On an untouched wizard-on origin, inspect before and after route view and prove the non-creating probe leaves `rollkeeper-local` absent.
3. On A, open through the visible launcher; verify signed-out and sign-in return behavior. Prove sign-in itself writes no character/storage selection. With enabled lower capabilities, observe the current-account list/fetch reads needed for character statuses and prove there are still zero link, run, preference, work, ownership, upload, update, archive, or restore mutations.
4. Before activation, download the safety file through visible controls, independently parse it, and verify format/version, every entry byte count/hash, aggregate hash, and expected character/unrelated entries. Prove download initiation alone cannot continue. Reselect it and prove the verified receipt before any local ownership change. Change one unrelated key and prove confirmation fails against the full entry vector.
5. Cancel before final confirmation and prove zero consent run, selection, active pointer, preference, document, pending work, or cloud write. Reload and confirm safe resume.
6. Run the default all-character ongoing flow with one selected character previously paused. Observe the exact confirmation, then prove the consent run, selected-on/cleared-off partition, and future-default-on record committed together before selection. Prove only the exact semantically valid character-selection key differs from the safety file at the activation gate and every other captured key still matches. Then prove local activation and a validated online acknowledgement. A success message is insufficient: refetch the row and compare identity, server version, and content fingerprint.
7. Reload, navigate away/back, open a second same-origin tab, and prove the compact dashboard summary derives from durable state and edits remain acknowledged before their online status changes.
8. Exercise one-time mode with one character cleared. After the consent transaction and cutover selection are durable but before the first manual link, stop and reload. Prove resume uses the recorded one-time mode and exact selected/cleared IDs, uploads no cleared character, writes selected and cleared preferences plus future default off, and does not fall back to “select all.” Prove later edits do not create new cloud work. Then use **Back up now** and verify the new acknowledged version.
9. Go offline after a confirmed edit. Prove local acknowledgement and retained pending work, reload offline, restore connectivity, retry/resume, and validate the eventual row. Inject committed-response loss and prove the same mutation identity is retried.
10. Use two same-account isolated origins to create a conflict. Exercise **Keep my changes**, **Use online version**, and **Keep both** from fresh deterministic resets. Prove neither candidate disappears, discarded candidates are retained, and the keep-both character starts with online backup off.
11. Inject future-format online data. Prove active local data remains, recovery download contains the exact raw candidate, and no forbidden implementation term appears.
12. Switch from account A to B with A's run unfinished. Prove A’s run, rows, and statuses disappear immediately, B cannot read/continue/adopt/modify them, and zero B write occurs until a new explicit confirmation. Switch back and verify A’s exact recorded scope returns.
13. Pause and resume one character, turn the future default off/on, and soft-remove an online copy. Prove pausing deletes nothing and soft removal changes no local character.
14. Restore an absent character, restore a collision as another character, and import a safety file before and after cutover. Include a post-cutover file with character selection/activation, cloud-link, and unknown retained-only records plus forged `managed` classifications. Prove none of those control records is selectable or written into a fresh profile, authority stays on the fresh profile's valid path, and active character entries use the dedicated inactive-generation import. Submit invalid JSON/shape and bad checksum/aggregate files and prove the local database remains absent. Then submit a checksum-valid bundle containing malformed and future-version character envelopes; prove their exact raw values and quarantine evidence are staged inactive while activation and the active pointer remain unchanged. Exercise recovery-required exports and a successful parity-gated rollback. Validate downloaded artifacts independently.
15. Compare unrelated DM, encounter, NPC, calendar, location, battle-map, combat-log, magic-item, canvas, theme, and sentinel raw hashes at the end. They must remain byte-identical except for an explicitly exercised recovery action targeting that key.
16. Check 390 px and desktop layouts, light and dark themes, keyboard-only completion, focus after step changes/errors, accessible names, live regions, and no horizontal overflow.
17. On the race origin, open two tabs under the same account and let both observe the same active-run pointer. Confirm different selections as close together as the harness permits. Prove only one compare-and-replace commit wins, the stale tab creates no local work and makes no network mutation, and its UI reloads the winning run. Hold one fake gateway response open and prove another confirmation waits for the account lock until acknowledgement is durable. In the injected no-lock fixture, prove confirmation fails closed while read-only status and safety-file recovery remain usable.
18. On the degraded origin, exercise the three `M=false` combinations where `C=false` or `S=false` and prove the surface offers only safety-file/recovery actions with zero consent or backup mutation. Then use `M=true, C=true, S=false`; inject missing, identical, exact recognized linked, newer, different, archived, unreadable, unavailable, and future-format rows. Prove only the first three safe classes are selected, every other class is unavailable with its friendly next action, and an all-contested roster has no confirmation. Change a selected row to contested during the locked recheck and prove zero run, preference, link, pending mutation, or gateway call. Separately change the server row after consent and return an explicit conflict; prove neither copy is overwritten, the integrated resolver and automatic retry remain absent, only the rejected attempt is cleared, and recovery guidance is shown. Complete a clean eligible manual copy and prove it changes no selection or active-authority field and creates no automatic document/work.
19. During account A's first activation, prove its selection recovery fields match A's verified safety receipt and immutable activation evidence is committed with the active generation/epoch. Then force a character save whose compatibility mirror remains stale and whose mirror retry continues to fail. Open the wizard and prove route view does not retry it, the broad file is not described as containing current characters, and confirmation requires both a reselected broad file and a reselected current-character bundle. Independently prove the extra file is a valid `rollkeeper-device-backup` built from the active generation rather than the stale mirror, then alter it and prove zero run. Restore exact bytes and explicitly confirm full-capability setup as account B with the newly saved files. Prove rebind validates A's original selection fields against A's activation evidence, validates B's new files through B's consent run, preserves the original selection/recovery/epoch/generation fields, updates only B's run/account/authorization fields, survives reload, and still initializes the same authority after switching back to A and reloading. Inject a mismatched or missing activation-evidence record and prove fail-closed recovery with zero online work. In a new isolated recovery profile, prove route view and opening recovery leave `rollkeeper-local` absent; submit a damaged file and prove it remains absent. Then explicitly import the exact extra file captured from A and prove the database is created with only inactive recovery state and no setup run, preference, pointer, marker, online work, or network call. Confirm restore, close/reopen, and prove the restored character IDs/content hashes match the downloaded entries and visible characters. Repeat with divergent local data and prove both candidates remain while authority does not switch. Finally allow mirror retry to succeed, save again, and prove exact parity plus an empty matching journal permits one broad file generated after reconciliation.

Report branch, commit, exact local flags, port, origin labels, seed version, counts/bytes/abbreviated hashes, visible actions, durable evidence, reload/multi-tab results, failure paths, artifact verification, automation, limitations, and an explicit pass/fail/blocked verdict. Do not print raw payloads or secrets.

## 9. Risks, unresolved decisions, and non-goals

### Material risks and mitigations

1. **The current cutover gate is both too weak and self-invalidating.** It accepts an initiated receipt, then its own selection write changes the broad aggregate it compares. Require a verified receipt, exact full-vector equality before confirmation, and the narrowly excluded but semantically validated selection record afterward. This is the largest safety risk.
2. **Consent and cutover live in different storage transactions.** A cross-storage atomic commit is unavailable. Commit the account-scoped run and complete preferences first, treat a selection without that run as unauthorized, and make every later step idempotent from the run. Crash-boundary tests are mandatory.
3. **An in-memory token cannot fence another tab.** Use compare-and-replace on the active-run pointer inside every run-scoped local transaction and the same account lock for confirmation and gateway mutation. Hold it through acknowledgement; fail closed when unavailable.
4. **Ordinary resume discovery can accidentally create the database it is looking for.** Use the abort-on-create existing-database probe and verify absence after passive view. The creating opener is allowed only at one of two explicit, separately tested boundaries: final online-backup confirmation for setup, or a validated recovery import for inactive staging. The recovery boundary grants no setup consent or activation.
5. **Generic recovery currently trusts an over-broad selected key set.** A retained selection or cloud-link key can be written into a profile where its dependent database state does not exist. Make restore code-allowlisted and route active character data through its dedicated recovery path; never trust file classification.
6. **Existing account enable preserves prior explicit off.** That is correct for its original semantics but wrong after the player explicitly reselects a paused character. The wizard must use the atomic confirmed-selection operation and verify the resulting partition before work begins.
7. **Initial selection overwrites active bootstrap metadata.** Never reuse `selectCharacterCutover` for an active family. Verify the reopened authority under both locks and rebind only backup authorization metadata while preserving the startup-critical generation and epoch.
8. **Two online mechanisms can disagree in presentation.** Manual links and automatic documents can describe the same server row. A single status projector must correlate them by account and legacy character ID and must prefer validated durable/server facts over the last UI action.
9. **One-time conflict resolution has no current friendly orchestrator.** The manual service fails closed, but the durable three-way resolver lives in Slice 9. The proposed conflict coordinator must reuse that resolver; a bespoke last-write-wins path is unacceptable.
10. **Recovery differs before and after character cutover.** Generic safety-file restore may write only allowlisted browser values, while active character recovery must import an inactive character generation. The manager must route by actual authority and never treat a mirror write as active recovery.
11. **Account switches race asynchronous reads.** Token every request and recheck account identity immediately before writes. Clear old-account render state synchronously.
12. **The broad safety file contains more than characters.** State this plainly and tell the player to keep it private. Only selected characters go online.
13. **Current `.env.example` is contradictory.** Duplicate later values can undermine default-off rollout expectations. Normalize it as part of the flag task.
14. **Authorized retry can be mistaken for implicit upload.** Tests must distinguish a first enrollment caused by view/navigation, which is forbidden, from resuming work the player already confirmed, which is required for ongoing backup.
15. **Raw lower-layer errors contain forbidden language.** All error channels need closed mappings, including DOM exceptions, auth errors, gateway errors, recovery errors, and conflict reasons.
16. **Prototype fidelity can drift during safety integration.** Keep the archive read-only, build deterministic fixtures for its full state list, and require the explicit design comparison above. Safety, accessibility, responsive behavior, and the approved copy deck are the only pre-approved reasons to diverge.
17. **An active character can be newer than its compatibility mirror.** Never
    claim the broad browser file contains current characters based only on the
    presence of mirror keys. Require reopened, presence-aware parity and an
    empty matching mirror journal, or a separately downloaded and verified
    restorable active-row bundle with a fresh matching projection.
18. **Rebinding can conflate old activation recovery with new account consent.**
    First activation records immutable evidence for its original selection and
    recovery fields. Rebind validates and preserves that evidence while the new
    run independently owns its new safety receipts.
19. **Degraded manual setup cannot preserve both sides of a conflict.** Exclude
    contested rows before consent, explain why they need review, and repeat the
    classification under the account lock. Never let the generic manual error
    become an attempted conflict resolution.
20. **A verified download is not a recovery guarantee unless its exact format
    can be restored.** Generate the conditional character file as
    `DeviceBackupV1` from active rows, use the existing validated inactive import,
    add explicit empty-profile activation and marker/reopen verification, and
    prove the same downloaded bytes restore the characters after local loss.

### Resolved defaults, not blockers

- Broad safety file as the baseline. After activation it is sufficient for
  current characters only with proved parity and an empty matching mirror
  journal; otherwise also require a restorable active-row bundle in the existing
  browser-backup format.
- All eligible active and archived characters selected by default.
- Ongoing backup recommended and on by default; one-time copy remains an explicit alternative.
- With `C` and `S` enabled, either setup mode prepares legacy authority once; already-active authority uses verified rebind. With `S` disabled, `C` alone never triggers preparation.
- With `M=false` and either `C=false` or `S=false`, online setup is unavailable and the surface is safety-file/recovery only.
- In degraded manual mode, contested characters are unavailable and unselected;
  only missing, identical, or exact recognized linked rows are eligible.
- Selection and confirmation share one screen.
- Dedicated `/player/backup` route.
- Compact dashboard status after completion.
- Soft archive only for **Remove online copy**.
- No server or SQL work unless a failing test proves a gap.

There is no product decision that must block implementation. If the product owner wants one-time copy to be the default instead of ongoing backup, that is a deliberate policy reversal and should be decided before Task 6, but the recommendation is ongoing by default.

### Non-goals

- Player inbox, deliveries, campaign membership adoption, or guest-to-account linking.
- DM locations, battle maps, campaign sections, or DM wizard changes beyond reusable patterns/checklist additions.
- New cloud tables, RPCs, or hard deletion.
- Moving image data to another object store.
- General local cleanup or recovery-history deletion.
- Replacing current character creation/import/archive/play flows.

## 10. Acceptance criteria

### Product outcomes

- With the umbrella flag on, `/player` has one obvious setup action and none of the five old setup/backup surfaces or header `Export All` action.
- The dashboard card, setup wizard, result, management, conflict, and recovery surfaces visibly follow the two player prototypes in `docs/specs/Rollkeeper Cloud Migration Wizard.zip`; every non-pre-approved difference is documented in the implementation PR.
- Prototype-only scenario controls, inline runtime, bundled fonts, literal colors, file metrics, and synthetic characters do not ship.
- With the umbrella flag off, existing behavior and lower-flag rendering are unchanged.
- Every `M`/`C`/`S` combination has deterministic rendering and call permissions. When `M=false` and either `C=false` or `S=false`, online setup is unavailable and only safety-file/recovery actions are offered.
- The player can sign in, return to the backup route, save and reselect every
  required recovery file, choose characters, choose ongoing or one-time
  behavior, explicitly confirm, and receive a verified per-character result.
- All eligible active and archived characters start selected; cleared and
  degraded-contested characters remain untouched.
- Ongoing setup applies one account default for new characters, explicit on for every selected character including a previously paused one, and explicit off for every cleared character.
- After completion, the dashboard shows compact, truthful counts and management/restore entry points rather than the expanded wizard.
- Every rendered wizard, summary, management, recovery, error, accessible name, placeholder, title, and alt string passes the strict vocabulary and no-em-dash guard.

### Consent and no-surprise outcomes

- Viewing, signing in, signing out, navigating, opening, closing, or reloading cannot enroll a new character, select character cutover, create first-upload work, or change local ownership.
- Before confirmation, enabled capabilities may perform authenticated current-account list/fetch/decode reads needed to describe existing online copies, but they produce no local or remote mutation.
- Viewing, opening recovery, or probing for a resumable run on an untouched
  profile leaves `rollkeeper-local` absent. Final online-backup confirmation may
  create it for setup. Separately, an explicit recovery import may create it
  after the selected file passes in-memory validation, solely to stage an
  inactive recovery generation; that exception creates no setup consent,
  activation, or online work.
- No online write begins until the final account/count/consequence confirmation.
- Confirmation mentions preparing character saving only when `C` and `S` are enabled and real authority is still legacy. Manual-only and already-active flows promise no preparation they will not perform.
- Final confirmation atomically commits an account-scoped consent run, exact eligible/selected/cleared ID snapshots, mode, every required safety identity, all per-character preferences, and future default before cutover selection or online work.
- A crash after confirmation resumes only that run's account, selected IDs, cleared IDs, and one-time/ongoing mode. It never reconstructs consent from current defaults or “select all.”
- Download initiation cannot unlock local transition. Every required exact file
  must be reselected and verified. Active authority additionally requires either
  fresh mirror parity with an empty matching journal or a fresh matching
  restorable active-row bundle.
- Switching accounts invalidates the preview and confirmation. The new account requires a fresh account check and confirmation.
- No unselected character is uploaded or modified; no other-account row is rendered, adopted, or modified.

### Durability and recovery outcomes

- A character is labeled protected only after a refetched, decoded, identity/version-checked, fingerprint-matching online row exists.
- Local save success remains tied to the active durable write or journal outcome, not an HTTP response or toast.
- Failure before active-pointer commit leaves the old local path primary. Failure after commit never silently falls back.
- The expected character-selection write cannot invalidate its own activation
  gate. Every other captured key must remain byte-identical. On first activation
  the excluded selection record matches the current run and verified broad
  receipt; on rebind its original recovery/activation fields match immutable
  original evidence while only its authorization fields match the new run.
- `C=true, S=false` remains manual-only: successful one-time backup performs no select, prepare, rebind, activate, automatic-document, or automatic-work operation.
- A new confirmed account/run over already-active authority uses verified rebind, never initial selection. It validates immutable original activation evidence, validates the new safety files through the new consent run, and preserves the original selection, recovery, generation, and epoch fields across reload and account switch-back.
- A broad post-activation file is never represented as containing current
  characters unless exact mirror parity and an empty matching mirror journal
  were proved after reopen. Otherwise a verified restorable active-row bundle
  is required and independently matches a fresh authoritative projection.
- Committed preferences cannot create initial automatic documents or work until activation or verified rebind advances that same run from `confirmed` to `local-ready`.
- Existing local character data, compatibility mirrors, immutable captures, recovery files, conflicts, held-aside data, pending work, and tombstones remain recoverable.
- Safety-file import before and after cutover targets the correct recovery path and never silently overwrites a divergent active character.
- Generic safety-file restore derives eligibility from a code-owned key allowlist. It never writes selection, activation, ownership, cloud-link, account, preference, receipt, pending-work, retained-only, or unknown control records, even if the file labels one as managed.
- Generic import of a post-cutover broad file into a fresh profile cannot alter
  authority initialization. Dedicated character recovery always stages an
  inactive generation first and may create only a code-generated marker after a
  separate explicit activation confirmation.
- The conditional current-character file uses the existing validated
  browser-backup format. Its exact downloaded bytes can stage an inactive
  generation and, after explicit confirmation on an empty profile, restore the
  characters across close/reopen with matching IDs and content hashes.
- Importing that file alone never changes active data. Divergent or corrupt
  current state remains fail-closed with both candidates retained.
- Structurally or cryptographically invalid character bundles are rejected
  before database creation or staging. A valid bundle with malformed or
  future-version character data is instead retained as quarantined inactive
  evidence, cannot activate, and leaves the active pointer unchanged.
- Rollback is reachable and succeeds only after parity, reopen, and empty-journal proof.

### Cloud and conflict outcomes

- Identical existing online copies are recognized without duplication.
- Newer, different, archived, unavailable, and future-format online copies produce distinct friendly states and never trigger silent overwrite or resurrection.
- In degraded manual mode those contested states are unavailable and unselected.
  If any selected row becomes contested during the locked pre-confirmation
  recheck, confirmation creates no run, preference, link, pending mutation, or
  gateway call.
- A degraded post-consent server conflict overwrites neither copy, does not
  enter the integrated resolver or auto-retry, and reports a partial
  needs-attention result with recovery actions. Only response loss retains the
  mutation identity for acknowledgement retry.
- All three conflict choices preserve the losing candidate and retain current Slice 9 semantics.
- One conflicted or failed character does not stop unrelated selected characters. Final results report partial success exactly.
- Offline work, expired auth, response loss, crash/reload, and retry retain their identity and recover without duplicate accepted writes.
- Same-account concurrent confirmations are compare-and-replace fenced. A stale tab cannot create work or make a gateway mutation after a newer active run commits.
- Confirmation and gateway mutations use the same account-scoped exclusive lock and transactional `expectedActiveRunId` checks. Without that lock capability, wizard mutations fail closed.
- Pausing ongoing backup deletes neither local nor online data. Removing an online copy is a separate explicit soft archive.

### Isolation and regression outcomes

- Character setup changes no DM-family authority or unrelated RollKeeper raw value.
- Account A and B consent runs, preferences, documents, pending work, conflicts, links, rows, and held-aside records remain isolated across switches.
- Slice 7, Slice 8, Slice 9, full unit, IndexedDB browser, automatic browser, auth browser, visual, production build, lint/format/type, and database regression gates pass or are reported honestly as blocked/failed.
- The final Codex desktop in-app Browser gate passes on isolated origins with deterministic fake data, or the PR remains blocked and is not called ready.
