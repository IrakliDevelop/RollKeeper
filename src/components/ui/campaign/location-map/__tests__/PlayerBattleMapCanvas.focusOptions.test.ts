import { describe, it, expect } from 'vitest';
import { PLAYER_FOCUS_OPTIONS } from '../PlayerBattleMapCanvas';

/**
 * Regression coverage for the DM-targets-the-TV-and-moves-every-player
 * hazard (Task 13 final review, I3): `PlayerBattleMapCanvas`'s single
 * `attachFocusReceiver` call site now passes this named constant instead of
 * an inline `{ role: 'player', ... }` literal, so the role it actually wires
 * up at runtime is exactly what this test asserts on — no separate render
 * harness needed (a full canvas render needs a live DOM canvas unavailable
 * in jsdom; see DmBattleMapCanvas.test.tsx's header comment for the same
 * constraint on the DM side).
 *
 * Mutation-verified: swapping this file's `'player'` for `'display'` (the
 * display page's role) fails this assertion.
 */
describe('PlayerBattleMapCanvas focus receive-site role', () => {
  it('is player, not display — swapping the two roles must move every player camera instead of none', () => {
    expect(PLAYER_FOCUS_OPTIONS.role).toBe('player');
  });
});
