import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { PlayerToolbar } from '@/components/ui/campaign/location-map/PlayerBattleMapCanvas';
import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { CanvasElement } from '@fieldnotes/core';

let mockElements: CanvasElement[] = [];

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

describe('PlayerToolbar', () => {
  beforeEach(() => {
    mockElements = [];
  });

  afterEach(() => cleanup());

  it('pulses the token button with an intact class list when the player has no own token yet', () => {
    render(
      <PlayerToolbar
        status="live"
        hasSelection={false}
        onDeleteSelected={vi.fn()}
        characterId="char-1"
      />
    );
    const btn = screen.getByTitle('Place your token on the map');
    expect(btn.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['p-0', 'animate-pulse', 'bg-accent-emerald-bg'])
    );
  });

  it('shows the plain label with no pulse once the player has placed their own token', () => {
    mockElements = [ownTokenEl('char-1')];
    render(
      <PlayerToolbar
        status="live"
        hasSelection={false}
        onDeleteSelected={vi.fn()}
        characterId="char-1"
      />
    );
    expect(
      screen.queryByTitle('Place your token on the map')
    ).not.toBeInTheDocument();
    const btn = screen.getByTitle('Place token');
    expect(btn.className).not.toContain('animate-pulse');
  });

  it('does not pulse the token button while still connecting', () => {
    render(
      <PlayerToolbar
        status="connecting"
        hasSelection={false}
        onDeleteSelected={vi.fn()}
        characterId="char-1"
      />
    );
    expect(
      screen.queryByTitle('Place your token on the map')
    ).not.toBeInTheDocument();
    const btn = screen.getByTitle('Place token');
    expect(btn.className).not.toContain('animate-pulse');
  });

  it('renders the export control passed via the exportControl prop', () => {
    render(
      <PlayerToolbar
        status="live"
        hasSelection={false}
        onDeleteSelected={vi.fn()}
        characterId="char-1"
        exportControl={<button aria-label="Export map">Export</button>}
      />
    );
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
    render(
      <PlayerToolbar
        status="live"
        hasSelection={false}
        onDeleteSelected={vi.fn()}
        characterId="char-1"
      />
    );
    expect(screen.queryByRole('button', { name: /views/i })).toBeNull();
  });
});
