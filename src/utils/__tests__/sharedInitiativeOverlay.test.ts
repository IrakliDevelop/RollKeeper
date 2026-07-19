import { describe, it, expect } from 'vitest';
import { overlayLiveHp } from '@/utils/sharedInitiativeOverlay';
import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

function makeState(entries: Partial<SharedTurnEntry>[]): SharedInitiativeState {
  return {
    encounterId: 'enc-1',
    isActive: true,
    round: 1,
    currentEntityId: null,
    enemyHpMode: 'off',
    turnOrder: entries.map((e, i) => ({
      entityId: `e${i}`,
      displayName: `E${i}`,
      type: 'player',
      ...e,
    })) as SharedTurnEntry[],
  } as SharedInitiativeState;
}

describe('overlayLiveHp', () => {
  it('replaces player-row HP with live values and derives isDead', () => {
    const state = makeState([
      { playerCharacterId: 'char-a', currentHp: 44, maxHp: 44, isDead: false },
    ]);
    const out = overlayLiveHp(state, { 'char-a': { current: 0, max: 44 } })!;
    expect(out.turnOrder[0].currentHp).toBe(0);
    expect(out.turnOrder[0].maxHp).toBe(44);
    expect(out.turnOrder[0].isDead).toBe(true);
  });

  it('leaves non-player rows untouched even on characterId collision', () => {
    const state = makeState([
      { type: 'monster', playerCharacterId: undefined, hpPercent: 80 },
    ]);
    const out = overlayLiveHp(state, { e0: { current: 1, max: 10 } })!;
    expect(out.turnOrder[0]).toEqual(state.turnOrder[0]);
  });

  it('leaves player rows without a live entry untouched', () => {
    const state = makeState([
      { playerCharacterId: 'char-b', currentHp: 20, maxHp: 30 },
    ]);
    const out = overlayLiveHp(state, {})!;
    expect(out.turnOrder[0].currentHp).toBe(20);
  });

  it('passes null through', () => {
    expect(overlayLiveHp(null, {})).toBeNull();
  });
});
