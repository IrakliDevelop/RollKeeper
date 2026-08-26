import { describe, it, expect } from 'vitest';
import { isLegacyOwnToken } from '../useOwnTokenBackfill';

import type { CanvasElement } from '@fieldnotes/core';

function el(overrides: Record<string, unknown>): CanvasElement {
  return {
    id: 'el-1',
    type: 'shape',
    position: { x: 0, y: 0 },
    zIndex: 0,
    locked: false,
    layerId: 'player-char-9',
    tokenKind: 'player',
    ...overrides,
  } as unknown as CanvasElement;
}

describe('isLegacyOwnToken', () => {
  it('matches a player-kind token on the own layer with no characterId', () => {
    expect(isLegacyOwnToken(el({}), 'char-9')).toBe(true);
  });

  it('rejects tokens on another layer', () => {
    expect(isLegacyOwnToken(el({ layerId: 'player-char-2' }), 'char-9')).toBe(
      false
    );
    expect(isLegacyOwnToken(el({ layerId: 'dm-layer' }), 'char-9')).toBe(false);
  });

  it('rejects already-stamped tokens and non-player kinds', () => {
    expect(isLegacyOwnToken(el({ characterId: 'char-9' }), 'char-9')).toBe(
      false
    );
    expect(isLegacyOwnToken(el({ tokenKind: 'combatant' }), 'char-9')).toBe(
      false
    );
    expect(isLegacyOwnToken(el({ tokenKind: undefined }), 'char-9')).toBe(
      false
    );
  });
});
