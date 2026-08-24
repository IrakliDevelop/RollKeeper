export interface AuthorityMarkerView {
  authority: 'localStorage' | 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  /** Only the combat_log_archive dialect carries one. */
  accountId?: string;
}

/**
 * Not exported: only `toAuthorityPointerView` in this module can reference
 * this symbol, so it is the only function able to produce a value typed
 * `AuthorityPointerView`. See the brand field on that interface for why.
 */
declare const authorityPointerViewBrand: unique symbol;

export interface AuthorityPointerView {
  readonly authority: 'localStorage' | 'indexedDB' | 'postgres';
  readonly epoch: number;
  /**
   * Nominal brand, not a real field. Without it, `AuthorityPointerView` is
   * structurally just `{ authority, epoch }`, and every raw reader return
   * (`CampaignSettingsAuthority`, `NpcAuthority`, and the other four —
   * `src/lib/indexeddb/*Authority.ts`) is structurally assignable to that,
   * because it always carries at least those two fields. That would let a
   * call site pass a reader's return straight through as `pointer`, bypassing
   * `toAuthorityPointerView` entirely — silently reopening exactly the bug
   * fix round 1 closed: the reader never returns null, so a synthesized
   * `{authority:'localStorage', epoch}` default reads as a real record and
   * `incomplete-rollback`'s `!pointer` arm goes dead. The brand makes that
   * bypass a compile error instead of a runtime one six different adapter
   * implementers would each have to remember not to introduce.
   */
  readonly [authorityPointerViewBrand]: true;
}

/**
 * The shape every `read<Family>Authority(database, namespace, campaignId)`
 * reader returns (`src/lib/indexeddb/campaignSettingsAuthority.ts` and its five
 * siblings — `calendarAuthority.ts`, `magicItemAuthority.ts`, `npcAuthority.ts`,
 * `encounterAuthority.ts`, `combatLogArchiveAuthority.ts`). It is a
 * non-nullable Promise: when no `active-generation:<scope>` record exists in
 * IndexedDB, every one of the six readers synthesizes
 * `{ authority: 'localStorage', epoch: cutoverEpoch ?? 0 }` rather than
 * returning null or undefined. `toAuthorityPointerView` below is what turns
 * that synthesized default back into the `null` this module's contract
 * expects.
 */
export interface RawAuthorityPointerRecord {
  authority: 'localStorage' | 'indexedDB' | 'postgres';
  epoch: number;
  namespace?: string;
  campaignId?: string;
  family?: string;
  generation?: string;
  rollbackGeneration?: string;
  committedAt?: string;
}

/**
 * Maps a reader's non-nullable return to `AuthorityPointerView | null`,
 * returning `null` exactly when the record is the synthesized "no pointer
 * record exists" default.
 *
 * The discriminator is `namespace`: every real record — the routed
 * `indexedDB`/`postgres` union member written by `commit<Family>LocalCutover`,
 * and the rolled-back `localStorage` member written by
 * `rollback<Family>LocalAuthority` — always carries the scoping `namespace`
 * (alongside `campaignId`, `family`, and `committedAt`). The synthesized
 * default is exactly `{ authority: 'localStorage', epoch }` with none of
 * those fields, because it is assembled ad hoc from a missing `meta` lookup,
 * not read back from a record anyone wrote. `namespace` is present on every
 * write path and absent only on that synthesized default, which is why it is
 * the reliable discriminator rather than `family` or `committedAt` (equally
 * present on real records, but no more decisive).
 *
 * Without this mapping, a caller that passes a reader's return straight
 * through never sees a null pointer: `incomplete-rollback`'s `!pointer` half
 * would be dead code, and a `cutover-epoch:` key that outlives its pointer
 * record could synthesize a `{ localStorage, epoch > 0 }` default that reads
 * as a *completed* rollback when nothing ever wrote one.
 */
export function toAuthorityPointerView(
  record: RawAuthorityPointerRecord
): AuthorityPointerView | null {
  if (record.namespace === undefined) return null;
  // The only place in this module allowed to mint the brand: the plain
  // literal below has no `[authorityPointerViewBrand]` property, so a direct
  // `as AuthorityPointerView` is rejected as an insufficient-overlap
  // conversion. Routing through `unknown` is the standard, deliberate way to
  // assert a nominal brand once — everywhere else, only this function's own
  // return type carries the assertion.
  return {
    authority: record.authority,
    epoch: record.epoch,
  } as unknown as AuthorityPointerView;
}

export type NormalizedAuthorityState =
  | 'legacy'
  | 'indexedDB'
  | 'postgres'
  | 'inconsistent';

interface NormalizedAuthorityCommon {
  epoch: number;
  campaignId: string | null;
  accountId: string | null;
  rolledBack: boolean;
}

export interface NormalizedAuthorityResolved extends NormalizedAuthorityCommon {
  state: 'legacy' | 'indexedDB' | 'postgres';
}

export interface NormalizedAuthorityInconsistent
  extends NormalizedAuthorityCommon {
  state: 'inconsistent';
  reason:
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
  observed: {
    marker: AuthorityMarkerView | null;
    pointer: AuthorityPointerView | null;
  };
}

/**
 * Discriminated on `state`: only the `'inconsistent'` variant carries `reason`
 * and `observed`, and both are required there — every inconsistent result
 * routes through `blocked()`, which always supplies both, so the type says
 * what was already true rather than leaving Task 13b's repair to assert past
 * an optional field.
 */
export type NormalizedAuthority =
  | NormalizedAuthorityResolved
  | NormalizedAuthorityInconsistent;

function blocked(
  reason: NormalizedAuthorityInconsistent['reason'],
  observed: NormalizedAuthorityInconsistent['observed']
): NormalizedAuthorityInconsistent {
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
    // `legacy_restored` is unambiguously a rollback dialect at any epoch; the
    // combat log dialect says it only by returning to localStorage at a new
    // (non-zero) epoch — at epoch 0 that dialect means "never migrated".
    rolledBack:
      markerState === 'legacy' &&
      (marker?.authority === 'legacy_restored' || epoch > 0),
  };
}
