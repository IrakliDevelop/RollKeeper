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
});
