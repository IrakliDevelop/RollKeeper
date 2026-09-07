import { CHARACTER_ENVELOPE_KEY_PREFIX } from '@/utils/constants';
import { isStrictlyFresher } from '@/lib/characterFreshness';
import {
  mergeAppliedTransferIds,
  type IntentWatermark,
} from '@/lib/characterCanonicalStorage';
import type { CharacterState } from '@/types/character';

interface CharacterStoreLike {
  getState: () => {
    character: CharacterState;
    loadCharacterState: (characterState: CharacterState) => void;
    appliedTransferIds: string[];
  };
  setState: (partial: {
    intentWatermarks: Record<string, IntentWatermark>;
    appliedTransferIds: string[];
  }) => void;
}

/**
 * Cross-tab character convergence over per-character envelope keys.
 * Adopt iff same character AND strictly fresher by (revision,
 * lastMutatedAt, lastMutatedBy). Under Web Locks only the leader writes,
 * so followers see strictly increasing revisions; the stamp tiebreak is
 * the no-locks / legacy safety net (spec §reduced guarantees).
 * Watermarks ride along so a later promotion starts from current dedup
 * state. loadCharacterState runs under withExternalApply — the adopted
 * revision/stamps are kept as-is (no bump, no echo loop).
 */
export function initCrossTabCharacterSync(
  store: CharacterStoreLike
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (
      !event.key ||
      !event.key.startsWith(CHARACTER_ENVELOPE_KEY_PREFIX) ||
      !event.newValue
    )
      return;

    let incomingCharacter: CharacterState | undefined;
    let incomingWatermarks: Record<string, IntentWatermark> = {};
    let incomingAppliedTransferIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      const state = (
        parsed as {
          state?: {
            character?: CharacterState;
            intentWatermarks?: Record<string, IntentWatermark>;
            appliedTransferIds?: string[];
          };
        } | null
      )?.state;
      incomingCharacter = state?.character;
      incomingWatermarks = state?.intentWatermarks ?? {};
      incomingAppliedTransferIds = state?.appliedTransferIds ?? [];
    } catch {
      return;
    }
    if (!incomingCharacter || typeof incomingCharacter.id !== 'string') return;

    const { character, loadCharacterState, appliedTransferIds } =
      store.getState();
    if (incomingCharacter.id !== character.id) return;
    if (!isStrictlyFresher(incomingCharacter, character)) return;

    loadCharacterState(incomingCharacter);
    // NOTE on when this branch actually carries a ledger update: recording
    // a transfer (`recordAppliedTransfer`) never bumps the character's
    // revision by itself — it doesn't touch `character` — so a write it
    // triggers alone fails the `isStrictlyFresher` gate above and never
    // reaches here. What DOES land here is whichever CANONICAL action for
    // the SAME transfer runs alongside it and bumps the revision: the
    // item-add (addInventoryItem/addMagicItem), which now runs BEFORE the
    // ledger record, so its own envelope is one write too early to carry
    // it; or, for a transfer with a cost, the LATER updateCurrency write,
    // whose envelope reflects everything accumulated in the leader's store
    // by that point, including the ledger update. A zero-cost gift/loot
    // transfer has no such later write in its own batch, so a follower
    // does not converge its ledger until some UNRELATED later mutation
    // happens to bump the revision again — harmless in practice (the
    // transfer typically clears the live queue via its own acknowledge
    // long before that matters), but worth knowing if this ever needs to
    // be tightened.
    //
    // Merge, never replace: `appliedTransferIds` is a real ledger now (not
    // just a monotonically-advancing map like intentWatermarks) —
    // `clearAppliedTransfer` actually removes entries, so replacing wholesale
    // could drop an id THIS tab still needs (its own stale `pending` batch
    // still holds that transfer) with one the incoming write simply hadn't
    // recorded yet (e.g. the leader is behind, or already cleared it after
    // its own successful acknowledge). Over-retaining an id costs nothing;
    // under-retaining re-applies (and, with a cost attached, re-charges) it.
    store.setState({
      intentWatermarks: incomingWatermarks,
      appliedTransferIds: mergeAppliedTransferIds(
        incomingAppliedTransferIds,
        appliedTransferIds
      ),
    });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
