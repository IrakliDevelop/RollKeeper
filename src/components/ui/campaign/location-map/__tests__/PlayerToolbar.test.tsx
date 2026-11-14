import type { ComponentProps, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import {
  BattleMapBootstrapPrivacyCover,
  PlayerToolbar,
} from '@/components/ui/campaign/location-map/PlayerBattleMapCanvas';
import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { CanvasElement } from '@fieldnotes/core';

let mockElements: CanvasElement[] = [];

vi.mock('@/components/ui/campaign/location-map/DmLocationToolOptions', () => ({
  default: ({ trailing }: { trailing?: ReactNode }) => (
    <div data-testid="options-row">{trailing}</div>
  ),
}));

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => ['select', vi.fn()] as const,
  useElements: (
    selector: (els: CanvasElement[]) => unknown,
    isEqual?: (a: unknown, b: unknown) => boolean
  ) => {
    void isEqual;
    return selector(mockElements);
  },
  // useOwnTokenBackfill (mounted alongside useOwnTokenPresent) reads the
  // store off the viewport — a stub returning the same mock elements is
  // enough for these render tests.
  useViewport: () => ({
    toolContext: { store: { update: vi.fn(), getAll: () => mockElements } },
  }),
}));

function ownTokenEl(characterId: string): CanvasElement {
  return {
    id: 'tok-1',
    type: 'shape',
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    tokenKind: PLAYER_TOKEN_KIND,
    characterId,
  } as unknown as CanvasElement;
}

const TOOL_NAMES = [
  'Pan',
  'Select',
  'Place token',
  'Draw',
  'Arrow',
  'Measure',
  'Move',
  'Template',
];

function renderToolbar(
  overrides: Partial<ComponentProps<typeof PlayerToolbar>> = {}
) {
  return render(
    <PlayerToolbar
      status="live"
      hasSelection={false}
      onDeleteSelected={vi.fn()}
      characterId="char-1"
      showBackLink={false}
      {...overrides}
    />
  );
}

describe('PlayerToolbar', () => {
  beforeEach(() => {
    mockElements = [];
    // Radix Tooltip measures its trigger; jsdom has no ResizeObserver.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('describes the token button with visible hint text when the player has no own token yet', () => {
    renderToolbar();
    const btn = screen.getByRole('button', { name: 'Place token' });
    const hint = screen.getByText('Place your token on the map');
    expect(btn).toHaveAttribute('aria-describedby', hint.id);
    expect(screen.getByTestId('options-row')).toContainElement(hint);
  });

  it('shows no hint once the player has placed their own token', () => {
    mockElements = [ownTokenEl('char-1')];
    renderToolbar();
    expect(
      screen.queryByText('Place your token on the map')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Place token' })
    ).not.toHaveAttribute('aria-describedby');
  });

  it('shows no hint while still connecting', () => {
    renderToolbar({ status: 'connecting' });
    expect(
      screen.queryByText('Place your token on the map')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Place token' })
    ).not.toHaveAttribute('aria-describedby');
  });

  it('names every tool and marks only the active one pressed, with no title attributes', () => {
    const { container } = renderToolbar();
    for (const name of TOOL_NAMES) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        name === 'Select' ? 'true' : 'false'
      );
    }
    expect(container.querySelector('[title]')).toBeNull();
    const toolbar = screen.getByTestId('player-toolbar');
    for (const name of TOOL_NAMES) {
      expect(toolbar).toContainElement(screen.getByRole('button', { name }));
    }
  });

  it('keeps Delete selected outside the scrolling tool row', () => {
    renderToolbar({ hasSelection: true });
    const scroller = screen.getByRole('button', { name: 'Pan' }).parentElement!;
    expect(
      scroller.contains(screen.getByRole('button', { name: 'Delete selected' }))
    ).toBe(false);
  });

  it('links back to the sheet only when showBackLink is set', () => {
    const { unmount } = renderToolbar({ showBackLink: true });
    expect(screen.getByRole('link', { name: 'Back to sheet' })).toHaveAttribute(
      'href',
      '/player/characters/char-1'
    );
    unmount();
    renderToolbar({ showBackLink: false });
    expect(
      screen.queryByRole('link', { name: 'Back to sheet' })
    ).not.toBeInTheDocument();
  });

  it('shows the sync state as a chip, with the denied wording', () => {
    const { unmount } = renderToolbar();
    expect(screen.getByTestId('live-sync-chip')).toHaveTextContent('Live');
    unmount();
    renderToolbar({ status: 'denied' });
    expect(screen.getByTestId('live-sync-chip')).toHaveTextContent(
      'Sync denied'
    );
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });

  it('renders the export control passed via the exportControl prop', () => {
    renderToolbar({
      exportControl: <button aria-label="Export map">Export</button>,
    });
    expect(screen.getByLabelText('Export map')).toBeInTheDocument();
  });

  // NOTE: this renders PlayerToolbar in isolation, so it guards the toolbar
  // markup only — it says nothing about PlayerBattleMapCanvas (the actual
  // mount site), which never passes a viewsControl prop to PlayerToolbar in
  // the first place. A full canvas-level render needs a live DOM canvas
  // unavailable in jsdom, so that gap is left open deliberately (see
  // DmBattleMapCanvas.test.tsx's header comment for the same constraint).
  // The receive-SIDE hazard this toolbar test does not cover — a DM
  // targeting the TV moving every player's camera instead — is covered
  // separately by PlayerBattleMapCanvas.focusOptions.test.ts.
  it('renders no views control — players never send camera focus requests', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: /views/i })).toBeNull();
  });

  it('keeps an opaque privacy cover over the canvas until bootstrap is live', () => {
    const { rerender } = render(
      <BattleMapBootstrapPrivacyCover status="connecting" />
    );
    const cover = screen.getByTestId('battlemap-bootstrap-privacy-cover');
    expect(cover).toHaveStyle({ position: 'fixed', background: '#000' });

    rerender(<BattleMapBootstrapPrivacyCover status="live" />);
    expect(
      screen.queryByTestId('battlemap-bootstrap-privacy-cover')
    ).toBeNull();
  });
});
