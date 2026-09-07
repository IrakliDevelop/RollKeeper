import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { initCrossTabCharacterSync } from '@/lib/crossTabCharacterSync';
import { characterEnvelopeKey } from '@/lib/characterCanonicalStorage';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

const baseCharacter = (revision: number, extra: object = {}): CharacterState =>
  ({
    ...DEFAULT_CHARACTER_STATE,
    id: 'sync-char',
    revision,
    ...extra,
  }) as unknown as CharacterState;

const fireEnvelopeEvent = (
  character: CharacterState,
  watermarks: object = {},
  appliedTransferIds?: string[]
) => {
  const key = characterEnvelopeKey(character.id);
  const newValue = JSON.stringify({
    state: {
      character,
      intentWatermarks: watermarks,
      ...(appliedTransferIds ? { appliedTransferIds } : {}),
    },
    version: 0,
  });
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue, storageArea: localStorage })
  );
};

describe('cross-tab character envelope sync', () => {
  let teardown: () => void;

  beforeEach(() => {
    teardown?.();
    useCharacterStore.getState().loadCharacterState(baseCharacter(5));
    useCharacterStore.setState({ appliedTransferIds: [] });
    teardown = initCrossTabCharacterSync(useCharacterStore);
  });

  it('adopts a strictly newer revision and its watermarks', () => {
    fireEnvelopeEvent(baseCharacter(6, { name: 'newer' }), {
      tabX: { seq: 3, lastSeen: 1 },
    });
    expect(useCharacterStore.getState().character.revision).toBe(6);
    expect(useCharacterStore.getState().intentWatermarks.tabX?.seq).toBe(3);
  });

  it('rejects equal revision without fresher stamps (legacy stamp-less)', () => {
    fireEnvelopeEvent(baseCharacter(5, { name: 'imposter' }));
    expect(useCharacterStore.getState().character.name).not.toBe('imposter');
  });

  it('adopts equal revision with strictly greater stamps (tiebreak)', () => {
    useCharacterStore
      .getState()
      .loadCharacterState(baseCharacter(5, { lastMutatedAt: 100 }));
    fireEnvelopeEvent(
      baseCharacter(5, { name: 'tiebreak-winner', lastMutatedAt: 200 })
    );
    expect(useCharacterStore.getState().character.name).toBe('tiebreak-winner');
  });

  it('ignores a different character id', () => {
    const other = { ...baseCharacter(99), id: 'other-char' };
    fireEnvelopeEvent(other as CharacterState);
    expect(useCharacterStore.getState().character.id).toBe('sync-char');
    expect(useCharacterStore.getState().character.revision).toBe(5);
  });

  it('ignores older revisions', () => {
    fireEnvelopeEvent(baseCharacter(4, { name: 'stale' }));
    expect(useCharacterStore.getState().character.revision).toBe(5);
  });

  describe('appliedTransferIds propagation (Important #2 follow-through)', () => {
    it('adopts a strictly newer revision and its applied-transfer ledger', () => {
      // This is what closes the gap a reclassified-to-CANONICAL
      // `recordAppliedTransfer` leaves open on its own: a follower tab's
      // own reactive `appliedTransferIds` never updates just because the
      // leader executed the forwarded intent — it converges here, via the
      // SAME storage event the leader's paired item-add mutation fires
      // (recordAppliedTransfer alone never bumps the revision, so a write
      // it triggers by itself wouldn't reach this listener at all).
      fireEnvelopeEvent(baseCharacter(6, { name: 'newer' }), {}, [
        'transfer-1',
        'transfer-2',
      ]);
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
        'transfer-2',
      ]);
    });

    it('replaces (not merges) the local ledger with the incoming one, matching intentWatermarks', () => {
      useCharacterStore.setState({ appliedTransferIds: ['stale-local-only'] });
      fireEnvelopeEvent(baseCharacter(6), {}, ['transfer-1']);
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
      ]);
    });

    it('does not touch the ledger when the event is rejected (equal revision, no fresher stamps)', () => {
      useCharacterStore.setState({ appliedTransferIds: ['transfer-1'] });
      fireEnvelopeEvent(baseCharacter(5, { name: 'imposter' }), {}, []);
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([
        'transfer-1',
      ]);
    });

    it('defaults to an empty ledger when the incoming envelope has no appliedTransferIds key (backward compatibility)', () => {
      useCharacterStore.setState({ appliedTransferIds: ['transfer-1'] });
      fireEnvelopeEvent(baseCharacter(6, { name: 'newer' }));
      expect(useCharacterStore.getState().appliedTransferIds).toEqual([]);
    });
  });
});
