import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useBattleMapPokes } from '@/hooks/useBattleMapPokes';
import { createBattleMapPokeListener } from '@/lib/battlemapPokeListener';

vi.mock('@/lib/battlemapPokeListener', () => ({
  createBattleMapPokeListener: vi.fn(),
}));

const mockCreateListener = vi.mocked(createBattleMapPokeListener);

type Props = Parameters<typeof useBattleMapPokes>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    campaignCode: 'ABCD',
    battleMapId: 'map-1',
    tokenRequest: { role: 'player', playerId: 'char-1' },
    onPoke: vi.fn(),
    ...overrides,
  };
}

describe('useBattleMapPokes', () => {
  beforeEach(() => {
    mockCreateListener.mockReset();
  });

  it('starts the listener once all params are non-null, with the right options', () => {
    const stop = vi.fn();
    mockCreateListener.mockReturnValue(stop);
    const props = makeProps();

    renderHook(p => useBattleMapPokes(p), { initialProps: props });

    expect(mockCreateListener).toHaveBeenCalledTimes(1);
    const opts = mockCreateListener.mock.calls[0][0];
    expect(opts.campaignCode).toBe('ABCD');
    expect(opts.battleMapId).toBe('map-1');
    expect(opts.tokenRequest).toEqual({ role: 'player', playerId: 'char-1' });
    expect(typeof opts.onPoke).toBe('function');
  });

  it('never creates a listener when battleMapId is null', () => {
    const props = makeProps({ battleMapId: null });

    renderHook(p => useBattleMapPokes(p), { initialProps: props });

    expect(mockCreateListener).not.toHaveBeenCalled();
  });

  it('stops the old listener and starts a new one when battleMapId changes', () => {
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    mockCreateListener.mockReturnValueOnce(stop1).mockReturnValueOnce(stop2);
    const props = makeProps();

    const { rerender } = renderHook(p => useBattleMapPokes(p), {
      initialProps: props,
    });
    expect(mockCreateListener).toHaveBeenCalledTimes(1);

    rerender({ ...props, battleMapId: 'map-2' });

    expect(stop1).toHaveBeenCalledTimes(1);
    expect(mockCreateListener).toHaveBeenCalledTimes(2);
    expect(mockCreateListener.mock.calls[1][0].battleMapId).toBe('map-2');
    expect(stop2).not.toHaveBeenCalled();
  });

  it('stops the listener on unmount', () => {
    const stop = vi.fn();
    mockCreateListener.mockReturnValue(stop);
    const props = makeProps();

    const { unmount } = renderHook(p => useBattleMapPokes(p), {
      initialProps: props,
    });
    unmount();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('does not rebuild on onPoke identity change, but pokes reach the newest callback (latest-ref pin)', () => {
    const stop = vi.fn();
    mockCreateListener.mockReturnValue(stop);
    const onPokeFirst = vi.fn();
    const props = makeProps({ onPoke: onPokeFirst });

    const { rerender } = renderHook(p => useBattleMapPokes(p), {
      initialProps: props,
    });
    expect(mockCreateListener).toHaveBeenCalledTimes(1);

    const onPokeSecond = vi.fn();
    rerender({ ...props, onPoke: onPokeSecond });

    // No rebuild: still just the one call, no new stop.
    expect(mockCreateListener).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    // Firing the poke callback captured at creation time must reach the
    // LATEST onPoke, not the one that was live when the listener was built.
    const capturedOnPoke = mockCreateListener.mock.calls[0][0].onPoke;
    capturedOnPoke('initiative');

    expect(onPokeFirst).not.toHaveBeenCalled();
    expect(onPokeSecond).toHaveBeenCalledWith('initiative');
  });
});
