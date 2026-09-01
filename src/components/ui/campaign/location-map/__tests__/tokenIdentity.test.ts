import { describe, it, expect } from 'vitest';
import { createShape } from '@fieldnotes/core';
import { COMBATANT_TOKEN_KIND, movableTokenIdentity } from '../tokenIdentity';
import { PLAYER_TOKEN_KIND } from '../PlayerTokenTool';

function shape() {
  return createShape({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    shape: 'ellipse',
    strokeColor: '#000',
    strokeWidth: 1,
    fillColor: '#fff',
  });
}

describe('movableTokenIdentity', () => {
  it('resolves combatant tokens by entityId', () => {
    const el = { ...shape(), tokenKind: COMBATANT_TOKEN_KIND, entityId: 'e-1' };
    expect(movableTokenIdentity(el)).toEqual({ key: 'e-1', kind: 'combatant' });
  });

  it('resolves player tokens by characterId', () => {
    const el = { ...shape(), tokenKind: PLAYER_TOKEN_KIND, characterId: 'c-1' };
    expect(movableTokenIdentity(el)).toEqual({ key: 'c-1', kind: 'player' });
  });

  it('rejects plain elements, empty ids, and wrong-typed ids', () => {
    expect(movableTokenIdentity(shape())).toBeNull();
    expect(
      movableTokenIdentity({
        ...shape(),
        tokenKind: COMBATANT_TOKEN_KIND,
        entityId: '',
      })
    ).toBeNull();
    expect(
      movableTokenIdentity({
        ...shape(),
        tokenKind: PLAYER_TOKEN_KIND,
        characterId: 7,
      })
    ).toBeNull();
  });
});
