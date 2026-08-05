import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FieldNotesCanvas } from '@fieldnotes/react';

import { BattleMapMinimap } from '@/components/ui/campaign/location-map/BattleMapMinimap';

// ---------------------------------------------------------------------------
// Permissive fake 2D context: every read of an unset property returns a
// fresh vi.fn(), so any drawing call the SDK's MinimapController issues
// (fillRect, drawImage, save/restore, setTransform, strokeRect, ...)
// succeeds without asserting on call fidelity. Property writes (fillStyle,
// lineWidth, ...) are recorded on the backing object so later reads see the
// last-written value. Mirrors @fieldnotes/react's own minimap.test.tsx.
// ---------------------------------------------------------------------------
function makeContext(): CanvasRenderingContext2D {
  const state: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return vi.fn();
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  };
  return new Proxy(state, handler) as unknown as CanvasRenderingContext2D;
}

let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => makeContext());
});

afterEach(() => {
  cleanup();
  getContextSpy.mockRestore();
  vi.restoreAllMocks();
});

describe('BattleMapMinimap', () => {
  it('renders expanded by default: a canvas plus the Collapse minimap button, inside a positioned wrapper', () => {
    const { container } = render(
      <FieldNotesCanvas>
        <BattleMapMinimap />
      </FieldNotesCanvas>
    );

    // The FieldNotesCanvas host canvas plus the minimap's own canvas.
    expect(container.querySelectorAll('canvas').length).toBe(2);
    expect(
      screen.getByRole('button', { name: 'Collapse minimap' })
    ).not.toBeNull();

    const wrapper = screen
      .getByRole('button', {
        name: 'Collapse minimap',
      })
      .closest('[class*="absolute"]');
    expect(wrapper).not.toBeNull();
  });

  it('defaultCollapsed renders only the Expand minimap button (no canvas)', () => {
    const { container } = render(
      <FieldNotesCanvas>
        <BattleMapMinimap defaultCollapsed />
      </FieldNotesCanvas>
    );

    // Only the FieldNotesCanvas host canvas — no minimap canvas while collapsed.
    expect(container.querySelectorAll('canvas').length).toBe(1);
    expect(
      screen.getByRole('button', { name: 'Expand minimap' })
    ).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Collapse minimap' })
    ).toBeNull();
  });

  it('supports a bottom-left placement for the DM canvas', () => {
    render(
      <FieldNotesCanvas>
        <BattleMapMinimap placement="bottom-left" />
      </FieldNotesCanvas>
    );

    const wrapper = screen
      .getByRole('button', { name: 'Collapse minimap' })
      .closest('[data-minimap-placement]');
    expect(wrapper).toHaveAttribute('data-minimap-placement', 'bottom-left');
    expect(wrapper?.className).toContain('bottom-3');
    expect(wrapper?.className).toContain('left-3');
    expect(wrapper?.className).not.toContain('left-1/2');
  });

  it('clicking expand from a collapsed state reveals the canvas (player flow: collapsed -> tap -> overview)', () => {
    const { container } = render(
      <FieldNotesCanvas>
        <BattleMapMinimap defaultCollapsed />
      </FieldNotesCanvas>
    );

    expect(container.querySelectorAll('canvas').length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Expand minimap' }));

    expect(container.querySelectorAll('canvas').length).toBe(2);
    expect(
      screen.getByRole('button', { name: 'Collapse minimap' })
    ).not.toBeNull();
  });
});
