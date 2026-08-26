import { describe, it, expect } from 'vitest';
import { DISPLAY_FOCUS_OPTIONS } from '../focusOptions';

/**
 * Regression coverage for the DM-targets-the-TV-and-moves-every-player
 * hazard (Task 13 final review, I3): the display page's single
 * `attachFocusReceiver` call site now passes this named constant instead of
 * an inline `{ role: 'display', ... }` literal, so the role it actually
 * wires up at runtime is exactly what this test asserts on. No test file
 * previously existed for this page at all.
 *
 * Mutation-verified: swapping this file's `'display'` for `'player'` (the
 * player canvas's role) fails this assertion.
 */
describe('battle map display page focus receive-site role', () => {
  it('is display, not player — a DM targeting the TV must never move every player camera instead', () => {
    expect(DISPLAY_FOCUS_OPTIONS.role).toBe('display');
  });
});
