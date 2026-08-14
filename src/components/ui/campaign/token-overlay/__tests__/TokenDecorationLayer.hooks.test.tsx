import { describe, expect, it } from 'vitest';
import {
  decoratedTokenKey,
  isDecoratedToken,
} from '../TokenDecorationLayer.hooks';
import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';
import type { CanvasElement } from '@fieldnotes/core';

function tokenElement(
  overrides: Partial<Record<string, unknown>> = {}
): CanvasElement {
  return {
    id: 'el-1',
    type: 'image',
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    src: 'a.png',
    zIndex: 1000,
    locked: false,
    layerId: 'layer-annotations',
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId: 'combatant-7',
    ...overrides,
  } as unknown as CanvasElement;
}

describe('decoratedTokenKey', () => {
  it('returns the entityId for a combatant token on a visible layer', () => {
    const match = decoratedTokenKey(() => true);
    expect(match(tokenElement())).toBe('combatant-7');
  });

  it('returns null for a non-token element', () => {
    const match = decoratedTokenKey(() => true);
    expect(
      match(tokenElement({ tokenKind: undefined, entityId: undefined }))
    ).toBeNull();
  });

  it('returns null when the element sits on an invisible layer', () => {
    const match = decoratedTokenKey(layerId => layerId !== 'layer-annotations');
    expect(match(tokenElement())).toBeNull();
  });

  it('returns null for an empty identity string', () => {
    // The old selectRects rejected '' via `if (!key) continue`. decorationKey
    // itself only checks `typeof === 'string'`, so without an explicit guard an
    // empty entityId would now be tracked and would collide in the decoration
    // map lookup.
    const match = decoratedTokenKey(() => true);
    expect(match(tokenElement({ entityId: '' }))).toBeNull();
  });
});

describe('isDecoratedToken', () => {
  it('is the boolean projection of decoratedTokenKey', () => {
    const visible = () => true;
    expect(isDecoratedToken(visible)(tokenElement())).toBe(true);
    expect(
      isDecoratedToken(visible)(tokenElement({ entityId: undefined }))
    ).toBe(false);
  });
});
