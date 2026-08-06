import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import DmLocationToolbar from '@/components/ui/campaign/location-map/DmLocationToolbar';

import type { DmLocationToolbarProps } from '@/components/ui/campaign/location-map/DmLocationToolbar.types';

const rotateCW = vi.fn();
const rotateCCW = vi.fn();
let mockSelectedCount = 0;

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => ['select', vi.fn()] as const,
  useHistory: () => ({
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  }),
  useSelectionOps: () => ({
    selectedIds: [],
    selectedCount: mockSelectedCount,
    canGroup: false,
    canUngroup: false,
    canAlign: false,
    canDistribute: false,
    isLocked: null,
    group: vi.fn(),
    ungroup: vi.fn(),
    toggleLock: vi.fn(),
    align: vi.fn(),
    distribute: vi.fn(),
    rotateCW,
    rotateCCW,
  }),
}));

const baseProps: DmLocationToolbarProps = {
  onPickImage: vi.fn(),
  onDelete: vi.fn(),
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

describe('DmLocationToolbar rotation buttons', () => {
  beforeEach(() => {
    mockSelectedCount = 0;
    rotateCW.mockClear();
    rotateCCW.mockClear();
  });

  afterEach(() => cleanup());

  it('renders both rotate buttons and the delete button disabled when nothing is selected', () => {
    render(<DmLocationToolbar {...baseProps} />);
    expect(screen.getByTitle('Rotate 90° clockwise')).toBeDisabled();
    expect(screen.getByTitle('Rotate 90° counter-clockwise')).toBeDisabled();
    expect(screen.getByTitle('Delete selected')).toBeDisabled();
  });

  it('enables the buttons with a selection and forwards clicks', () => {
    mockSelectedCount = 2;
    render(<DmLocationToolbar {...baseProps} />);
    const cw = screen.getByTitle('Rotate 90° clockwise');
    const ccw = screen.getByTitle('Rotate 90° counter-clockwise');
    const del = screen.getByTitle('Delete selected');
    expect(cw).toBeEnabled();
    expect(del).toBeEnabled();
    fireEvent.click(cw);
    fireEvent.click(ccw);
    expect(rotateCW).toHaveBeenCalledTimes(1);
    expect(rotateCCW).toHaveBeenCalledTimes(1);
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

  it('renders the Align trigger in the center group', () => {
    render(<DmLocationToolbar {...baseProps} />);
    expect(screen.getByTitle('Align & distribute')).toBeInTheDocument();
  });

  it('offers an eraser tool separately from clearing the canvas', () => {
    render(<DmLocationToolbar {...baseProps} />);

    expect(screen.getByTitle('Eraser')).toBeInTheDocument();
    expect(screen.getByTitle('Clear canvas')).toBeInTheDocument();
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
