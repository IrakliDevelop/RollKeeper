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

// The Delete button's count hook reads the viewport directly — stub it so
// the toolbar renders without a canvas.
vi.mock(
  '@/components/ui/campaign/location-map/useSelectToolSelectionCount',
  () => ({ useSelectToolSelectionCount: () => 0 })
);

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
  onDownloadExport: vi.fn(),
  syncing: false,
  hasUnsyncedChanges: false,
  lastSyncedAt: null,
  selectedElementId: null,
  isDmOnly: false,
  onToggleDmOnly: vi.fn(),
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

  it('renders both rotate buttons disabled when nothing is selected', () => {
    render(<DmLocationToolbar {...baseProps} />);
    expect(screen.getByTitle('Rotate 90° clockwise')).toBeDisabled();
    expect(screen.getByTitle('Rotate 90° counter-clockwise')).toBeDisabled();
  });

  it('enables the buttons with a selection and forwards clicks', () => {
    mockSelectedCount = 2;
    render(<DmLocationToolbar {...baseProps} />);
    const cw = screen.getByTitle('Rotate 90° clockwise');
    const ccw = screen.getByTitle('Rotate 90° counter-clockwise');
    expect(cw).toBeEnabled();
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
});
