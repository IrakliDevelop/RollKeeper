import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { DmVttToolbar } from '@/components/ui/campaign/dm-vtt/DmVttToolbar';

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => ['select', vi.fn()] as const,
}));

describe('DmVttToolbar', () => {
  afterEach(() => cleanup());

  it('always sits below the fixed top bar (top-16), never sharing its row', () => {
    // Regression pin for the wide-viewport overlap bug: a `min-[1350px]:top-3`
    // variant previously moved the toolbar into `DmVttTopBar`'s row at
    // >=1350px, hiding the drawing tools behind the top bar's controls. The
    // toolbar must stay at `top-16` at every width.
    const { container } = render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
      />
    );
    const toolbar = container.firstChild as HTMLElement;
    const classes = toolbar.className.split(/\s+/);
    expect(classes).toContain('top-16');
    expect(classes).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^min-\[1350px\]:top-3$/)])
    );
  });
});
