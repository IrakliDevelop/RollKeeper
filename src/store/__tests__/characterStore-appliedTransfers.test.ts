import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  useCharacterStore,
  onPromotedToLeader,
  characterIntentBus,
} from '@/store/characterStore';
import {
  readCharacterEnvelope,
  characterEnvelopeKey,
  APPLIED_TRANSFER_IDS_MAX,
} from '@/lib/characterCanonicalStorage';
import { characterWriterLock } from '@/lib/characterWriterLock';
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

  describe('onPromotedToLeader adoption', () => {
    // `characterWriterLock.switchTo`'s `onPromoted` callback is only ever
    // invoked when the Web Locks API is available, which jsdom does not
    // implement — so this exercises the exported function directly instead
    // of going through the real module-load wiring, which this suite alone
    // cannot reach. This is the other half of the restore path (alongside
    // useCharacterRosterSync's load-time adoption): without it, a tab that
    // becomes leader after startup never adopts a ledger written by
    // whichever tab held the lock before it.
    it('adopts the envelope applied-transfer ledger on promotion', () => {
      const character = makeCharacter({ id: 'leader-char', revision: 5 });
      useCharacterStore.getState().loadCharacterState(character);
      window.localStorage.setItem(
        characterEnvelopeKey('leader-char'),
        JSON.stringify({
          state: {
            character,
            intentWatermarks: {},
            appliedTransferIds: ['transfer-1', 'transfer-2'],
          },
          version: 0,
        })
      );

      onPromotedToLeader('leader-char');

      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
        'transfer-2',
      ]);
    });

    it('merges the envelope ledger against current in-memory state instead of clobbering', () => {
      const character = makeCharacter({ id: 'leader-char', revision: 5 });
      useCharacterStore.getState().loadCharacterState(character);
      useCharacterStore.setState({ appliedTransferIds: ['transfer-2'] });
      window.localStorage.setItem(
        characterEnvelopeKey('leader-char'),
        JSON.stringify({
          state: {
            character,
            intentWatermarks: {},
            appliedTransferIds: ['transfer-1'],
          },
          version: 0,
        })
      );

      onPromotedToLeader('leader-char');

      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
        'transfer-2',
      ]);
    });

    it('is a no-op for the ledger when no envelope exists for the character', () => {
      const character = makeCharacter({ id: 'no-envelope-char' });
      useCharacterStore.getState().loadCharacterState(character);
      useCharacterStore.setState({ appliedTransferIds: ['transfer-1'] });

      expect(() => onPromotedToLeader('no-envelope-char')).not.toThrow();
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
      ]);
    });
  });

  describe('clearAppliedTransfer', () => {
    it('removes a recorded id', () => {
      useCharacterStore.getState().recordAppliedTransfer('transfer-1');
      useCharacterStore.getState().recordAppliedTransfer('transfer-2');
      useCharacterStore.getState().clearAppliedTransfer('transfer-1');
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-2',
      ]);
    });

    it('is a no-op for an id not present', () => {
      useCharacterStore.getState().recordAppliedTransfer('transfer-1');
      expect(() =>
        useCharacterStore.getState().clearAppliedTransfer('nonexistent')
      ).not.toThrow();
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
      ]);
    });

    it('persists the removal to the canonical envelope', () => {
      const character = makeCharacter({ id: 'clear-char' });
      useCharacterStore.getState().loadCharacterState(character);
      useCharacterStore.getState().recordAppliedTransfer('transfer-1');
      useCharacterStore.getState().clearAppliedTransfer('transfer-1');

      const envelope = readCharacterEnvelope('clear-char');
      expect(envelope?.appliedTransferIds).not.toContain('transfer-1');
    });
  });

  describe('CANONICAL classification (Important #2): a follower tab forwards instead of dropping the write', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('a follower tab does not mutate its own ledger locally — it forwards the call as an intent', () => {
      const character = makeCharacter({ id: 'follower-char' });
      useCharacterStore.getState().loadCharacterState(character);
      vi.spyOn(characterWriterLock, 'isLeader').mockReturnValue(false);
      const sendSpy = vi.spyOn(characterIntentBus, 'send');

      useCharacterStore.getState().recordAppliedTransfer('transfer-1');

      // Not executed locally in a follower tab — a LOCAL_UI classification
      // would have mutated this immediately, updating memory only, never
      // reaching localStorage (createPerCharacterStorage's leader-only
      // persistence gate), reproducing the original bug in whichever tab
      // isn't the writer-lock leader (e.g. the sheet tab, when
      // PlayerVttScreen holds the lock but never applies transfers).
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([]);
      expect(sendSpy).toHaveBeenCalledWith(
        'follower-char',
        'recordAppliedTransfer',
        ['transfer-1']
      );
    });

    it('the leader tab still executes and persists locally, unchanged from before reclassification', () => {
      const character = makeCharacter({ id: 'leader-tab-char' });
      useCharacterStore.getState().loadCharacterState(character);
      vi.spyOn(characterWriterLock, 'isLeader').mockReturnValue(true);

      useCharacterStore.getState().recordAppliedTransfer('transfer-1');

      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
      ]);
      const envelope = readCharacterEnvelope('leader-tab-char');
      expect(envelope?.appliedTransferIds).toEqual(['transfer-1']);
    });
  });

  describe('cap financial-bug margin (escalated finding)', () => {
    it('a full-size shop purchase batch (25 transfers) never evicts its own cost-carrying entry, even against a near-full ledger', () => {
      // Fill the ledger to just under the cap with unrelated, older ids —
      // simulating a backlog of applied-but-unacknowledged transfers from
      // earlier activity.
      const backlogSize = APPLIED_TRANSFER_IDS_MAX - 10;
      for (let i = 0; i < backlogSize; i++) {
        useCharacterStore.getState().recordAppliedTransfer(`backlog-${i}`);
      }

      // A single shop purchase batch: up to MAX_MAGIC_PURCHASE_UNITS (25)
      // transfers, cost stamped on index 0 only.
      const purchaseIds = Array.from({ length: 25 }, (_, i) => `wand-${i}`);
      for (const id of purchaseIds) {
        useCharacterStore.getState().recordAppliedTransfer(id);
      }

      const ids = useCharacterStore.getState().appliedTransferIds;
      // The cost-carrying entry (index 0 of the purchase) must still be
      // present — this is the entry that would trigger a re-charge if
      // evicted and later re-applied on reload.
      expect(ids).toContain('wand-0');
      expect(ids).toContain(`wand-24`);
    });
  });
});
