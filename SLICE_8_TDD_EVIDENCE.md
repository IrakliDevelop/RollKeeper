# Slice 8 red-green TDD evidence

Date: 2026-08-16

Slice 8 behavior was introduced through focused red-green-refactor cycles. The
commands below were run before the corresponding production modules existed or
before the relevant branch was implemented. Each red phase failed for the
intended missing behavior; no deliberately failing test is retained.

| Contract | Red command | Intended failure observed |
|---|---|---|
| Explicit per-profile selection, atomic family filtering, and candidate arbitration | `npm test -- src/lib/indexeddb/__tests__/characterCutoverSelection.test.ts src/lib/indexeddb/__tests__/characterFamily.test.ts src/lib/indexeddb/__tests__/characterCandidateArbitration.test.ts` | Vite could not resolve the three not-yet-created Slice 8 modules. |
| Scoped pointer/epoch commit, active writes, mirror journal, stale epochs, and parity rollback | `npm test -- src/lib/indexeddb/__tests__/characterAuthority.test.ts` | Vite could not resolve the not-yet-created `characterAuthority` module. |
| Character-family-only Slice 7 preparation | `npm test -- src/lib/indexeddb/__tests__/characterMigrationEngine.test.ts` | Vite could not resolve the not-yet-created character migration wrapper. |
| Non-participant legacy routing and active durability acknowledgement | `npm test -- src/lib/indexeddb/__tests__/characterPersistenceRuntime.test.ts` | Vite could not resolve the not-yet-created persistence runtime router. |
| Full pre-cutover evidence inspection and immediate confirmation | `npm test -- src/lib/indexeddb/__tests__/characterCutoverControl.test.ts` | Vite could not resolve the not-yet-created cutover controller. |
| Default-off migration controls and mandatory preview | `npm test -- src/components/ui/feedback/__tests__/CharacterStorageMigrationControls.test.tsx` | Vite could not resolve the not-yet-created migration-controls component. |
| Slice 8 authority state and rollback transitions | `npm test -- src/lib/indexeddb/__tests__/migrationState.test.ts` | The expected `IDB_PRIMARY` state was absent from the Slice 7 state machine. |
| Inactive recovery import, conflict preservation, and explicit recovery activation | `npm test -- src/lib/indexeddb/__tests__/characterRecovery.test.ts` | Vite could not resolve the not-yet-created character recovery module. |
| Late localStorage-only stale-tab conflicts and mirror repair | `npm test -- src/lib/indexeddb/__tests__/characterStaleMirror.test.ts` | Vite could not resolve the not-yet-created stale-mirror reconciler. |
| Equal-stamp divergent legacy candidates block readiness | `npm test -- src/lib/indexeddb/__tests__/characterMigrationEngine.test.ts` | The migration incorrectly returned `CUTOVER_READY` instead of preserving a conflict and returning `SHADOWING`. |
| Focused per-file coverage ratchet | `npm run test:slice8:coverage` | The first run failed the 90% statement/function and 85% branch thresholds, identifying untested bootstrap, browser-event, recovery, and rejection paths. |
| Rollback close/reopen verification uses the exact active generation and epoch | `npm test -- src/lib/indexeddb/__tests__/characterAuthority.test.ts` | The focused test failed because `verifyCharacterRollbackGenerationAfterReopen` did not exist. |
| A known-activated profile never falls back when IndexedDB cannot open | `npm test -- src/lib/indexeddb/__tests__/characterPersistenceBootstrap.test.ts` | The bootstrap rejected with `InvalidStateError` instead of resolving `RECOVERY_REQUIRED` with IndexedDB authority. |
| Slice 8 routing preserves the disabled-by-default Slice 7 bootstrap when its independent flag is explicitly enabled | `npm test -- src/lib/indexeddb/__tests__/characterBootstrapRouting.test.ts` | Vite could not resolve the not-yet-created bootstrap routing module. |
| Active hydration reads IndexedDB rather than a stale compatibility mirror | `npm test -- src/lib/indexeddb/__tests__/characterPersistenceRuntime.test.ts` | The active adapter returned the synchronous `stale-localstorage` value instead of an authoritative IndexedDB promise. |
| Recovery activation retries are idempotent | `npm test -- src/lib/indexeddb/__tests__/characterRecovery.test.ts` | A retry incorrectly advanced the cutover epoch from 2 to 3 and changed the committed timestamp. |
| Pointer commit atomically rechecks late journal work | `npm test -- src/lib/indexeddb/__tests__/characterAuthority.test.ts` | Cutover incorrectly committed despite a scoped late-write journal row. |
| Current-tab writes queue across the final authority decision | `npm test -- src/lib/indexeddb/__tests__/characterPersistenceRuntime.test.ts` | The focused test failed because the cutover freeze API did not exist. |
| Blocked recovery exports preserve active data and isolate unrelated families | `npm test -- src/lib/indexeddb/__tests__/characterRecoveryExport.test.ts` | Vite could not resolve the not-yet-created current-character export module. |
| Recovery-required UI exposes current and immutable-capture downloads | `npm test -- src/components/ui/feedback/__tests__/CharacterRecoveryExportControls.test.tsx` | Vite could not resolve the not-yet-created recovery export controls. |
| Activation metadata retains the immutable capture generation needed after a blocked reload | `npm test -- src/lib/indexeddb/__tests__/characterCutoverSelection.test.ts` | The selection retained the epoch but omitted `activatedGeneration`, leaving the raw-capture export unable to locate its IndexedDB manifest. |
| Real Chromium post-cutover edit, mirror, IndexedDB commit, and authoritative reload | `npm run test:indexeddb:e2e -- --grep "downloads recovery"` | The new edit reached the active IndexedDB row but the first reload initially mounted an empty roster before authoritative hydration; the activated-profile pre-hydration barrier fixed the race. |
| Existing all-IndexedDB per-file coverage contract after family-scoped shadow routing | GitHub CI `IndexedDB migration coverage contract` | The first PR run failed `browserShadowWriter.ts` at 87.5% statements because the authority-change-before-shadow-commit rejection branch was not exercised. |

The final focused coverage gate is `npm run test:slice8:coverage`. It enforces
per-file minimums of 90% statements, 90% functions, and 85% branches for the
new Slice 8 modules. The final measured aggregate is 99.32% statements, 99.11%
functions, 97.74% branches, and 99.63% lines. Authority routing, migration state,
pointer commit, rollback decisions, recovery activation, and the active write
router have complete branch coverage.

## Corrective manual-acceptance cycle — 2026-08-17

The interactive in-app-browser gate forced a compatibility-mirror write
failure after an IndexedDB-authoritative character edit. IndexedDB committed
the edit and retained durable journal retries, but the visible save indicator
still reported `All changes saved` and exposed no mirror warning.

The focused red command was:

`npm test -- src/hooks/__tests__/useAutoSave.test.ts src/components/ui/feedback/SaveIndicator.test.tsx`

It failed in the intended new contracts because the persistence runtime did
not expose the committed write result, the autosave hook had no locally-saved
or mirror-pending statuses, and the save indicator rendered both new statuses
as `Not saved`. The minimum correction preserves the existing boolean
durability API, adds the detailed committed result for autosave, labels a
normal active IndexedDB acknowledgement `Local: saved`, and surfaces a durable
mirror retry as `Local: saved · compatibility mirror retry pending` without
misrepresenting the committed IndexedDB edit as lost.

Green verification:

- `npm test -- src/hooks/__tests__/useAutoSave.test.ts src/components/ui/feedback/SaveIndicator.test.tsx src/lib/indexeddb/__tests__/characterPersistenceRuntime.test.ts` — 27/27 passed.
- `npm run test:slice8:coverage` — 77/77 passed; 99.33% statements,
  97.74% branches, 99.12% functions, and 99.64% lines.
- `npm run test:indexeddb:e2e` — 3/3 dedicated Chromium tests passed as
  supplemental automated evidence.
- `npm run type-check`, `npm run format:ci`, `npm run lint:ci`, and
  `npm run build` — passed.
- The affected in-app-browser path was repeated with a synthetic mirror quota
  failure. The UI displayed the mirror-pending warning while the edit was
  already committed to the active IndexedDB generation and durable journal;
  restoring storage and reloading drained the journal through the supported
  retry path.
