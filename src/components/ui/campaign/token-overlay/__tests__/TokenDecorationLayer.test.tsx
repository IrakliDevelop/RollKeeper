import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

import { TokenDecorationLayer } from '@/components/ui/campaign/token-overlay';
import { decorationKey } from '@/components/ui/campaign/token-overlay/TokenDecorationLayer.hooks';

import type { CanvasElement } from '@fieldnotes/core';
import type { TokenDecoration } from '@/components/ui/campaign/token-overlay';

let mockElements: CanvasElement[] = [];
let mockCamera = { x: 0, y: 0, zoom: 1 };

vi.mock('@fieldnotes/react', () => ({
  useCamera: () => mockCamera,
  useViewport: () => ({ toolContext: { gridSize: 40, gridType: 'square' } }),
  useElements: (selector: (els: CanvasElement[]) => unknown) =>
    selector(mockElements),
}));

function tokenEl(overrides: Record<string, unknown> = {}): CanvasElement {
  return {
    id: 'el-1',
    type: 'shape',
    position: { x: 100, y: 200 },
    size: { w: 40, h: 40 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    entityId: 'ent-1',
    tokenKind: 'combatant',
    ...overrides,
  } as unknown as CanvasElement;
}

const deco = (d: Partial<TokenDecoration> = {}): Map<string, TokenDecoration> =>
  new Map([['ent-1', { name: 'Ogre', ...d }]]);

describe('decorationKey', () => {
  it('maps combatant tokens to entityId and player tokens to characterId', () => {
    expect(decorationKey(tokenEl())).toBe('ent-1');
    expect(
      decorationKey(
        tokenEl({
          tokenKind: 'player',
          characterId: 'char-9',
          entityId: undefined,
        })
      )
    ).toBe('char-9');
    expect(decorationKey(tokenEl({ tokenKind: undefined }))).toBeNull();
  });
});

describe('TokenDecorationLayer', () => {
  beforeEach(() => {
    mockElements = [tokenEl()];
    mockCamera = { x: 0, y: 0, zoom: 1 };
  });

  afterEach(() => cleanup());

  it('positions the HP bar inside the token rect, flush to its bottom edge', () => {
    render(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'bar', percent: 50, tier: 'mid' },
        })}
        mode="full"
      />
    );
    // 40px token at (100, 200): inset = max(2, 0.05*40) = 2,
    // barHeight = 0.12*40 = 4.8.
    // left = 100 + 2 = 102, width = 40 - 2*2 = 36,
    // top = 200 + 40 - 4.8 - 2 = 233.2
    const bar = screen.getByRole('progressbar', { hidden: true });
    expect(bar.style.left).toBe('102px');
    expect(bar.style.width).toBe('36px');
    expect(bar.style.top).toBe('233.2px');
    expect(bar.style.height).toBe('4.8px');
  });

  it('renders the name chip centered below the token in full mode', () => {
    const { container } = render(
      <TokenDecorationLayer decorations={deco()} mode="full" />
    );
    expect(screen.getByText('Ogre')).toBeInTheDocument();
    const item = screen.getByText('Ogre').parentElement as HTMLElement;
    // top = y + h + 0.06*cell = 200 + 40 + 2.4
    expect(item.style.top).toBe('242.4px');
    // camera transform applied once at the layer root
    const transformed = container.querySelector(
      '[style*="translate3d"]'
    ) as HTMLElement;
    expect(transformed.style.transform).toContain('scale(1)');
  });

  it('sizes the chip row to its content and centers it under the token, unclipped', () => {
    render(<TokenDecorationLayer decorations={deco()} mode="full" />);
    const item = screen.getByText('Ogre').parentElement as HTMLElement;
    expect(item.style.width).toBe('max-content');
    expect(item.style.maxWidth).toBe('160px'); // 4 * 40
    expect(item.style.transform).toBe('translateX(-50%)');
    expect(item.style.left).toBe('120px'); // rect.x + rect.w / 2
  });

  it('renders a long name in full without clipping the text content', () => {
    render(
      <TokenDecorationLayer
        decorations={deco({ name: 'Vecna the Archlich Supreme' })}
        mode="full"
      />
    );
    expect(screen.getByText('Vecna the Archlich Supreme')).toBeInTheDocument();
  });

  it('renders nothing when off, or when the key has no decoration', () => {
    const hidden = render(
      <TokenDecorationLayer decorations={deco()} mode="off" />
    );
    expect(hidden.container).toBeEmptyDOMElement();
    cleanup();
    render(<TokenDecorationLayer decorations={new Map()} mode="full" />);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });

  it('full mode shows the bar plus name + exact-numbers chip side by side', () => {
    const { rerender } = render(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'exact', percent: 50, tier: 'mid', current: 30, max: 60 },
        })}
        mode="full"
      />
    );
    expect(screen.getByRole('progressbar', { hidden: true })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
    expect(screen.getByText('Ogre')).toBeInTheDocument();
    expect(screen.getByText('30/60')).toBeInTheDocument();

    rerender(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'label', text: 'Bloodied', tier: 'low' },
        })}
        mode="full"
      />
    );
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
    // label kind has no percent to draw a bar with.
    expect(
      screen.queryByRole('progressbar', { hidden: true })
    ).not.toBeInTheDocument();
  });

  it('compact mode keeps the in-token bar but renders no chips', () => {
    render(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'exact', percent: 50, tier: 'mid', current: 30, max: 60 },
        })}
        mode="compact"
      />
    );
    expect(
      screen.getByRole('progressbar', { hidden: true })
    ).toBeInTheDocument();
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
    expect(screen.queryByText('30/60')).not.toBeInTheDocument();
  });

  it('compact mode renders nothing for label-kind hp (no percent to draw)', () => {
    const { container } = render(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'label', text: 'Bloodied', tier: 'low' },
        })}
        mode="compact"
      />
    );
    expect(screen.queryByText('Bloodied')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { hidden: true })
    ).not.toBeInTheDocument();
    // Only the (empty, opacity-wrapped) item div renders — no visible content.
    expect(container.querySelector('span')).not.toBeInTheDocument();
  });

  it('dead tokens show a skull centered inside the token, no bar, and in full mode still show the name chip below', () => {
    render(
      <TokenDecorationLayer
        decorations={deco({
          isDead: true,
          hp: { kind: 'bar', percent: 0, tier: 'critical' },
        })}
        mode="full"
      />
    );
    const skull = screen.getByText('☠️');
    expect(skull).toBeInTheDocument();
    // Centered inside the 40px token at (100, 200).
    expect(skull.style.left).toBe('100px');
    expect(skull.style.top).toBe('200px');
    expect(skull.style.width).toBe('40px');
    expect(skull.style.height).toBe('40px');
    expect(
      screen.queryByRole('progressbar', { hidden: true })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Ogre')).toBeInTheDocument();
  });

  it('dead tokens show the skull in compact mode too, with no chip row', () => {
    render(
      <TokenDecorationLayer
        decorations={deco({
          isDead: true,
          hp: { kind: 'bar', percent: 0, tier: 'critical' },
        })}
        mode="compact"
      />
    );
    expect(screen.getByText('☠️')).toBeInTheDocument();
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });

  it('keeps the chip row content-sized (not clamped to token width) on small tokens', () => {
    mockElements = [tokenEl({ size: { w: 20, h: 20 } })];
    render(<TokenDecorationLayer decorations={deco()} mode="full" />);
    const item = screen.getByText('Ogre').parentElement as HTMLElement;
    expect(item.style.width).toBe('max-content');
    expect(item.style.maxWidth).toBe('160px'); // 4 * cell, independent of token size
  });

  it('renders the chess piece icon centered in the token rect with its color, in full mode', () => {
    const { container } = render(
      <TokenDecorationLayer
        decorations={deco({ chessPiece: 'rook', pieceColor: '#a855f7' })}
        mode="full"
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.style.color).toBe('rgb(168, 85, 247)');
    // Centering wrapper matches the token rect at (100, 200), 40x40.
    const wrapper = svg?.parentElement as HTMLElement;
    expect(wrapper.style.left).toBe('100px');
    expect(wrapper.style.top).toBe('200px');
    expect(wrapper.style.width).toBe('40px');
    expect(wrapper.style.height).toBe('40px');
  });

  it('renders the chess piece in compact mode too', () => {
    const { container } = render(
      <TokenDecorationLayer
        decorations={deco({ chessPiece: 'pawn' })}
        mode="compact"
      />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('defaults the piece color to a neutral tone when pieceColor is absent', () => {
    const { container } = render(
      <TokenDecorationLayer
        decorations={deco({ chessPiece: 'pawn' })}
        mode="full"
      />
    );
    const svg = container.querySelector('svg');
    expect(svg?.style.color).toBe('rgb(226, 232, 240)'); // #e2e8f0
  });

  it('renders no piece icon when chessPiece is absent', () => {
    const { container } = render(
      <TokenDecorationLayer decorations={deco()} mode="full" />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('hides the piece icon (skull takes precedence) when the token is dead', () => {
    const { container } = render(
      <TokenDecorationLayer
        decorations={deco({
          chessPiece: 'king',
          isDead: true,
          hp: { kind: 'bar', percent: 0, tier: 'critical' },
        })}
        mode="full"
      />
    );
    expect(screen.getByText('☠️')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});

function firePointer(type: string, clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, { clientX, clientY }));
  });
}

describe('TokenDecorationLayer compact-mode reveal', () => {
  beforeEach(() => {
    mockElements = [tokenEl()];
    mockCamera = { x: 0, y: 0, zoom: 1 };
  });

  afterEach(() => cleanup());

  it('shows no chip row initially in compact mode', () => {
    render(<TokenDecorationLayer decorations={deco()} mode="compact" />);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });

  it('reveals the name chip on pointerdown inside the token, and hides it again on pointerdown outside', () => {
    render(<TokenDecorationLayer decorations={deco()} mode="compact" />);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();

    // Token at (100, 200), size 40x40, camera {x:0,y:0,zoom:1} — (120, 220) is inside.
    firePointer('pointerdown', 120, 220);
    expect(screen.getByText('Ogre')).toBeInTheDocument();

    // (10, 10) is well outside the token — clears the reveal.
    firePointer('pointerdown', 10, 10);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });

  it('accounts for camera pan/zoom when hit-testing pointerdown', () => {
    mockCamera = { x: 50, y: 0, zoom: 2 };
    render(<TokenDecorationLayer decorations={deco()} mode="compact" />);

    // World (120, 220) is inside the 40x40 token at (100,200).
    // screen = world*zoom + camera => clientX = 120*2+50 = 290, clientY = 220*2+0 = 440.
    firePointer('pointerdown', 290, 440);
    expect(screen.getByText('Ogre')).toBeInTheDocument();
  });

  it('reveals the name chip on hover (pointermove), throttled via rAF', () => {
    let pending: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pending = cb;
      return 99;
    });

    render(<TokenDecorationLayer decorations={deco()} mode="compact" />);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();

    // First pointermove schedules a frame
    firePointer('pointermove', 120, 220);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument(); // callback not run yet

    // Execute the pending callback
    act(() => {
      if (pending) pending(0);
    });
    expect(screen.getByText('Ogre')).toBeInTheDocument();

    // Second pointermove to different location schedules another frame
    pending = null;
    firePointer('pointermove', 10, 10);

    // Execute the pending callback
    act(() => {
      if (pending) pending(0);
    });
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('cancels pending rAF on hover when mode leaves compact', () => {
    let pendingCallback: FrameRequestCallback | null = null;
    const cancelSpy = vi.fn();

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pendingCallback = cb;
      return 42;
    });
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);

    const { rerender } = render(
      <TokenDecorationLayer decorations={deco()} mode="compact" />
    );
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();

    // Dispatch pointermove — schedules rAF with id 42, callback stored in pendingCallback.
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 120, clientY: 220 })
      );
    });
    expect(pendingCallback).not.toBeNull();

    // Switch to full mode — cleanup should cancel the pending frame.
    rerender(<TokenDecorationLayer decorations={deco()} mode="full" />);
    expect(cancelSpy).toHaveBeenCalledWith(42);

    // Simulate the pending callback running anyway (e.g. due to timing).
    // It should no longer surface the chip because the effect cleanup
    // has also cleared hover/revealed state.
    act(() => {
      if (pendingCallback) pendingCallback(0);
    });
    // In full mode, the name should show (not due to the stale callback,
    // but because full mode always renders it). If the callback had been
    // allowed to run without cancellation, it would have re-set hoveredId
    // after cleanup cleared it. Verify that doesn't happen by checking
    // the current state is consistent with full mode.
    expect(screen.getByText('Ogre')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('clears both hover and tap reveal state when leaving compact mode', () => {
    const { rerender } = render(
      <TokenDecorationLayer decorations={deco()} mode="compact" />
    );
    firePointer('pointerdown', 120, 220);
    expect(screen.getByText('Ogre')).toBeInTheDocument();

    rerender(<TokenDecorationLayer decorations={deco()} mode="full" />);
    expect(screen.getByText('Ogre')).toBeInTheDocument(); // full mode always shows it

    rerender(<TokenDecorationLayer decorations={deco()} mode="compact" />);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });
});
