import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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

  it('renders the name chip positioned under the token rect', () => {
    const { container } = render(
      <TokenDecorationLayer decorations={deco()} visible />
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

  it('renders nothing when hidden or when the key has no decoration', () => {
    const hidden = render(
      <TokenDecorationLayer decorations={deco()} visible={false} />
    );
    expect(hidden.container).toBeEmptyDOMElement();
    cleanup();
    render(<TokenDecorationLayer decorations={new Map()} visible />);
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });

  it('renders an exact bar with numbers, and a label chip for label mode', () => {
    const { rerender } = render(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'exact', percent: 50, tier: 'mid', current: 30, max: 60 },
        })}
        visible
      />
    );
    expect(screen.getByRole('progressbar', { hidden: true })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
    expect(screen.getByText('30/60')).toBeInTheDocument();
    rerender(
      <TokenDecorationLayer
        decorations={deco({
          hp: { kind: 'label', text: 'Bloodied', tier: 'low' },
        })}
        visible
      />
    );
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { hidden: true })
    ).not.toBeInTheDocument();
  });

  it('dead tokens show a skull instead of the HP row', () => {
    render(
      <TokenDecorationLayer
        decorations={deco({
          isDead: true,
          hp: { kind: 'bar', percent: 0, tier: 'critical' },
        })}
        visible
      />
    );
    expect(screen.getByText('☠️')).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { hidden: true })
    ).not.toBeInTheDocument();
  });

  it('clamps decoration width to 0.9×cell on small tokens', () => {
    mockElements = [tokenEl({ size: { w: 20, h: 20 } })];
    render(<TokenDecorationLayer decorations={deco()} visible />);
    const item = screen.getByText('Ogre').parentElement as HTMLElement;
    expect(item.style.width).toBe('36px'); // 0.9 × 40 > 20
  });
});
