import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import DmLocationAlignMenu from '@/components/ui/campaign/location-map/DmLocationAlignMenu';

const align = vi.fn();
const distribute = vi.fn();
let mockCanAlign = true;
let mockCanDistribute = true;

vi.mock('@fieldnotes/react', () => ({
  useSelectionOps: () => ({
    selectedIds: [],
    selectedCount: 2,
    canGroup: false,
    canUngroup: false,
    canAlign: mockCanAlign,
    canDistribute: mockCanDistribute,
    isLocked: null,
    group: vi.fn(),
    ungroup: vi.fn(),
    toggleLock: vi.fn(),
    align,
    distribute,
    rotateCW: vi.fn(),
    rotateCCW: vi.fn(),
  }),
}));

const ALIGN_CASES: Array<[title: string, edge: string]> = [
  ['Align left', 'left'],
  ['Align centers horizontally', 'center-x'],
  ['Align right', 'right'],
  ['Align top', 'top'],
  ['Align middles vertically', 'middle'],
  ['Align bottom', 'bottom'],
];

describe('DmLocationAlignMenu', () => {
  beforeEach(() => {
    mockCanAlign = true;
    mockCanDistribute = true;
    align.mockClear();
    distribute.mockClear();
  });

  afterEach(() => cleanup());

  it('disables the trigger when alignment is not possible', () => {
    mockCanAlign = false;
    render(<DmLocationAlignMenu />);
    expect(screen.getByTitle('Align & distribute')).toBeDisabled();
  });

  it('forwards each align edge exactly', () => {
    render(<DmLocationAlignMenu />);
    fireEvent.click(screen.getByTitle('Align & distribute'));
    for (const [title, edge] of ALIGN_CASES) {
      fireEvent.click(screen.getByTitle(title));
      expect(align).toHaveBeenLastCalledWith(edge);
    }
    expect(align).toHaveBeenCalledTimes(6);
  });

  it('keeps the panel open after an align action', () => {
    render(<DmLocationAlignMenu />);
    fireEvent.click(screen.getByTitle('Align & distribute'));
    fireEvent.click(screen.getByTitle('Align left'));
    expect(screen.getByTitle('Align top')).toBeInTheDocument();
  });

  it('disables distribute (but not align) below three movable elements', () => {
    mockCanDistribute = false;
    render(<DmLocationAlignMenu />);
    fireEvent.click(screen.getByTitle('Align & distribute'));
    expect(screen.getByTitle('Distribute horizontally')).toBeDisabled();
    expect(screen.getByTitle('Align left')).toBeEnabled();
  });

  it('forwards distribute axes when possible', () => {
    render(<DmLocationAlignMenu />);
    fireEvent.click(screen.getByTitle('Align & distribute'));
    fireEvent.click(screen.getByTitle('Distribute horizontally'));
    fireEvent.click(screen.getByTitle('Distribute vertically'));
    expect(distribute).toHaveBeenNthCalledWith(1, 'horizontal');
    expect(distribute).toHaveBeenNthCalledWith(2, 'vertical');
  });

  it('closes on Escape and when alignment becomes impossible', () => {
    const { rerender } = render(<DmLocationAlignMenu />);
    fireEvent.click(screen.getByTitle('Align & distribute'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTitle('Align left')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Align & distribute'));
    expect(screen.getByTitle('Align left')).toBeInTheDocument();
    mockCanAlign = false;
    rerender(<DmLocationAlignMenu />);
    expect(screen.queryByTitle('Align left')).not.toBeInTheDocument();
  });
});
