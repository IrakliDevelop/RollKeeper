# Persistence & Storage Migration (localStorage → IndexedDB)

This is the least obvious, highest-blast-radius subsystem in the codebase.
RollKeeper is migrating its canonical local storage from plain
`localStorage`-backed Zustand `persist` to IndexedDB, per data domain, rolled
out in flag-gated slices. If you're touching character, encounter, NPC,
calendar, magic-item, campaign-settings, or combat-log-archive persistence,
read this file first — a naive edit can desync the migration state.

## Why this exists

`localStorage` is synchronous, size-limited, and gives no transactional
guarantees across tabs. The IndexedDB layer adds: per-domain "authorities"
(source of truth resolution), migration engines with rollback, cross-tab
locking, and shadow-write verification before a domain is allowed to cut over.

## Where it lives

`src/lib/indexeddb/` — one authority/migration/repository/selection set **per
domain**: `calendar`, `campaignSettings`, `character`, `combatLogArchive`,
`encounter`, `magicItem`. Plus generic machinery:

- `localDatabase.ts` — the actual IndexedDB wrapper
- `migrationEngine.ts` / `migrationLock.ts` / `migrationRecovery.ts` /
  `migrationValidation.ts` / `migrationCapture.ts` / `migrationState.ts` —
  generic migration orchestration, reused by every domain
- `shadowJournal.ts` — records writes during the shadow (dual-write,
  not-yet-authoritative) phase so they can be replayed/verified
- `characterCutoverControl.ts` / `characterCutoverSelection.ts` — decides
  whether *this* browser/user has been cut over to IndexedDB-as-canonical for
  characters
- `characterCandidateArbitration.ts` / `characterCandidatePreview.ts` — when
  local and remote candidates disagree during cutover, arbitrates which wins
  and previews the choice to the user
- `characterBootstrapRouting.ts` — routes a freshly-loaded character to the
  correct storage backend depending on cutover state
- `characterStaleMirror.ts` — detects a stale localStorage mirror after
  cutover
- `browserShadowWriter.ts` — writes to both backends during the shadow phase
- `automaticCharacterConflictService.ts` / `automaticCharacterSyncRepository.ts`
  — conflict handling for the background Supabase auto-sync (see
  [05](05-cloud-backend-supabase.md)), layered on top of this same local store
- `dmWorkspaceRepository.ts` — DM-side equivalent
- `persistenceBootstrap.ts` — app-startup wiring that decides what backs what

## How `characterStore` / `playerStore` plug in

`characterStore.ts` calls `isBrowserCharacterCutoverParticipant`,
`createPerCharacterStorage`, and `armCanonicalPersistence` to decide, per
character, whether its canonical store is localStorage or IndexedDB, and
tracks watermarks to detect divergence. `playerStore.ts` uses
`createCharacterFamilyStateStorage` for the roster-level equivalent, plus
`initCrossTabRosterSync` (`src/lib/crossTabRosterSync.ts`) so multiple open
tabs agree on roster state without both writing at once.

Related cross-tab primitives: `src/lib/crossTabCharacterSync.ts`,
`src/lib/crossTabEncounterSync.ts`, `src/lib/characterWriterLock.ts`,
`src/lib/characterIntentBus.ts`, `src/lib/characterRevision.ts`,
`src/lib/characterFreshness.ts` — together implementing a single-writer
cross-tab protocol: one tab holds the write lock, others send "intents" that
get applied and re-broadcast as revisioned "envelopes." This protocol also
underlies the character-revision system referenced in commit history as
"single-writer cross-tab sync" (superseding an earlier last-write-wins
approach). If you add a new store action that mutates character/encounter
state, it likely needs to be classified for this protocol via
`characterActionClassification.ts` — don't assume a plain Zustand `set()` is
sufficient.

## User-facing surfaces

`src/components/ui/feedback/`: `CharacterStorageMigrationControls.tsx`,
`CharacterRecoveryExportControls.tsx`, `DataSafetyBanner.tsx`,
`DeviceRecoveryControls.tsx` — these are migration/recovery UI, not generic
feedback primitives, despite living in `ui/feedback/`.

## Rule of thumb before editing anything here

1. Check `src/lib/durableDm/*Flags.ts` and any character-cutover flag for
   current rollout state — don't assume a domain has cut over just because
   the code path exists (see [13](13-feature-flags-and-gated-work.md)).
2. Prefer adding to an existing domain's authority/repository/migration
   trio over inventing a new pattern — the shape is deliberately uniform
   across `calendar`/`campaignSettings`/`character`/`combatLogArchive`/
   `encounter`/`magicItem`.
3. There is a dedicated nightly Playwright drill for this
   (`test:reconnect:nightly`, `test:checkpoint-matrix:nightly`,
   `test:rollback:drill`) — see [10-testing.md](10-testing.md). Don't consider
   a storage-layer change verified without running the relevant one.
