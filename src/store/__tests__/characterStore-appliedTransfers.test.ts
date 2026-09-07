import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import {
  readCharacterEnvelope,
  characterEnvelopeKey,
  APPLIED_TRANSFER_IDS_MAX,
} from '@/lib/characterCanonicalStorage';
import { makeCharacter } from '@/utils/__tests__/test-utils';

describe('characterStore — appliedTransferIds / recordAppliedTransfer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCharacterStore.getState().loadCharacterState(makeCharacter());
    useCharacterStore.setState({ appliedTransferIds: [] });
  });

  it('starts empty', () => {
    expect(useCharacterStore.getState().appliedTransferIds).toEqual([]);
  });

  it('records a transfer id as applied', () => {
    useCharacterStore.getState().recordAppliedTransfer('transfer-1');
    expect(useCharacterStore.getState().appliedTransferIds).toEqual([
      'transfer-1',
    ]);
  });

  it('recording an id already present is a no-op (does not duplicate or reorder)', () => {
    useCharacterStore.getState().recordAppliedTransfer('transfer-1');
    useCharacterStore.getState().recordAppliedTransfer('transfer-2');
    useCharacterStore.getState().recordAppliedTransfer('transfer-1');
    expect(useCharacterStore.getState().appliedTransferIds).toEqual([
      'transfer-1',
      'transfer-2',
    ]);
  });

  it('caps at APPLIED_TRANSFER_IDS_MAX, evicting the oldest first', () => {
    for (let i = 0; i < APPLIED_TRANSFER_IDS_MAX + 5; i++) {
      useCharacterStore.getState().recordAppliedTransfer(`t-${i}`);
    }
    const ids = useCharacterStore.getState().appliedTransferIds;
    expect(ids.length).toBe(APPLIED_TRANSFER_IDS_MAX);
    // The 5 oldest were evicted first.
    expect(ids).not.toContain('t-0');
    expect(ids).not.toContain('t-4');
    expect(ids[0]).toBe('t-5');
    expect(ids[ids.length - 1]).toBe(`t-${APPLIED_TRANSFER_IDS_MAX + 4}`);
  });

  it('persists the ledger to the canonical envelope — survives a store rehydrate', () => {
    const character = makeCharacter({ id: 'rehydrate-char' });
    useCharacterStore.getState().loadCharacterState(character);
    useCharacterStore.getState().recordAppliedTransfer('transfer-durable');

    // Read back through the same path a fresh mount uses
    // (useCharacterRosterSync → readCharacterEnvelope), independent of the
    // in-memory store — proves this is real persistence, not just a
    // component-local ref that would vanish on remount.
    const envelope = readCharacterEnvelope('rehydrate-char');
    expect(envelope?.appliedTransferIds).toContain('transfer-durable');
  });

  it('a character persisted without the field loads cleanly and behaves as if empty', () => {
    const legacyCharacter = makeCharacter({ id: 'legacy-char' });
    // Simulate a character envelope written before this field existed: no
    // `appliedTransferIds` key in the persisted blob at all. Read it back
    // BEFORE loading it into the store — loading re-persists (and would
    // otherwise overwrite the legacy blob with a fresh one before this
    // assertion gets to see the pre-migration shape).
    window.localStorage.setItem(
      characterEnvelopeKey('legacy-char'),
      JSON.stringify({
        state: { character: legacyCharacter, intentWatermarks: {} },
        version: 0,
      })
    );

    const legacyEnvelope = readCharacterEnvelope('legacy-char');
    expect(legacyEnvelope).not.toBeNull();
    expect(legacyEnvelope?.appliedTransferIds).toEqual([]);

    // Loading this pre-migration character into the store must not throw —
    // the migration-wipe hazard this repo has hit before.
    expect(() =>
      useCharacterStore.getState().loadCharacterState(legacyCharacter)
    ).not.toThrow();
    expect(
      useCharacterStore.getState().appliedTransferIds.includes('anything')
    ).toBe(false);
  });
});
