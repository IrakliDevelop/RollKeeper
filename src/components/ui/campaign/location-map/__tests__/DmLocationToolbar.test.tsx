import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import DmLocationToolbar from '@/components/ui/campaign/location-map/DmLocationToolbar';
import {
  MARKER_MIXED_AUDIENCE_MESSAGE,
  MARKER_SHARE_REVEALS_CLASSIFICATION,
} from '@/components/ui/campaign/location-map/markerAudienceCopy';

import type { DmLocationToolbarProps } from '@/components/ui/campaign/location-map/DmLocationToolbar.types';

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => ['select', vi.fn()] as const,
  useHistory: () => ({
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  }),
}));

const baseProps: DmLocationToolbarProps = {
  onPickImage: vi.fn(),
  onClear: vi.fn(),
  onFitToMap: vi.fn(),
  gridEnabled: false,
  gridType: 'hex',
  gridCellSize: 50,
  gridColor: '#94a3b8',
  gridOpacity: 0.5,
  onSetGridType: vi.fn(),
  onUpdateGridSettings: vi.fn(),
  onSyncToPlayers: vi.fn(),
  syncing: false,
  hasUnsyncedChanges: false,
  lastSyncedAt: null,
  selectedElementId: null,
  isDmOnly: false,
  onToggleDmOnly: vi.fn(),
  hiddenPlacementActive: false,
  onToggleHiddenPlacement: vi.fn(),
  hiddenElementCount: 0,
  onRevealAll: vi.fn(),
  mode: 'battlemap',
  syncStatus: 'disabled',
};

describe('DmLocationToolbar', () => {
  afterEach(() => cleanup());

  it('no longer mounts the selection ops (delete/rotate/align) — consolidated into DmSelectionOptions', () => {
    render(<DmLocationToolbar {...baseProps} />);
    expect(screen.queryByTitle('Delete selected')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Rotate 90° clockwise')).not.toBeInTheDocument();
    expect(
      screen.queryByTitle('Rotate 90° counter-clockwise')
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle('Align & distribute')).not.toBeInTheDocument();
  });

  it('collapses grid controls into the popover (no inline sliders)', () => {
    render(<DmLocationToolbar {...baseProps} gridEnabled={true} />);
    // Trigger present, inline strip gone even with grid enabled.
    expect(screen.getByTitle('Grid settings')).toBeInTheDocument();
    expect(screen.queryByTitle('Grid cell size')).not.toBeInTheDocument();
    // Opening the popover reveals the controls.
    fireEvent.click(screen.getByTitle('Grid settings'));
    expect(screen.getByTitle('Grid cell size')).toBeInTheDocument();
  });

  it('wraps instead of clipping (flex-wrap on the container)', () => {
    const { container } = render(<DmLocationToolbar {...baseProps} />);
    expect(container.firstElementChild?.className).toContain('flex-wrap');
  });

  it('offers an eraser tool separately from clearing the canvas', () => {
    render(<DmLocationToolbar {...baseProps} />);

    expect(screen.getByTitle('Eraser')).toBeInTheDocument();
    expect(screen.getByTitle('Clear canvas')).toBeInTheDocument();
  });

  it('renders viewsControl next to exportControl in battlemap mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="battlemap"
        exportControl={<div data-testid="export-control-marker" />}
        viewsControl={<div data-testid="views-control-marker" />}
      />
    );
    expect(screen.getByTestId('export-control-marker')).toBeInTheDocument();
    expect(screen.getByTestId('views-control-marker')).toBeInTheDocument();
  });

  it('does not render viewsControl in location mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        exportControl={<div data-testid="export-control-marker" />}
        viewsControl={<div data-testid="views-control-marker" />}
      />
    );
    expect(
      screen.queryByTestId('views-control-marker')
    ).not.toBeInTheDocument();
  });

  it('renders presenceControl next to viewsControl in battlemap mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="battlemap"
        viewsControl={<div data-testid="views-control-marker" />}
        presenceControl={<div data-testid="presence-slot" />}
      />
    );
    expect(screen.getByTestId('views-control-marker')).toBeInTheDocument();
    expect(screen.getByTestId('presence-slot')).toBeInTheDocument();
  });

  it('does not render presenceControl in location mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        presenceControl={<div data-testid="presence-slot" />}
      />
    );
    expect(screen.queryByTestId('presence-slot')).not.toBeInTheDocument();
  });

  it('shows hidden-placement state and reveals all hidden elements', () => {
    const onToggle = vi.fn();
    const onRevealAll = vi.fn();
    render(
      <DmLocationToolbar
        {...baseProps}
        hiddenPlacementActive
        onToggleHiddenPlacement={onToggle}
        hiddenElementCount={3}
        onRevealAll={onRevealAll}
      />
    );

    const placement = screen.getByRole('button', { name: 'Placing hidden' });
    expect(placement).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(placement);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal all (3)' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onRevealAll).toHaveBeenCalledOnce();
  });
});

describe('DmLocationToolbar marker chrome', () => {
  afterEach(() => cleanup());

  it('offers a Marker tool in both battlemap and location mode', () => {
    const { unmount } = render(<DmLocationToolbar {...baseProps} />);
    expect(screen.getByTitle('Marker')).toBeInTheDocument();
    unmount();

    render(<DmLocationToolbar {...baseProps} mode="location" />);
    expect(screen.getByTitle('Marker')).toBeInTheDocument();
  });

  it('surfaces the mixed-audience refusal next to the DM-only toggle', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="pin-1"
        selectedElementIsMarker
        markerAudienceNotice={MARKER_MIXED_AUDIENCE_MESSAGE}
      />
    );

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(/pins don't currently agree/i);
    expect(notice).toHaveTextContent(/Set them to match/i);
  });

  it('renders no notice when there is nothing to explain (same fixture, notice null)', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="pin-1"
        selectedElementIsMarker
        markerAudienceNotice={null}
      />
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the DM-only toggle warns that a shared marker publishes its kind, label and colour', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="pin-1"
        selectedElementIsMarker
      />
    );

    const toggle = screen.getByTestId('dm-only-toggle');
    expect(toggle.getAttribute('title')).toContain(
      MARKER_SHARE_REVEALS_CLASSIFICATION
    );
    expect(toggle.getAttribute('aria-label')).toContain(
      MARKER_SHARE_REVEALS_CLASSIFICATION
    );
  });

  it('a non-marker selection keeps the plain visibility copy', () => {
    render(<DmLocationToolbar {...baseProps} selectedElementId="shape-1" />);

    const toggle = screen.getByTestId('dm-only-toggle');
    expect(toggle.getAttribute('title')).toBe('Visible to players');
    expect(toggle.getAttribute('title')).not.toContain(
      MARKER_SHARE_REVEALS_CLASSIFICATION
    );
  });
});
