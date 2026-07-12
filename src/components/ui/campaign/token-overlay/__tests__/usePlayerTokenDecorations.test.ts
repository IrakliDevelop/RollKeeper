import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePlayerTokenDecorations } from '@/components/ui/campaign/token-overlay/usePlayerTokenDecorations';

import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

const enemy = (o: Partial<SharedTurnEntry> = {}): SharedTurnEntry => ({
  entityId: 'e1',
  displayName: 'Enemy',
  type: 'monster',
  ...o,
});

const state = (
  enemyHpMode: SharedInitiativeState['enemyHpMode'],
  entries: SharedTurnEntry[]
): SharedInitiativeState =>
  ({
    encounterId: 'enc',
    isActive: true,
    round: 1,
    currentEntityId: null,
    turnOrder: entries,
    enemyHpMode,
  }) as SharedInitiativeState;

describe('usePlayerTokenDecorations', () => {
  it('returns an empty map without shared initiative', () => {
    const { result } = renderHook(() => usePlayerTokenDecorations(null));
    expect(result.current.size).toBe(0);
  });

  it("mode 'off': name only, no hp", () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(state('off', [enemy({ hpTier: 'mid' })]))
    );
    expect(result.current.get('e1')).toEqual({
      name: 'Enemy',
      hp: undefined,
      isDead: false,
    });
  });

  it("mode 'label': tier-colored state chip", () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(
        state('label', [enemy({ hpState: 'Bloodied', hpTier: 'low' })])
      )
    );
    expect(result.current.get('e1')?.hp).toEqual({
      kind: 'label',
      text: 'Bloodied',
      tier: 'low',
    });
  });

  it("modes 'bar' and 'percent': percent bar from hpPercent", () => {
    for (const mode of ['bar', 'percent'] as const) {
      const { result } = renderHook(() =>
        usePlayerTokenDecorations(
          state(mode, [enemy({ hpPercent: 40, hpTier: 'mid' })])
        )
      );
      expect(result.current.get('e1')?.hp).toEqual({
        kind: 'bar',
        percent: 40,
        tier: 'mid',
      });
    }
  });

  it("mode 'exact': bar + numbers", () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(
        state('exact', [
          enemy({ currentHp: 12, maxHp: 48, hpTier: 'critical' }),
        ])
      )
    );
    expect(result.current.get('e1')?.hp).toEqual({
      kind: 'exact',
      current: 12,
      max: 48,
      percent: 25,
      tier: 'critical',
    });
  });

  it('players always get exact HP regardless of mode, and double-key', () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(
        state('off', [
          enemy({
            entityId: 'p1',
            type: 'player',
            displayName: 'Fjord',
            playerCharacterId: 'char-9',
            currentHp: 24,
            maxHp: 40,
          }),
        ])
      )
    );
    const d = result.current.get('p1');
    expect(d?.hp).toEqual({
      kind: 'exact',
      current: 24,
      max: 40,
      percent: 60,
      tier: 'mid',
    });
    expect(result.current.get('char-9')).toBe(d);
  });

  it('omits the hp row when the mode’s field is missing (stale share)', () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(state('label', [enemy({ hpTier: 'mid' })]))
    );
    expect(result.current.get('e1')?.hp).toBeUndefined();
  });

  it('carries isDead through', () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(state('off', [enemy({ isDead: true })]))
    );
    expect(result.current.get('e1')?.isDead).toBe(true);
  });

  it('maps chessPiece and tokenColor to chessPiece/pieceColor', () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(
        state('off', [enemy({ chessPiece: 'bishop', tokenColor: '#22c55e' })])
      )
    );
    const d = result.current.get('e1');
    expect(d?.chessPiece).toBe('bishop');
    expect(d?.pieceColor).toBe('#22c55e');
  });

  it('leaves chessPiece/pieceColor undefined when absent', () => {
    const { result } = renderHook(() =>
      usePlayerTokenDecorations(state('off', [enemy({})]))
    );
    const d = result.current.get('e1');
    expect(d?.chessPiece).toBeUndefined();
    expect(d?.pieceColor).toBeUndefined();
  });
});
