import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { handleEncounterPoke } from '../EncounterView';
import { useDebouncedRefetch } from '@/hooks/useDebouncedRefetch';

describe('handleEncounterPoke', () => {
  it('calls refresh on a players poke', () => {
    const refresh = vi.fn();
    handleEncounterPoke('players', refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignores an initiative poke — EncounterView authors initiative', () => {
    const refresh = vi.fn();
    handleEncounterPoke('initiative', refresh);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores unknown feature strings', () => {
    const refresh = vi.fn();
    handleEncounterPoke('something-else', refresh);
    expect(refresh).not.toHaveBeenCalled();
  });
});

// EncounterView routes the 'players' poke through
// `useDebouncedRefetch(refreshPlayers)` before handleEncounterPoke — a burst
// of pokes (one per party member autosave) must coalesce into a single
// immediate underlying refresh plus one trailing refresh at window expiry,
// not one uncoalesced fetch per poke.
describe('EncounterView poke wiring (debounced path)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a burst of two players pokes yields one immediate underlying call and one trailing call after 1s', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useDebouncedRefetch(refresh));

    act(() => {
      handleEncounterPoke('players', result.current);
      handleEncounterPoke('players', result.current);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
