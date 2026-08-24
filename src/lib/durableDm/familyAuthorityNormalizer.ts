export interface AuthorityMarkerView {
  authority: 'localStorage' | 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  /** Only the combat_log_archive dialect carries one. */
  accountId?: string;
}

export interface AuthorityPointerView {
  authority: 'localStorage' | 'indexedDB' | 'postgres';
  epoch: number;
}

export type NormalizedAuthorityState =
  | 'legacy'
  | 'indexedDB'
  | 'postgres'
  | 'inconsistent';

export interface NormalizedAuthority {
  state: NormalizedAuthorityState;
  epoch: number;
  campaignId: string | null;
  accountId: string | null;
  rolledBack: boolean;
  reason?:
    | 'account-mismatch'
    | 'campaign-mismatch'
    | 'marker-pointer-disagreement'
    | 'epoch-disagreement'
    | 'incomplete-rollback';
  /**
   * The records exactly as they were observed. Task 13b's repair needs to know
   * WHICH side is ahead, and a bare `inconsistent` cannot say. Never used to
   * pick a winner here — only to let an evidence-backed repair decide.
   */
  observed?: {
    marker: AuthorityMarkerView | null;
    pointer: AuthorityPointerView | null;
  };
}

function blocked(
  reason: NonNullable<NormalizedAuthority['reason']>,
  observed: NormalizedAuthority['observed']
): NormalizedAuthority {
  return {
    state: 'inconsistent',
    epoch: 0,
    campaignId: null,
    accountId: null,
    rolledBack: false,
    reason,
    observed,
  };
}

/**
 * Reduces the three marker dialects and the IndexedDB pointer to one shape.
 *
 * A disagreement is never resolved by preferring one source: five of the six
 * markers carry no account, so the pointer — read under `user:<accountId>` — is
 * the only thing that establishes ownership, and a marker that outruns it means
 * a run stopped between two writes. The caller must block that family rather
 * than migrate it a second time or claim it is already migrated.
 */
export function normalizeFamilyAuthority(input: {
  marker: AuthorityMarkerView | null;
  pointer: AuthorityPointerView | null;
  accountId: string;
  campaignId: string;
}): NormalizedAuthority {
  const { marker, pointer, accountId, campaignId } = input;
  const observed = { marker, pointer };

  if (marker) {
    if (marker.accountId !== undefined && marker.accountId !== accountId)
      return blocked('account-mismatch', observed);
    if (marker.campaignId !== campaignId)
      return blocked('campaign-mismatch', observed);
  }

  const markerState = !marker
    ? 'legacy'
    : marker.authority === 'legacy_restored' ||
        marker.authority === 'localStorage'
      ? 'legacy'
      : marker.authority;
  const pointerState = !pointer
    ? 'legacy'
    : pointer.authority === 'localStorage'
      ? 'legacy'
      : pointer.authority;

  if (markerState !== pointerState)
    return blocked('marker-pointer-disagreement', observed);
  if (marker && pointer && marker.epoch !== pointer.epoch)
    return blocked('epoch-disagreement', observed);

  const epoch = marker?.epoch ?? pointer?.epoch ?? 0;

  // Both records agree that the family is legacy, but only one of them exists
  // at an epoch above zero. That is a rollback that got half-written, not a
  // family that was never migrated: at epoch > 0 a legacy state requires both
  // records to say so. Accepting it would re-migrate over a half-rolled-back
  // family.
  if (markerState === 'legacy' && epoch > 0 && (!marker || !pointer))
    return blocked('incomplete-rollback', observed);

  return {
    state: markerState,
    epoch,
    campaignId: marker?.campaignId ?? (pointer ? campaignId : null),
    accountId: marker?.accountId ?? (pointer ? accountId : null),
    // `legacy_restored` is the five-family dialect for "rolled back"; the
    // combat log dialect says it by returning to localStorage at a new epoch.
    rolledBack: markerState === 'legacy' && epoch > 0,
  };
}
