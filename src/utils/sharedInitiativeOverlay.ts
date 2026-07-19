import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

export interface LiveHp {
  current: number;
  max: number;
}

/**
 * Overlays live player HP (own characterStore + poke-fresh /party-hp data)
 * onto the DM-published initiative snapshot, so player-row HP does not wait
 * on the DM tab's poll→merge→push round trip. Only rows with
 * type === 'player' and a playerCharacterId are touched — enemy HP masking
 * (hpState/hpPercent/hpTier) is a DM privacy feature and must pass through
 * untouched.
 */
export function overlayLiveHp(
  state: SharedInitiativeState | null,
  liveHp: Record<string, LiveHp>
): SharedInitiativeState | null {
  if (!state) return state;
  let changed = false;
  const turnOrder = state.turnOrder.map((entry: SharedTurnEntry) => {
    if (entry.type !== 'player' || !entry.playerCharacterId) return entry;
    const live = liveHp[entry.playerCharacterId];
    if (!live) return entry;
    if (entry.currentHp === live.current && entry.maxHp === live.max) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      currentHp: live.current,
      maxHp: live.max,
      isDead: live.current <= 0,
    };
  });
  return changed ? { ...state, turnOrder } : state;
}
