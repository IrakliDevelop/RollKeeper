import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayerMapToolControls } from '../PlayerMapToolControls';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setupViewport() {
  const viewport = Object.assign(new EventTarget(), {
    width: 1366,
    offsetTop: 0,
    offsetLeft: 0,
  });
  vi.stubGlobal('visualViewport', viewport);
  let pendingFrame: FrameRequestCallback | undefined;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 1;
    })
  );
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const flushFrame = () => {
    const callback = pendingFrame;
    pendingFrame = undefined;
    act(() => callback?.(0));
  };
  return { viewport, flushFrame, cancel };
}

function renderControls() {
  return render(
    <PlayerMapToolControls>
      <button>Place token</button>
      <button>Spell template</button>
    </PlayerMapToolControls>
  );
}

describe('PlayerMapToolControls', () => {
  it('follows keyboard panning and restores the toolbar after dismissal', () => {
    const { viewport, flushFrame } = setupViewport();
    renderControls();
    const controls = screen.getByTestId('player-map-tool-controls');
    expect(controls.style.top).toBe('calc(0px + 0.75rem)');
    viewport.offsetTop = 280;
    viewport.dispatchEvent(new Event('scroll'));
    flushFrame();
    expect(controls.style.top).toBe('calc(280px + 0.75rem)');

    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    flushFrame();
    expect(controls.style.top).toBe('calc(0px + 0.75rem)');
    expect(screen.getByRole('button', { name: 'Place token' })).toBeVisible();
  });

  it('centers within the visible width after zoom, horizontal pan, and rotation', () => {
    const { viewport, flushFrame } = setupViewport();
    renderControls();
    const controls = screen.getByTestId('player-map-tool-controls');
    viewport.width = 683;
    viewport.offsetLeft = 200;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(controls.style.left).toBe('541.5px');
    expect(controls.style.maxWidth).toBe('calc(683px - 1.5rem)');

    viewport.width = 1024;
    viewport.offsetLeft = 0;
    viewport.dispatchEvent(new Event('resize'));
    flushFrame();
    expect(controls.style.left).toBe('512px');
    expect(controls.style.maxWidth).toBe('calc(1024px - 1.5rem)');
  });

  it('refreshes on page restoration and cleans up pending updates on navigation', () => {
    const { viewport, flushFrame, cancel } = setupViewport();
    const { unmount } = renderControls();
    viewport.offsetTop = 100;
    window.dispatchEvent(new Event('pageshow'));
    flushFrame();
    expect(screen.getByTestId('player-map-tool-controls').style.top).toBe(
      'calc(100px + 0.75rem)'
    );

    viewport.dispatchEvent(new Event('scroll'));
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);
    vi.mocked(requestAnimationFrame).mockClear();
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('pageshow'));
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('keeps controls available with CSS positioning without VisualViewport', () => {
    vi.stubGlobal('visualViewport', undefined);
    renderControls();
    expect(screen.getByRole('button', { name: 'Place token' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Spell template' })
    ).toBeVisible();
    expect(screen.getByTestId('player-map-tool-controls')).not.toHaveAttribute(
      'style'
    );
  });
});
