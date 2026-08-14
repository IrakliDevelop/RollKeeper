import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Viewport, createImage } from '@fieldnotes/core';
import { ViewportContext } from '@fieldnotes/react';
import {
  decoratedTokenKey,
  isDecoratedToken,
  useCompactReveal,
} from '../TokenDecorationLayer.hooks';
import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';
import type { CanvasElement } from '@fieldnotes/core';
import type { ReactNode } from 'react';

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

// jsdom has no canvas 2D context: stub `getContext` on any canvas the
// Viewport creates so construction and its render loop don't throw. Mirrors
// the seam in `selectionEvents.integration.test.tsx` — stub the browser API,
// never an @fieldnotes module. No @fieldnotes/core or @fieldnotes/react
// mocking anywhere in this file: `useCompactReveal` is exercised against a
// real Viewport and its real SDK hit-test.
function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 40 }),
        createLinearGradient: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D);
    }
    return el;
  });
}

/**
 * A real `Viewport` with a token element (image, COMBATANT_TOKEN_KIND +
 * entityId) on a LOCKED, non-active layer at world (0,0)-(40,40) — the
 * property under test, and the one a naive `getElementAt` call would break.
 * A second, non-token image sits on the SAME layer at a HIGHER zIndex,
 * covering the same point: without `resolveId`'s `match` option this cover
 * element would win the hit-test instead of the token, which is what makes
 * dropping `match` a meaningful mutation (see the mutation table below).
 */
function createTestViewportWithLockedTokenLayer(): Viewport {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  });
  document.body.appendChild(container);
  const vp = new Viewport(container);

  // LayerManager refuses to lock the active layer when no fallback layer
  // exists, so the token lives on a second, non-active layer that CAN be
  // locked (mirrors packages/core's viewport-hit-test.test.ts fixture).
  const layerId = vp.layerManager.createLayer('tokens').id;
  expect(vp.layerManager.setLayerLocked(layerId, true)).toBe(true);
  expect(vp.layerManager.isLayerLocked(layerId)).toBe(true);

  vp.store.add({
    ...createImage({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      src: 'token.png',
      layerId,
    }),
    id: 'token-on-locked-layer',
    zIndex: 1000,
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId: 'combatant-locked-7',
  } as unknown as CanvasElement);

  vp.store.add({
    ...createImage({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      src: 'cover.png',
      layerId,
    }),
    id: 'covering-non-token',
    zIndex: 2000,
  } as unknown as CanvasElement);

  return vp;
}

describe('useCompactReveal', () => {
  let vp: Viewport | null = null;

  beforeEach(() => {
    stubCanvas();
  });

  afterEach(() => {
    vp?.destroy();
    vp = null;
    vi.restoreAllMocks();
  });

  it('reveals the token under the pointer via the SDK hit-test, on a LOCKED layer', () => {
    vp = createTestViewportWithLockedTokenLayer();
    const activeViewport = vp;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewportContext.Provider value={activeViewport}>
        {children}
      </ViewportContext.Provider>
    );
    const { result } = renderHook(
      () => useCompactReveal('compact', () => true),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 20,
          clientY: 20,
          bubbles: true,
        })
      );
    });

    expect(result.current.activeId).toBe('token-on-locked-layer');
  });
});
