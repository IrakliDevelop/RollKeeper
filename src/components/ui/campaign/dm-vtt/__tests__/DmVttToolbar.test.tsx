import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { DmVttToolbar } from '@/components/ui/campaign/dm-vtt/DmVttToolbar';

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => ['select', vi.fn()] as const,
}));

describe('DmVttToolbar', () => {
  afterEach(() => cleanup());

  it('shares the top dock on wide screens and stacks below it when narrow', () => {
    const { container } = render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
      />
    );
    const toolbar = container.firstChild as HTMLElement;
    const classes = toolbar.className.split(/\s+/);
    expect(classes).toContain('top-14');
    expect(classes).toContain('xl:top-1');
  });
});
