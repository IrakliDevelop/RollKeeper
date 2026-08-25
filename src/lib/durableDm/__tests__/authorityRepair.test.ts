import { describe, expect, it, vi } from 'vitest';

import {
  toAuthorityPointerView,
  type AuthorityMarkerView,
  type AuthorityPointerView,
  type NormalizedAuthorityInconsistent,
} from '../familyAuthorityNormalizer';
import { decideAuthorityRepair } from '../authorityRepair';

/** Builds a branded pointer view the only way a caller outside the
 * normalizer module can: through `toAuthorityPointerView`. */
function pointerView(
  authority: 'localStorage' | 'indexedDB' | 'postgres',
  epoch: number
): AuthorityPointerView {
  const view = toAuthorityPointerView({
    authority,
    epoch,
    namespace: 'user:account-1',
    campaignId: 'campaign-1',
    family: 'npc',
    committedAt: '2026-08-24T00:00:00.000Z',
  });
  if (!view) throw new Error('expected a real pointer view, got null');
  return view;
}

function markerView(
  authority: AuthorityMarkerView['authority'],
  epoch: number
): AuthorityMarkerView {
  return { authority, epoch, campaignId: 'campaign-1' };
}

/** Evidence whose two verify functions both fail the test if invoked —
 * used for every case where the decision is supposed to short-circuit
 * before consulting either. */
function unreachableEvidence() {
  return {
    verifyIndexedDbGeneration: vi.fn(async () => {
      throw new Error('verifyIndexedDbGeneration should not have been called');
    }),
    verifyPostgresParity: vi.fn(async () => {
      throw new Error('verifyPostgresParity should not have been called');
    }),
  };
}

describe('decideAuthorityRepair', () => {
  describe('R5b row 1 — pointer behind the marker: block', () => {
    it('blocks when the marker claims indexedDB and the pointer is absent (legacy)', async () => {
      const evidence = unreachableEvidence();
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: { marker: markerView('indexedDB', 1), pointer: null },
        evidence,
      });
      expect(result.action).toBe('block');
      expect(evidence.verifyIndexedDbGeneration).not.toHaveBeenCalled();
      expect(evidence.verifyPostgresParity).not.toHaveBeenCalled();
    });

    it('blocks when the marker claims postgres and the pointer is only at indexedDB', async () => {
      // Distinguishes "pointer absent" from "pointer real but lower rank" —
      // a mutant that only checks `pointer === null` instead of a rank
      // comparison would let this one through.
      const evidence = unreachableEvidence();
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: {
          marker: markerView('postgres', 2),
          pointer: pointerView('indexedDB', 2),
        },
        evidence,
      });
      expect(result.action).toBe('block');
    });

    it('does not block the adjacent case: a marker at indexedDB with the pointer already at postgres is ahead, not behind', async () => {
      // The other direction of the same rank pair as the previous test —
      // proves the guard is a real rank comparison, not a fixed pair, and
      // that it does not fail open by blocking everything.
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: {
          marker: markerView('indexedDB', 2),
          pointer: pointerView('postgres', 2),
        },
        evidence: {
          verifyIndexedDbGeneration: vi.fn(async () => false),
          verifyPostgresParity: vi.fn(async () => true),
        },
      });
      expect(result.action).toBe('repair');
    });

    it('blocks a same-rank marker/pointer pair reported as marker-pointer-disagreement (defensive: the normalizer never emits this reason at equal rank, but the guard must not fail open if it ever did)', async () => {
      const evidence = unreachableEvidence();
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: {
          marker: markerView('indexedDB', 1),
          pointer: pointerView('indexedDB', 1),
        },
        evidence,
      });
      expect(result.action).toBe('block');
    });
  });

  describe('R5b row 2 — pointer ahead at indexedDB: verify, then write', () => {
    it('repairs to indexedDB at the pointer epoch when the generation verifies', async () => {
      const verifyPostgresParity = vi.fn(async () => {
        throw new Error('verifyPostgresParity should not have been called');
      });
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: { marker: null, pointer: pointerView('indexedDB', 1) },
        evidence: {
          verifyIndexedDbGeneration: vi.fn(async () => true),
          verifyPostgresParity,
        },
      });
      expect(result).toEqual({
        action: 'repair',
        authority: 'indexedDB',
        epoch: 1,
      });
      expect(verifyPostgresParity).not.toHaveBeenCalled();
    });

    it('blocks when the prepared generation does not verify', async () => {
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: { marker: null, pointer: pointerView('indexedDB', 1) },
        evidence: {
          verifyIndexedDbGeneration: vi.fn(async () => false),
          verifyPostgresParity: vi.fn(async () => true),
        },
      });
      expect(result.action).toBe('block');
    });

    it('consults verifyIndexedDbGeneration exactly once with no arguments', async () => {
      const verifyIndexedDbGeneration = vi.fn(async () => true);
      await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: { marker: null, pointer: pointerView('indexedDB', 1) },
        evidence: {
          verifyIndexedDbGeneration,
          verifyPostgresParity: vi.fn(async () => true),
        },
      });
      expect(verifyIndexedDbGeneration).toHaveBeenCalledTimes(1);
      expect(verifyIndexedDbGeneration).toHaveBeenCalledWith();
    });

    it('repairs when a PRESENT stale rollback marker (legacy_restored) is outrun by a cutover pointer (fix round 1, item 7)', async () => {
      // Every other "pointer ahead" test uses `marker: null`, which reaches
      // rank 0 through the `marker ? rankOf(...) : 0` short-circuit and
      // never actually calls `rankOf` on a real marker. A real marker at
      // `legacy_restored` (a completed rollback that a LATER cutover then
      // ran over) exercises `rankOf`'s `localStorage`/`legacy_restored`
      // fallback branch directly, and must resolve identically to the
      // absent-marker case.
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: {
          marker: markerView('legacy_restored', 1),
          pointer: pointerView('indexedDB', 2),
        },
        evidence: {
          verifyIndexedDbGeneration: vi.fn(async () => true),
          verifyPostgresParity: vi.fn(async () => true),
        },
      });
      expect(result).toEqual({
        action: 'repair',
        authority: 'indexedDB',
        epoch: 2,
      });
    });
  });

  describe('R5b row 3 — pointer ahead at postgres: verify, then write', () => {
    it('repairs to postgres at the pointer epoch when parity verifies', async () => {
      const verifyIndexedDbGeneration = vi.fn(async () => {
        throw new Error(
          'verifyIndexedDbGeneration should not have been called'
        );
      });
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: {
          marker: markerView('indexedDB', 1),
          pointer: pointerView('postgres', 2),
        },
        evidence: {
          verifyIndexedDbGeneration,
          verifyPostgresParity: vi.fn(async () => true),
        },
      });
      expect(result).toEqual({
        action: 'repair',
        authority: 'postgres',
        epoch: 2,
      });
      expect(verifyIndexedDbGeneration).not.toHaveBeenCalled();
    });

    it('blocks when document parity does not verify', async () => {
      const result = await decideAuthorityRepair({
        reason: 'marker-pointer-disagreement',
        observed: { marker: null, pointer: pointerView('postgres', 1) },
        evidence: {
          verifyIndexedDbGeneration: vi.fn(async () => true),
          verifyPostgresParity: vi.fn(async () => false),
        },
      });
      expect(result.action).toBe('block');
    });
  });

  describe('R5b row 4 — epoch disagreement within one state: always block', () => {
    it('blocks when the marker epoch is ahead of the pointer epoch', async () => {
      const evidence = unreachableEvidence();
      const result = await decideAuthorityRepair({
        reason: 'epoch-disagreement',
        observed: {
          marker: markerView('indexedDB', 3),
          pointer: pointerView('indexedDB', 2),
        },
        evidence,
      });
      // Distinguishes this from row 1's block: same `action`, but this must
      // be recognizable as an EPOCH disagreement, not a rank disagreement —
      // otherwise a mutant that deletes this row's dedicated branch and
      // falls through to row 1's rank check (which also blocks on equal
      // ranks) would survive undetected.
      expect(result).toMatchObject({
        action: 'block',
        reason: expect.stringContaining('epoch'),
      });
    });

    it('blocks when the pointer epoch is ahead of the marker epoch — no directional guessing', async () => {
      // Same reason, opposite numeric direction: proves the block does not
      // secretly pick "the higher epoch wins".
      const evidence = unreachableEvidence();
      const result = await decideAuthorityRepair({
        reason: 'epoch-disagreement',
        observed: {
          marker: markerView('postgres', 2),
          pointer: pointerView('postgres', 3),
        },
        evidence,
      });
      expect(result).toMatchObject({
        action: 'block',
        reason: expect.stringContaining('epoch'),
      });
    });
  });

  describe('reasons outside the table: always block', () => {
    const otherReasons: NormalizedAuthorityInconsistent['reason'][] = [
      'account-mismatch',
      'campaign-mismatch',
      'incomplete-rollback',
    ];

    it.each(otherReasons)(
      'blocks on %s without consulting evidence',
      async reason => {
        const evidence = unreachableEvidence();
        const result = await decideAuthorityRepair({
          reason,
          observed: {
            marker: markerView('indexedDB', 1),
            pointer: pointerView('postgres', 1),
          },
          evidence,
        });
        expect(result.action).toBe('block');
      }
    );
  });
});
