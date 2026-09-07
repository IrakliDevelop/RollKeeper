import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  characterEnvelopeKey,
  armCanonicalPersistence,
  readCharacterEnvelope,
  pickFresherCharacter,
  createPerCharacterStorage,
  mergeWatermarks,
  mergeAppliedTransferIds,
  capAppliedTransferIds,
  APPLIED_TRANSFER_IDS_MAX,
} from '@/lib/characterCanonicalStorage';
import { characterWriterLock } from '@/lib/characterWriterLock';
import { STORAGE_QUOTA_EVENT } from '@/lib/safeStorage';
import { STORAGE_KEY } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

const char = (id: string, revision: number, extra: object = {}) =>
  ({ id, revision, name: `c-${id}`, ...extra }) as unknown as CharacterState;

const persistJson = (
  character: object,
  intentWatermarks: object = {},
  appliedTransferIds?: string[]
) =>
  JSON.stringify({
    state: {
      character,
      intentWatermarks,
      ...(appliedTransferIds ? { appliedTransferIds } : {}),
    },
    version: 0,
  });

beforeEach(() => {
  window.localStorage.clear();
  armCanonicalPersistence('');
});

describe('readCharacterEnvelope', () => {
  it('reads the per-character envelope', () => {
    window.localStorage.setItem(
      characterEnvelopeKey('a'),
      persistJson(char('a', 3), { t1: { seq: 2, lastSeen: 1 } })
    );
    const env = readCharacterEnvelope('a');
    expect(env?.character.revision).toBe(3);
    expect(env?.intentWatermarks).toEqual({ t1: { seq: 2, lastSeen: 1 } });
  });

  it('falls back to the legacy slot only when the id matches', () => {
    window.localStorage.setItem(STORAGE_KEY, persistJson(char('a', 5)));
    expect(readCharacterEnvelope('a')?.character.revision).toBe(5);
    expect(readCharacterEnvelope('b')).toBeNull();
  });

  it('prefers the envelope over the legacy slot', () => {
    window.localStorage.setItem(STORAGE_KEY, persistJson(char('a', 9)));
    window.localStorage.setItem(
      characterEnvelopeKey('a'),
      persistJson(char('a', 2))
    );
    expect(readCharacterEnvelope('a')?.character.revision).toBe(2);
  });
});

describe('readCharacterEnvelope — appliedTransferIds', () => {
  it('reads a persisted applied-transfer ledger', () => {
    window.localStorage.setItem(
      characterEnvelopeKey('a'),
      persistJson(char('a', 3), {}, ['transfer-1', 'transfer-2'])
    );
    expect(readCharacterEnvelope('a')?.appliedTransferIds).toEqual([
      'transfer-1',
      'transfer-2',
    ]);
  });

  it('defaults to an empty ledger for a character persisted before this field existed', () => {
    // No `appliedTransferIds` key at all in the persisted blob — the
    // migration-wipe hazard this repo has hit before: any loop over this
    // must be guarded with `?? []`, and a pre-existing character must load
    // cleanly rather than throwing.
    window.localStorage.setItem(
      characterEnvelopeKey('a'),
      persistJson(char('a', 3))
    );
    const env = readCharacterEnvelope('a');
    expect(env).not.toBeNull();
    expect(env?.appliedTransferIds).toEqual([]);
  });
});

describe('pickFresherCharacter', () => {
  it('arbitrates by freshness, envelope wins ties', () => {
    const env = {
      character: char('a', 3),
      intentWatermarks: {},
      appliedTransferIds: [],
    };
    expect(pickFresherCharacter(env, char('a', 4))?.revision).toBe(4);
    expect(pickFresherCharacter(env, char('a', 3))?.revision).toBe(3); // tie → envelope
    expect(pickFresherCharacter(env, char('a', 2))).toBe(env.character);
    expect(pickFresherCharacter(null, char('a', 1))?.id).toBe('a');
    expect(pickFresherCharacter(env, null)).toBe(env.character);
  });
});

describe('createPerCharacterStorage', () => {
  it('getItem always null (boot empty); removeItem is a no-op', () => {
    const storage = createPerCharacterStorage();
    expect(storage.getItem('whatever')).toBeNull();
    storage.removeItem('whatever');
  });

  it('setItem writes to the armed character key only', () => {
    const storage = createPerCharacterStorage();
    storage.setItem('ignored-name', persistJson(char('a', 1)));
    expect(window.localStorage.getItem(characterEnvelopeKey('a'))).toBeNull();

    armCanonicalPersistence('a');
    storage.setItem('ignored-name', persistJson(char('a', 1)));
    expect(window.localStorage.getItem(characterEnvelopeKey('a'))).toContain(
      '"revision":1'
    );

    // Boot default / other character never writes while 'a' is armed.
    storage.setItem('ignored-name', persistJson(char('boot-default', 0)));
    expect(
      window.localStorage.getItem(characterEnvelopeKey('boot-default'))
    ).toBeNull();
  });

  it('A and B envelopes are independent', () => {
    const storage = createPerCharacterStorage();
    armCanonicalPersistence('a');
    storage.setItem('n', persistJson(char('a', 1)));
    armCanonicalPersistence('b');
    storage.setItem('n', persistJson(char('b', 7)));
    expect(readCharacterEnvelope('a')?.character.revision).toBe(1);
    expect(readCharacterEnvelope('b')?.character.revision).toBe(7);
  });

  it('surfaces canonical quota failures without throwing from the domain mutation', () => {
    const onQuota = vi.fn();
    window.addEventListener(STORAGE_QUOTA_EVENT, onQuota);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const storage = createPerCharacterStorage();
    armCanonicalPersistence('a');

    expect(() => storage.setItem('n', persistJson(char('a', 1)))).not.toThrow();
    expect(onQuota).toHaveBeenCalledTimes(1);

    window.removeEventListener(STORAGE_QUOTA_EVENT, onQuota);
    vi.restoreAllMocks();
  });

  describe('leadership gate (I1)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('follower tabs never echo-write the envelope, even when armed', () => {
      const storage = createPerCharacterStorage();
      armCanonicalPersistence('a');
      vi.spyOn(characterWriterLock, 'isLeader').mockReturnValue(false);

      storage.setItem('n', persistJson(char('a', 1)));

      expect(window.localStorage.getItem(characterEnvelopeKey('a'))).toBeNull();
    });

    it('the leader tab writes normally', () => {
      const storage = createPerCharacterStorage();
      armCanonicalPersistence('a');
      vi.spyOn(characterWriterLock, 'isLeader').mockReturnValue(true);

      storage.setItem('n', persistJson(char('a', 1)));

      expect(window.localStorage.getItem(characterEnvelopeKey('a'))).toContain(
        '"revision":1'
      );
    });
  });
});

describe('mergeWatermarks', () => {
  it('takes the per-tab max seq; envelope-dominant for tabs only it has', () => {
    const envelope = { F: { seq: 5, lastSeen: 100 } };
    const current = {
      F: { seq: 4, lastSeen: 50 },
      G: { seq: 2, lastSeen: 10 },
    };
    expect(mergeWatermarks(envelope, current)).toEqual({
      F: { seq: 5, lastSeen: 100 },
      G: { seq: 2, lastSeen: 10 },
    });
  });

  it('never regresses a tab the envelope has advanced past current', () => {
    // The promotion scenario the fix pins: current lags because this tab
    // never received/adopted the leader's latest storage write before
    // promoting — the envelope (read fresh at promotion) must win.
    const envelope = { F: { seq: 10, lastSeen: 300 } };
    const current = { F: { seq: 9, lastSeen: 100 } };
    expect(mergeWatermarks(envelope, current)).toEqual({
      F: { seq: 10, lastSeen: 300 },
    });
  });

  it('keeps the fresher lastSeen even when current holds the higher seq', () => {
    const envelope = { F: { seq: 3, lastSeen: 50 } };
    const current = { F: { seq: 3, lastSeen: 200 } };
    expect(mergeWatermarks(envelope, current)).toEqual({
      F: { seq: 3, lastSeen: 200 },
    });
  });

  it('passes tabs present only in current straight through', () => {
    expect(mergeWatermarks({}, { G: { seq: 2, lastSeen: 10 } })).toEqual({
      G: { seq: 2, lastSeen: 10 },
    });
  });

  it('passes tabs present only in the envelope straight through', () => {
    expect(mergeWatermarks({ F: { seq: 5, lastSeen: 1 } }, {})).toEqual({
      F: { seq: 5, lastSeen: 1 },
    });
  });
});

describe('capAppliedTransferIds', () => {
  it('leaves a short list untouched', () => {
    expect(capAppliedTransferIds(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('evicts the oldest entries (front of the array) first once over the cap', () => {
    const ids = Array.from(
      { length: APPLIED_TRANSFER_IDS_MAX + 3 },
      (_, i) => `t-${i}`
    );
    const capped = capAppliedTransferIds(ids);
    expect(capped.length).toBe(APPLIED_TRANSFER_IDS_MAX);
    // The 3 oldest ('t-0', 't-1', 't-2') are gone; the newest survive.
    expect(capped).not.toContain('t-0');
    expect(capped).not.toContain('t-2');
    expect(capped[0]).toBe('t-3');
    expect(capped[capped.length - 1]).toBe(`t-${APPLIED_TRANSFER_IDS_MAX + 2}`);
  });
});

describe('mergeAppliedTransferIds', () => {
  it('unions envelope and current ledgers, envelope entries first', () => {
    expect(mergeAppliedTransferIds(['a', 'b'], ['c'])).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates ids present in both ledgers without reordering', () => {
    expect(mergeAppliedTransferIds(['a', 'b'], ['b', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('never drops an id the envelope already recorded (never regresses)', () => {
    expect(mergeAppliedTransferIds(['a'], [])).toEqual(['a']);
  });

  it('caps the merged result', () => {
    const envelopeIds = Array.from(
      { length: APPLIED_TRANSFER_IDS_MAX },
      (_, i) => `env-${i}`
    );
    const merged = mergeAppliedTransferIds(envelopeIds, ['extra-1', 'extra-2']);
    expect(merged.length).toBe(APPLIED_TRANSFER_IDS_MAX);
    expect(merged).toContain('extra-2');
    expect(merged).not.toContain('env-0');
  });
});
