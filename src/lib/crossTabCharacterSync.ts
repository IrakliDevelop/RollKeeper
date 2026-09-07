import { CHARACTER_ENVELOPE_KEY_PREFIX } from '@/utils/constants';
import { isStrictlyFresher } from '@/lib/characterFreshness';
import type { IntentWatermark } from '@/lib/characterCanonicalStorage';
import type { CharacterState } from '@/types/character';

interface CharacterStoreLike {
  getState: () => {
    character: CharacterState;
    loadCharacterState: (characterState: CharacterState) => void;
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

    const { character, loadCharacterState } = store.getState();
    if (incomingCharacter.id !== character.id) return;
    if (!isStrictlyFresher(incomingCharacter, character)) return;

    loadCharacterState(incomingCharacter);
    // `recordAppliedTransfer` alone never bumps the character's revision (it
    // doesn't touch `character`), so a write it triggers on its own would
    // fail the `isStrictlyFresher` gate above and never reach here — but in
    // practice it's always immediately followed, in the same tick, by the
    // CANONICAL item-add action for the same transfer, which does bump the
    // revision. That second write's envelope already reflects the ledger
    // update, so this branch (reached via the item-add's fresher character)
    // is where a follower's local ledger actually converges.
    store.setState({
      intentWatermarks: incomingWatermarks,
      appliedTransferIds: incomingAppliedTransferIds,
    });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
