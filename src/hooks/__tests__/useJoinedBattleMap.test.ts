import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useJoinedBattleMap,
  markBattleMapJoined,
} from '@/hooks/useJoinedBattleMap';

describe('useJoinedBattleMap', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts unjoined and flips after markJoined', () => {
    const { result } = renderHook(() => useJoinedBattleMap('map-1'));
    expect(result.current.joined).toBe(false);
    act(() => result.current.markJoined());
    expect(result.current.joined).toBe(true);
  });

  it('persists across remounts (reload)', () => {
    markBattleMapJoined('map-1');
    const { result } = renderHook(() => useJoinedBattleMap('map-1'));
    expect(result.current.joined).toBe(true);
  });

  it('a different live map id is NOT considered joined', () => {
    markBattleMapJoined('map-1');
    const { result } = renderHook(() => useJoinedBattleMap('map-2'));
    expect(result.current.joined).toBe(false);
  });

  it('null map id is never joined and markJoined is a no-op', () => {
    const { result } = renderHook(() => useJoinedBattleMap(null));
    expect(result.current.joined).toBe(false);
    act(() => result.current.markJoined());
    expect(result.current.joined).toBe(false);
    expect(window.localStorage.getItem('rollkeeper-joined-battlemap')).toBe(
      null
    );
  });
});
