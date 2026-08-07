import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { DmVttToolbar } from '@/components/ui/campaign/dm-vtt/DmVttToolbar';
import DmLocationToolOptions from '@/components/ui/campaign/location-map/DmLocationToolOptions';

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => ['select', vi.fn()] as const,
  useToolOptions: () => [undefined, vi.fn()] as const,
}));

// The shared options bar's own behavior (including the select-branch and its
// empty-selection gating) is covered by DmLocationToolOptions.test.tsx —
// stubbed here so this file stays focused on DmVttToolbar's own chrome, and
// so we can assert exactly what props DmVttToolbar wires into it below.
vi.mock('@/components/ui/campaign/location-map/DmLocationToolOptions', () => ({
  default: vi.fn(() => null),
}));

describe('DmVttToolbar', () => {
  afterEach(() => cleanup());

  it('offers a real eraser tool separately from clearing drawings', () => {
    render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
        hiddenPlacementActive={false}
        onToggleHiddenPlacement={vi.fn()}
        hiddenElementCount={0}
        onRevealAll={vi.fn()}
        selectedElementId={null}
        selectedElementIsDmOnly={false}
        onToggleSelectedDmOnly={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear drawings' })
    ).toBeInTheDocument();
  });

  it('uses an edge-to-edge responsive command rail', () => {
    const { container } = render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
        hiddenPlacementActive={false}
        onToggleHiddenPlacement={vi.fn()}
        hiddenElementCount={0}
        onRevealAll={vi.fn()}
        selectedElementId={null}
        selectedElementIsDmOnly={false}
        onToggleSelectedDmOnly={vi.fn()}
      />
    );
    const dock = container.firstChild as HTMLElement;
    expect(dock).toHaveAttribute('data-testid', 'dm-vtt-command-dock');
    expect(dock.className).toContain('flex-col');
    expect(dock.className).toContain('inset-x-0');
    expect(dock.className).toContain('w-full');
    expect(dock.className).toContain('2xl:flex-row');
    expect(dock.querySelector('.overflow-x-auto')).toBeInTheDocument();
  });

  it('toggles hidden placement and offers reveal all', () => {
    const onToggle = vi.fn();
    const onRevealAll = vi.fn();
    render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
        hiddenPlacementActive
        onToggleHiddenPlacement={onToggle}
        hiddenElementCount={2}
        onRevealAll={onRevealAll}
        selectedElementId="trap-1"
        selectedElementIsDmOnly
        onToggleSelectedDmOnly={vi.fn()}
      />
    );

    const placement = screen.getByRole('button', {
      name: 'Place hidden elements',
    });
    expect(placement).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(placement);
    fireEvent.click(
      screen.getByRole('button', { name: 'Reveal all hidden elements (2)' })
    );
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onRevealAll).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Reveal selected element' })
    ).toBeInTheDocument();
  });

  it('renders viewsControl next to exportControl', () => {
    render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
        hiddenPlacementActive={false}
        onToggleHiddenPlacement={vi.fn()}
        hiddenElementCount={0}
        onRevealAll={vi.fn()}
        selectedElementId={null}
        selectedElementIsDmOnly={false}
        onToggleSelectedDmOnly={vi.fn()}
        exportControl={<div data-testid="export-control-marker" />}
        viewsControl={<div data-testid="views-control-marker" />}
      />
    );

    expect(screen.getByTestId('export-control-marker')).toBeInTheDocument();
    expect(screen.getByTestId('views-control-marker')).toBeInTheDocument();
  });

  it('wires selectionControls into the shared tool options bar', () => {
    render(
      <DmVttToolbar
        onClearDrawings={vi.fn()}
        tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
        hiddenPlacementActive={false}
        onToggleHiddenPlacement={vi.fn()}
        hiddenElementCount={0}
        onRevealAll={vi.fn()}
        selectedElementId={null}
        selectedElementIsDmOnly={false}
        onToggleSelectedDmOnly={vi.fn()}
      />
    );

    const lastProps = vi.mocked(DmLocationToolOptions).mock.calls.at(-1)?.[0];
    expect(lastProps).toEqual(
      expect.objectContaining({ mode: 'battlemap', selectionControls: true })
    );
  });
});
