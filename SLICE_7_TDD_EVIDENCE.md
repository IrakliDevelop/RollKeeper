# Slice 7 red-green TDD evidence

Date: 2026-08-16

The Slice 7 contracts were introduced before their implementations. The
following focused red phases were run and failed for the intended missing
behavior; no deliberately failing test is retained.

| Contract | Red command | Intended failure observed |
|---|---|---|
| State machine and v1 database layout | `npm test -- src/lib/indexeddb/__tests__/migrationState.test.ts src/lib/indexeddb/__tests__/localDatabase.test.ts` | Vite could not resolve the not-yet-created `migrationState` and `localDatabase` modules. |
| Immutable capture and passthrough validation | `npm test -- src/lib/indexeddb/__tests__/migrationCapture.test.ts src/lib/indexeddb/__tests__/migrationValidation.test.ts` | Vite could not resolve the not-yet-created capture and validation modules. |
| Web Lock/durable lease and shadow acknowledgements | `npm test -- src/lib/indexeddb/__tests__/migrationLock.test.ts src/lib/indexeddb/__tests__/shadowJournal.test.ts` | Vite could not resolve the not-yet-created lock and journal modules. |
| Migration orchestration/checkpoint recovery | `npm test -- src/lib/indexeddb/__tests__/migrationEngine.test.ts` | Vite could not resolve the not-yet-created migration engine. |
| Recovery export/import | `npm test -- src/lib/indexeddb/__tests__/migrationRecovery.test.ts` | Vite could not resolve the not-yet-created migration recovery module. |
| Disabled bootstrap and hydration ordering | `npm test -- src/lib/indexeddb/__tests__/persistenceBootstrap.test.ts` | Vite could not resolve the not-yet-created persistence bootstrap module. |

During refactoring, the real versionchange test also exposed that an IndexedDB
`close` event is not portable evidence of a versionchange-triggered close. The
test was corrected to assert the explicit versionchange callback and successful
upgrade/reopen, then the implementation and focused suite were made green.
