import type { EncounterEntity } from '@/types/encounter';

/**
 * Trailing debounce for the combatant → NPC library write-back.
 *
 * Number inputs update the combatant on every keystroke, so typing "18" over
 * "13" passes through "1". Writing each step to the library would briefly
 * persist the transient value; instead each entity's edits are coalesced
 * into one diff of (first `before`, latest `after`) and applied once the
 * user pauses. Only the library write is deferred — the combatant itself
 * still updates immediately.
 */
export const NPC_LIBRARY_SYNC_DELAY_MS = 500;

type ApplyFn = (before: EncounterEntity, after: EncounterEntity) => void;

interface PendingWrite {
  before: EncounterEntity;
  after: EncounterEntity;
  apply: ApplyFn;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingWrite>();
let listenersRegistered = false;

function runPending(key: string): void {
  const write = pending.get(key);
  if (!write) return;
  pending.delete(key);
  clearTimeout(write.timer);
  write.apply(write.before, write.after);
}

function registerUnloadListeners(): void {
  if (listenersRegistered || typeof window === 'undefined') return;
  listenersRegistered = true;
  window.addEventListener('pagehide', flushNpcLibrarySync);
  window.addEventListener('beforeunload', flushNpcLibrarySync);
}

/** Queue a write-back for one entity edit. Coalesces with pending edits of the same entity. */
export function queueNpcLibrarySync(
  encounterId: string,
  before: EncounterEntity,
  after: EncounterEntity,
  apply: ApplyFn
): void {
  registerUnloadListeners();
  const key = `${encounterId}:${after.id}`;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  pending.set(key, {
    before: existing?.before ?? before,
    after,
    apply,
    timer: setTimeout(() => runPending(key), NPC_LIBRARY_SYNC_DELAY_MS),
  });
}

/** Run every pending write now (tests, pagehide). */
export function flushNpcLibrarySync(): void {
  for (const key of [...pending.keys()]) runPending(key);
}

/** Drop pending writes without applying (test isolation). */
export function resetNpcLibrarySync(): void {
  for (const write of pending.values()) clearTimeout(write.timer);
  pending.clear();
}
