# Slice 9 TDD evidence — automatic character sync

Date: 2026-08-17

Branch: `feat/slice-9-automatic-character-sync`

Starting commit: `e39a83477dfdbe220c63a19a55924e593ed33451`

This slice is gated by the independent, default-off
`NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED` flag. No database
migration was added. The existing character RPC, CAS, idempotency receipt,
tombstone, and RLS contracts are reused.

## Focused red/green cycles

1. Preferences and atomic repository

   Red:

   ```text
   npm test -- src/lib/supabase/automaticCharacterSyncPreferences.test.ts src/lib/indexeddb/__tests__/automaticCharacterSyncRepository.test.ts
   ```

   Intended failure: both implementation modules were absent. The first green
   attempt also exposed a transaction-completion listener installed too late,
   which allowed an injected quota failure to appear committed. Installing the
   completion observer before requests and aborting synchronously fixed it.
   Final focused result: 9/9 passed at that stage.

2. Cloud worker and idempotency

   Red:

   ```text
   npm test -- src/lib/supabase/automaticCharacterSyncWorker.test.ts
   ```

   Intended failure: worker module absent. Later red cases rejected a
   second-device canonical cloud ID, accepted mismatched schema/client revision,
   and stranded an `inflight` mutation after writer loss. Green behavior adopts
   a canonical ID only on version-zero create, validates receipt/refetch
   identity/version/schema/revision/fingerprint, and reclaims the exact durable
   mutation ID on a fresh worker's first drain.

3. Conflict preservation and explicit resolution

   Red:

   ```text
   npm test -- src/lib/indexeddb/__tests__/automaticCharacterConflictService.test.ts
   ```

   Intended failure: conflict service absent. Later red coverage proved a cloud
   payload with a different aggregate ID was activated. Green behavior
   quarantines it and keeps local active; Keep mine, Use cloud, and Keep both
   snapshot every discarded candidate.

4. Application service, policy, and flags

   Red:

   ```text
   npm test -- src/lib/supabase/automaticCharacterSyncService.test.ts
   ```

   Intended failure: application service absent. Subsequent red cases covered a
   missing local cutover prerequisite, a stale account-wide preview that left
   partial preferences, and a future-default character that stayed local-only.
   Green behavior validates the complete preview before writing preferences and
   atomically creates the future character document plus outbox work.

5. Coordinator, puller, and runtime bridge

   Red:

   ```text
   npm test -- src/lib/supabase/automaticCharacterSyncCoordinator.test.ts
   npm test -- src/lib/supabase/automaticCharacterSyncPuller.test.ts
   npm test -- src/lib/supabase/automaticCharacterSyncRuntime.test.ts
   ```

   Intended failures: modules absent. Green behavior covers startup, focus,
   reconnect, manual refresh, successful push, invalidation, BroadcastChannel
   absence, durable failover, pull conflict isolation, and account-runtime
   replacement.

6. Malformed/future candidate quarantine

   Red:

   ```text
   npm test -- src/lib/supabase/automaticCharacterSyncPuller.test.ts src/lib/indexeddb/__tests__/automaticCharacterConflictService.test.ts src/lib/supabase/automaticCharacterSyncWorker.test.ts
   ```

   Intended failures: unsafe payload identity, negative client revision,
   non-integer server version, and cyclic payload were activated or aborted the
   entire pull. Seven focused failures were observed together, followed by one
   stale-invalid-version ordering failure in the final review. Green behavior validates
   metadata and payload identity, catches decode failure, stores a safe
   exportable quarantine record, and never activates the candidate.

7. Persistent browser runtime and authentication recovery

   Red:

   ```text
   npm test -- src/components/ui/character/useCharacterAutomaticSync.test.tsx
   ```

   Intended failure: root provider export absent. The dashboard-owned worker
   stopped during navigation. A later red case showed same-account
   reauthentication did not resume `auth-required` work. Green behavior mounts
   one runtime beneath `PersistenceBootstrap`, survives routed child changes,
   closes before account replacement, resumes auth work, and wakes the worker.

8. Cutover/automatic flag separation

   Red:

   ```text
   npm test -- src/lib/supabase/browserAutomaticCharacterSync.test.ts
   ```

   Intended failure: an activated selection record could initialize automatic
   sync while the IndexedDB cutover deployment flag was off. Green behavior
   requires the actual active cutover participant before auth listeners,
   IndexedDB sync repositories, or cloud gateways initialize.

9. Local acknowledgement and compatibility-mirror failure

   Red:

   ```text
   npm test -- src/hooks/__tests__/useAutoSave.test.ts
   ```

   Intended failure: an automatic document/outbox transaction rejection was
   immediately obscured by `saving` and entered an autosave retry loop. Green
   behavior keeps `Local: failed` visible, retains unsaved state, and requires
   an explicit local retry. A committed IndexedDB write with mirror work pending
   remains `saved-local-mirror-pending` and still records durable automatic work.

10. Dedicated browser gating suite

    Red:

    ```text
    npm run test:automatic-sync:e2e
    ```

    The first executable run reached the app and failed on an ambiguous strict
    text locator (two visible copies of the synthetic name). The locator was
    corrected to the character heading without changing production code.

    Green:

    ```text
    npm run test:automatic-sync:e2e
    # 1 passed
    ```

    It proves flag-on alone leaves selection absent, keeps local play across
    reload and a second tab, preserves the unrelated DM seed byte-for-byte, and
    issues zero character mutation RPCs.

## Focused coverage gate

Initial red:

```text
npm run test:slice9:coverage
# 39 tests passed, but per-file 90% statements / 90% functions / 85% branches failed
```

The thresholds were not lowered. Authority routing was subsequently added to
the measured file set.

Final green:

```text
npm run test:slice9:coverage
# 9 files, 80 tests passed
# statements 98.38%, branches 94.68%, functions 99.23%, lines 99.27%
```

No deliberately failing test is committed.
