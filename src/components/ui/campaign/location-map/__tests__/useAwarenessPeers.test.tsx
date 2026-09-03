import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { PeerRoster } from '@fieldnotes/core';
import { useAwarenessPeers } from '../useAwarenessPeers';

describe('useAwarenessPeers', () => {
  it('returns [] for a null roster and the live snapshot otherwise; heartbeats do not re-render', () => {
    const roster = new PeerRoster();
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ r }: { r: PeerRoster | null }) => {
        renders++;
        return useAwarenessPeers(r);
      },
      { initialProps: { r: null as PeerRoster | null } }
    );
    expect(result.current).toEqual([]);
    rerender({ r: roster });
    const frame = {
      kind: 'awareness',
      id: 'char-a',
      name: 'A',
      role: 'player',
    };
    act(() => {
      roster.apply('c1', frame);
    });
    expect(result.current.map(p => p.id)).toEqual(['char-a']);
    const rendersAfterJoin = renders;
    act(() => {
      roster.apply('c1', frame); // identical heartbeat
    });
    expect(renders).toBe(rendersAfterJoin);
    act(() => {
      roster.remove('c1');
    });
    expect(result.current).toEqual([]);
    roster.dispose();
  });
});
