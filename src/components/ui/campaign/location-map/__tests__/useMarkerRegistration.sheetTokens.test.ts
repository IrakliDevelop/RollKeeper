import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  ActivationOptions,
  CanvasElement,
  ElementActivationEvent,
} from '@fieldnotes/core';

import {
  useMarkerRegistration,
  type MarkerRegistrationViewport,
} from '../useMarkerRegistration';
import { MARKER_HTML_TYPE } from '../markerData';

function recordingViewport() {
  const calls: { options: ActivationOptions | null }[] = [];
  let listener: ((e: ElementActivationEvent) => void) | null = null;
  const viewport: MarkerRegistrationViewport = {
    expectCanvasHtmlTypes: () => () => {},
    registerHtmlPainter: () => () => {},
    setActivation: options => {
      calls.push({ options });
      return () => {};
    },
    onElementActivate: l => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const fire = (element: CanvasElement, gesture: 'single' | 'double') =>
    listener?.({
      element,
      world: { x: 0, y: 0 },
      pointerType: 'mouse',
      gesture,
    });
  return { viewport, calls, fire };
}

const marker = {
  id: 'm1',
  type: 'html',
  htmlType: MARKER_HTML_TYPE,
} as unknown as CanvasElement;
const ownToken = {
  id: 't1',
  type: 'shape',
  tokenKind: 'player',
  characterId: 'c1',
} as unknown as CanvasElement;
const other = { id: 'x1', type: 'shape' } as unknown as CanvasElement;

describe('useMarkerRegistration sheetTokens', () => {
  it('resolves double for sheet tokens and the surface gesture for markers', () => {
    const { viewport, calls } = recordingViewport();
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        sheetTokens: {
          isActivatable: el => el.id === 't1',
          onActivate: vi.fn(),
        },
      })
    );
    const resolve = calls[0].options!.gesture as (
      el: CanvasElement
    ) => string | null;
    expect(resolve(marker)).toBe('single');
    expect(resolve(ownToken)).toBe('double');
    expect(resolve(other)).toBeNull();
  });

  it('routes a sheet-token activation to sheetTokens.onActivate only', () => {
    const { viewport, fire } = recordingViewport();
    const onMarker = vi.fn();
    const onSheet = vi.fn();
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        onActivateMarker: onMarker,
        sheetTokens: {
          isActivatable: el => el.id === 't1',
          onActivate: onSheet,
        },
      })
    );
    fire(ownToken, 'double');
    expect(onSheet).toHaveBeenCalledTimes(1);
    expect(onMarker).not.toHaveBeenCalled();
  });

  it('ignores sheet-token activations while a writing tool suppresses activation', () => {
    const { viewport, fire } = recordingViewport();
    const onSheet = vi.fn();
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        isActivationSuppressed: () => true,
        sheetTokens: { isActivatable: () => true, onActivate: onSheet },
      })
    );
    fire(ownToken, 'double');
    expect(onSheet).not.toHaveBeenCalled();
  });

  it('keeps activation disabled when gesture is null', () => {
    const { viewport, calls } = recordingViewport();
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: null,
        sheetTokens: { isActivatable: () => true, onActivate: vi.fn() },
      })
    );
    expect(calls).toHaveLength(0);
  });
});
