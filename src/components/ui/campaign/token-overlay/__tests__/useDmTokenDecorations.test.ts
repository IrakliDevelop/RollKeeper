import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useDmTokenDecorations } from '@/components/ui/campaign/token-overlay/useDmTokenDecorations';

import type { EncounterEntity } from '@/types/encounter';

const entity = (o: Partial<EncounterEntity>): EncounterEntity =>
  ({
    id: 'e1',
    type: 'monster',
    name: 'Ogre',
    initiative: null,
    initiativeModifier: 0,
    currentHp: 36,
    maxHp: 60,
    tempHp: 0,
    armorClass: 11,
    conditions: [],
    ...o,
  }) as EncounterEntity;

describe('useDmTokenDecorations', () => {
  it('maps exact HP with tier and real name', () => {
    const { result } = renderHook(() => useDmTokenDecorations([entity({})]));
    const d = result.current.get('e1');
    expect(d?.name).toBe('Ogre');
    expect(d?.hp).toEqual({
      kind: 'exact',
      current: 36,
      max: 60,
      percent: 60,
      tier: 'mid',
    });
    expect(d?.isDead).toBe(false);
  });

  it('flags dead at 0 HP', () => {
    const { result } = renderHook(() =>
      useDmTokenDecorations([entity({ currentHp: 0 })])
    );
    expect(result.current.get('e1')?.isDead).toBe(true);
  });

  it('double-keys player entities under playerCharacterId', () => {
    const { result } = renderHook(() =>
      useDmTokenDecorations([
        entity({ type: 'player', playerCharacterId: 'char-9' }),
      ])
    );
    expect(result.current.get('char-9')).toBe(result.current.get('e1'));
  });

  it('skips lair entities', () => {
    const { result } = renderHook(() =>
      useDmTokenDecorations([entity({ type: 'lair', maxHp: 0 })])
    );
    expect(result.current.size).toBe(0);
  });

  it('carries chessPiece and color through as chessPiece/pieceColor', () => {
    const { result } = renderHook(() =>
      useDmTokenDecorations([entity({ chessPiece: 'rook', color: '#a855f7' })])
    );
    const d = result.current.get('e1');
    expect(d?.chessPiece).toBe('rook');
    expect(d?.pieceColor).toBe('#a855f7');
  });

  it('leaves chessPiece/pieceColor undefined when unset', () => {
    const { result } = renderHook(() => useDmTokenDecorations([entity({})]));
    const d = result.current.get('e1');
    expect(d?.chessPiece).toBeUndefined();
    expect(d?.pieceColor).toBeUndefined();
  });
});
