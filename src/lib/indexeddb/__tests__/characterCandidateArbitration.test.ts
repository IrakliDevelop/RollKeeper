import { describe, expect, it } from 'vitest';

import {
  arbitrateCharacterCandidates,
  type CharacterCandidate,
} from '@/lib/indexeddb/characterCandidateArbitration';

function candidate(
  sourceKey: string,
  id: string,
  revision: number,
  lastMutatedAt: number,
  lastMutatedBy: string,
  marker: string
): CharacterCandidate {
  const payload = { id, revision, lastMutatedAt, lastMutatedBy, marker };
  return {
    candidateId: sourceKey,
    sourceKey,
    declaredId: id,
    payload,
    rawValue: JSON.stringify(payload),
    revision,
    lastMutatedAt,
    lastMutatedBy,
    intentWatermarks: {},
  };
}

describe('character candidate arbitration', () => {
  it.each([
    [
      'revision',
      candidate('a', 'hero', 2, 1, 'a', 'winner'),
      candidate('b', 'hero', 1, 99, 'z', 'loser'),
    ],
    [
      'timestamp',
      candidate('a', 'hero', 1, 2, 'a', 'winner'),
      candidate('b', 'hero', 1, 1, 'z', 'loser'),
    ],
    [
      'writer',
      candidate('a', 'hero', 1, 1, 'z', 'winner'),
      candidate('b', 'hero', 1, 1, 'a', 'loser'),
    ],
  ])(
    'orders by %s while preserving every candidate',
    (_label, winner, loser) => {
      const result = arbitrateCharacterCandidates([loser, winner]);
      expect(result.active.get('hero')?.candidateId).toBe(winner.candidateId);
      expect(result.candidates.get('hero')).toHaveLength(2);
      expect(result.conflicts).toEqual([]);
    }
  );

  it('is permutation-independent and never groups different exact IDs', () => {
    const a = candidate('a', 'hero-a', 1, 1, 'a', 'a');
    const b = candidate('b', 'hero-b', 2, 2, 'b', 'b');
    const forward = arbitrateCharacterCandidates([a, b]);
    const reverse = arbitrateCharacterCandidates([b, a]);
    expect([...forward.active.keys()].sort()).toEqual(['hero-a', 'hero-b']);
    expect([...reverse.active.keys()].sort()).toEqual(['hero-a', 'hero-b']);
  });

  it('creates a conflict for equal stamps with different raw content', () => {
    const a = candidate('a', 'hero', 1, 2, 'tab', 'a');
    const b = candidate('b', 'hero', 1, 2, 'tab', 'b');
    const result = arbitrateCharacterCandidates([a, b]);
    expect(result.active.has('hero')).toBe(false);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        kind: 'equal-stamp-divergence',
        characterId: 'hero',
      }),
    ]);
    expect(result.candidates.get('hero')).toHaveLength(2);
  });

  it('deduplicates byte-identical candidates without discarding their sources', () => {
    const a = candidate('a', 'hero', 1, 2, 'tab', 'same');
    const b = { ...a, candidateId: 'b', sourceKey: 'b' };
    const result = arbitrateCharacterCandidates([a, b]);
    expect(result.active.get('hero')?.candidateId).toBe('a');
    expect(result.candidates.get('hero')).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
  });

  it('conflicts ID mismatches and preserves malformed/unsupported/quarantined candidates inactive', () => {
    const valid = candidate(
      'rollkeeper-character:hero',
      'hero',
      1,
      1,
      'a',
      'ok'
    );
    const mismatch = {
      ...candidate('mismatch', 'hero', 2, 2, 'b', 'bad'),
      payload: { id: 'other' },
    };
    const malformed = {
      ...candidate('malformed', 'hero', 3, 3, 'c', 'bad'),
      disposition: 'malformed' as const,
    };
    const unsupported = {
      ...candidate('unsupported', 'hero', 4, 4, 'd', 'bad'),
      disposition: 'unsupported' as const,
    };
    const quarantined = {
      ...candidate('quarantined', 'hero', 5, 5, 'e', 'bad'),
      disposition: 'quarantined' as const,
    };
    const result = arbitrateCharacterCandidates([
      valid,
      mismatch,
      malformed,
      unsupported,
      quarantined,
    ]);
    expect(result.active.has('hero')).toBe(false);
    expect(result.conflicts.map(conflict => conflict.kind)).toContain(
      'id-mismatch'
    );
    expect(result.blocked.map(item => item.candidateId).sort()).toEqual([
      'malformed',
      'quarantined',
      'unsupported',
    ]);
    expect(result.candidates.get('hero')).toHaveLength(5);
  });

  it('merges each tab watermark by maximum', () => {
    const a = {
      ...candidate('a', 'hero', 2, 2, 'z', 'a'),
      intentWatermarks: {
        tab1: { seq: 2, lastSeen: 7 },
        tab2: { seq: 1, lastSeen: 9 },
      },
    };
    const b = {
      ...candidate('b', 'hero', 1, 1, 'a', 'b'),
      intentWatermarks: {
        tab1: { seq: 5, lastSeen: 3 },
        tab3: { seq: 4, lastSeen: 8 },
      },
    };
    expect(arbitrateCharacterCandidates([a, b]).watermarks.get('hero')).toEqual(
      {
        tab1: { seq: 5, lastSeen: 7 },
        tab2: { seq: 1, lastSeen: 9 },
        tab3: { seq: 4, lastSeen: 8 },
      }
    );
  });

  it('treats non-object and non-string payload IDs as explicit mismatches', () => {
    const nonObject = {
      ...candidate('null', 'hero', 1, 1, 'a', 'a'),
      payload: null,
    };
    const nonString = {
      ...candidate('number', 'other', 1, 1, 'a', 'a'),
      payload: { id: 1 },
    };
    const result = arbitrateCharacterCandidates([nonObject, nonString]);
    expect(result.conflicts.map(conflict => conflict.kind)).toEqual([
      'id-mismatch',
      'id-mismatch',
    ]);
  });
});
