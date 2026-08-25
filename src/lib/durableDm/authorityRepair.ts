import type {
  AuthorityMarkerView,
  AuthorityPointerView,
  NormalizedAuthorityInconsistent,
} from './familyAuthorityNormalizer';

/**
 * The two pieces of evidence R5b's decision table requires before a repair
 * may write anything. Each adapter supplies these by re-reading its own
 * IndexedDB pointer and (for the postgres row) its own cloud
 * `preview-enrollment` response — this module never touches storage itself.
 *
 * Both are `() => Promise<boolean>` rather than eagerly-computed booleans so
 * that a caller whose disagreement direction never reaches that row (e.g.
 * `epoch-disagreement`, which always blocks before either is consulted)
 * never pays for the IndexedDB re-read or the network round trip.
 */
export interface AuthorityRepairEvidence {
  /**
   * R5b row 2: "Verify the prepared generation AND that every manifest
   * document is present at it." Called only when the pointer is ahead of
   * the marker at `indexedDB`.
   */
  verifyIndexedDbGeneration: () => Promise<boolean>;
  /**
   * R5b row 3: "Require `preview.epoch === pointer.epoch` AND exact
   * document parity." Called only when the pointer is ahead of the marker
   * at `postgres`.
   */
  verifyPostgresParity: () => Promise<boolean>;
}

export type AuthorityRepairOutcome =
  | {
      action: 'repair';
      authority: 'indexedDB' | 'postgres';
      epoch: number;
    }
  | {
      action: 'block';
      reason: string;
    };

/**
 * Ranks the three authority buckets so "ahead"/"behind" is a plain integer
 * comparison. `legacy_restored` and `localStorage` both collapse to
 * `legacy`, exactly as `familyAuthorityNormalizer.ts` collapses them when it
 * derives `markerState`/`pointerState` — this function is only ever called
 * on a disagreement that normalizer already found, so the mapping must
 * agree with it or a rank comparison here could disagree with the reason it
 * is deciding about.
 */
function rankOf(
  authority:
    | AuthorityMarkerView['authority']
    | AuthorityPointerView['authority']
): 0 | 1 | 2 {
  if (authority === 'indexedDB') return 1;
  if (authority === 'postgres') return 2;
  return 0; // 'localStorage' | 'legacy_restored'
}

/**
 * The single function permitted to decide whether an `inconsistent`
 * authority (`familyAuthorityNormalizer.ts`) may be resolved, and to what.
 *
 * It never writes anything — a `{action: 'repair', ...}` result tells the
 * caller what to write, and a `{action: 'block', ...}` result means the
 * caller MUST refuse: continuing anyway, or treating a block as a resolved
 * state, silently adopts whichever side of the disagreement the caller
 * guessed was right. See spec R5b: "a pointer is only ever advanced by an
 * operation that also wrote the documents" — the asymmetry that makes a
 * pointer-ahead trustworthy (once verified) and a marker-ahead never
 * trustworthy at all.
 */
export async function decideAuthorityRepair(input: {
  reason: NormalizedAuthorityInconsistent['reason'];
  observed: NormalizedAuthorityInconsistent['observed'];
  evidence: AuthorityRepairEvidence;
}): Promise<AuthorityRepairOutcome> {
  const { reason, observed, evidence } = input;

  // R5b's table only ever resolves the two reasons that describe WHICH side
  // is ahead. `account-mismatch`, `campaign-mismatch` and
  // `incomplete-rollback` are different failure shapes entirely — no
  // evidence this module can gather says which side of THOSE is right, so
  // they always block. Listed explicitly (not `else`) so a future reason
  // added to the union must be triaged here rather than silently falling
  // into a resolvable branch.
  if (
    reason !== 'marker-pointer-disagreement' &&
    reason !== 'epoch-disagreement'
  ) {
    return {
      action: 'block',
      reason: `'${reason}' has no evidence-backed resolution; only a pointer/marker rank or epoch disagreement can be repaired`,
    };
  }

  // R5b row 4: "Epoch disagreement within one state. Block. Ambiguous in
  // both directions." Neither side's epoch is preferred — a higher epoch on
  // either side is not evidence of anything, only of a write that happened.
  if (reason === 'epoch-disagreement') {
    return {
      action: 'block',
      reason:
        'the marker and the pointer agree on which storage is authoritative but disagree on its epoch; this is ambiguous in both directions and cannot be repaired',
    };
  }

  const { marker, pointer } = observed;
  const markerRank = marker ? rankOf(marker.authority) : 0;
  const pointerRank = pointer ? rankOf(pointer.authority) : 0;

  // R5b row 1: "Pointer behind the marker. Block. A marker is a cheap write
  // with nothing behind it; a marker ahead is not evidence." Covers the
  // pointer being absent entirely (rank 0) as well as a real but lower-rank
  // pointer.
  if (pointerRank <= markerRank) {
    return {
      action: 'block',
      reason:
        'the pointer is not ahead of the marker; a marker with nothing behind it in IndexedDB is never evidence of a completed migration',
    };
  }

  // Only a pointer strictly ahead reaches here, and rankOf only ever
  // produces 1 (`indexedDB`) or 2 (`postgres`) for a rank greater than the
  // marker's — `legacy`/`localStorage` cannot rank ahead of anything.
  if (pointer!.authority === 'indexedDB') {
    const verified = await evidence.verifyIndexedDbGeneration();
    if (!verified)
      return {
        action: 'block',
        reason:
          'the prepared IndexedDB generation or its manifest documents could not be verified at the pointer',
      };
    return { action: 'repair', authority: 'indexedDB', epoch: pointer!.epoch };
  }

  // R5b row 3: pointer ahead at `postgres`.
  const verified = await evidence.verifyPostgresParity();
  if (!verified)
    return {
      action: 'block',
      reason:
        'the cloud generation does not satisfy exact document parity at the pointer epoch',
    };
  return { action: 'repair', authority: 'postgres', epoch: pointer!.epoch };
}
