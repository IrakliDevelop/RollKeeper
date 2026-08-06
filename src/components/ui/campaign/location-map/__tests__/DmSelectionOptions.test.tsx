import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import DmSelectionOptions from '@/components/ui/campaign/location-map/DmSelectionOptions';

import type { ElementStyle, SelectionStyleDetails } from '@fieldnotes/core';

const group = vi.fn();
const ungroup = vi.fn();
const toggleLock = vi.fn();
const rotateCW = vi.fn();
const rotateCCW = vi.fn();
const removeElements = vi.fn();
const applyStyle = vi.fn();

let mockSelectedIds: string[] = ['a', 'b'];
let mockSelectedCount = 2;
let mockCanGroup = false;
let mockCanUngroup = false;
let mockIsLocked: boolean | null = null;
let mockDetails: SelectionStyleDetails | null = null;

vi.mock('@fieldnotes/react', () => ({
  useViewport: () => ({ removeElements }),
  useSelectionOps: () => ({
    selectedIds: mockSelectedIds,
    selectedCount: mockSelectedCount,
    canGroup: mockCanGroup,
    canUngroup: mockCanUngroup,
    canAlign: false,
    canDistribute: false,
    isLocked: mockIsLocked,
    group,
    ungroup,
    toggleLock,
    align: vi.fn(),
    distribute: vi.fn(),
    rotateCW,
    rotateCCW,
  }),
  useSelectionStyleDetails: () => [mockDetails, applyStyle] as const,
}));

function detailsWith(
  applicable: (keyof ElementStyle)[],
  common: ElementStyle = {},
  mixed: (keyof ElementStyle)[] = []
): SelectionStyleDetails {
  return { common, applicable, mixed };
}

describe('DmSelectionOptions', () => {
  beforeEach(() => {
    mockSelectedIds = ['a', 'b'];
    mockSelectedCount = 2;
    mockCanGroup = false;
    mockCanUngroup = false;
    mockIsLocked = null;
    mockDetails = detailsWith(
      ['color', 'fillColor', 'strokeWidth', 'fontSize'],
      { color: '#ef4444', fillColor: '#22c55e', strokeWidth: 4, fontSize: 16 }
    );
    group.mockClear();
    ungroup.mockClear();
    toggleLock.mockClear();
    rotateCW.mockClear();
    rotateCCW.mockClear();
    removeElements.mockClear();
    applyStyle.mockClear();
  });

  afterEach(() => cleanup());

  it('renders nothing when nothing is selected', () => {
    mockSelectedCount = 0;
    const { container } = render(<DmSelectionOptions />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders arrange ops (no style controls) when style details are null (style-less selection, e.g. an image)', () => {
    mockDetails = null;
    render(<DmSelectionOptions />);
    // Count label and arrange actions still render for a style-less selection.
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByTitle('Align & distribute')).toBeInTheDocument();
    expect(
      screen.getByTitle('Rotate 90° counter-clockwise')
    ).toBeInTheDocument();
    expect(screen.getByTitle('Rotate 90° clockwise')).toBeInTheDocument();
    expect(screen.getByTitle('Lock')).toBeInTheDocument();
    expect(screen.getByTitle('Delete selected')).toBeInTheDocument();
    // No style controls, since there's no style to control.
    expect(
      screen.queryByRole('radiogroup', { name: 'Stroke color' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Fill color' })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Stroke width')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Font size')).not.toBeInTheDocument();
  });

  it('shows the selected count', () => {
    mockSelectedCount = 3;
    render(<DmSelectionOptions />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  describe('per-field applicability', () => {
    it('renders only the stroke color control when only color is applicable', () => {
      mockDetails = detailsWith(['color'], { color: '#ef4444' });
      render(<DmSelectionOptions />);
      expect(
        screen.getByRole('radiogroup', { name: 'Stroke color' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('radiogroup', { name: 'Fill color' })
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Stroke width')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Font size')).not.toBeInTheDocument();
    });

    it('renders only the fill color control when only fillColor is applicable', () => {
      mockDetails = detailsWith(['fillColor'], { fillColor: '#22c55e' });
      render(<DmSelectionOptions />);
      expect(
        screen.getByRole('radiogroup', { name: 'Fill color' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('radiogroup', { name: 'Stroke color' })
      ).not.toBeInTheDocument();
    });

    it('renders only the stroke width slider when only strokeWidth is applicable', () => {
      mockDetails = detailsWith(['strokeWidth'], { strokeWidth: 5 });
      render(<DmSelectionOptions />);
      expect(screen.getByLabelText('Stroke width')).toBeInTheDocument();
      expect(screen.queryByLabelText('Font size')).not.toBeInTheDocument();
    });

    it('renders only the font size slider when only fontSize is applicable', () => {
      mockDetails = detailsWith(['fontSize'], { fontSize: 24 });
      render(<DmSelectionOptions />);
      expect(screen.getByLabelText('Font size')).toBeInTheDocument();
      expect(screen.queryByLabelText('Stroke width')).not.toBeInTheDocument();
    });

    it('renders all four controls when all four fields are applicable', () => {
      render(<DmSelectionOptions />);
      expect(
        screen.getByRole('radiogroup', { name: 'Stroke color' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radiogroup', { name: 'Fill color' })
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Stroke width')).toBeInTheDocument();
      expect(screen.getByLabelText('Font size')).toBeInTheDocument();
    });
  });

  describe('indeterminate (mixed) state', () => {
    it('marks all stroke color swatches aria-checked=false when color is mixed', () => {
      mockDetails = detailsWith(['color'], { color: '#ef4444' }, ['color']);
      render(<DmSelectionOptions />);
      const swatches = screen.getAllByRole('radio', {
        name: /mixed stroke colors/i,
      });
      expect(swatches.length).toBeGreaterThan(0);
      for (const swatch of swatches) {
        expect(swatch).toHaveAttribute('aria-checked', 'false');
      }
    });

    it('marks all fill color swatches aria-checked=false when fillColor is mixed', () => {
      mockDetails = detailsWith(['fillColor'], { fillColor: '#22c55e' }, [
        'fillColor',
      ]);
      render(<DmSelectionOptions />);
      const swatches = screen.getAllByRole('radio', {
        name: /mixed fill colors/i,
      });
      expect(swatches.length).toBeGreaterThan(0);
      for (const swatch of swatches) {
        expect(swatch).toHaveAttribute('aria-checked', 'false');
      }
    });

    it('shows a "(mixed)" aria-label on the stroke width slider when mixed', () => {
      mockDetails = detailsWith(['strokeWidth'], { strokeWidth: 5 }, [
        'strokeWidth',
      ]);
      render(<DmSelectionOptions />);
      expect(screen.getByLabelText('Stroke width (mixed)')).toBeInTheDocument();
    });

    it('shows a "(mixed)" aria-label on the font size slider when mixed', () => {
      mockDetails = detailsWith(['fontSize'], { fontSize: 24 }, ['fontSize']);
      render(<DmSelectionOptions />);
      expect(screen.getByLabelText('Font size (mixed)')).toBeInTheDocument();
    });
  });

  describe('normalization dispatch', () => {
    it('applies { color } when a stroke swatch is clicked', () => {
      mockDetails = detailsWith(['color'], { color: '#ef4444' });
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByTitle('#3b82f6'));
      expect(applyStyle).toHaveBeenCalledWith({ color: '#3b82f6' });
    });

    it('applies { fillColor } when a fill swatch is clicked', () => {
      mockDetails = detailsWith(['fillColor'], { fillColor: '#22c55e' });
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByTitle('#3b82f6'));
      expect(applyStyle).toHaveBeenCalledWith({ fillColor: '#3b82f6' });
    });

    it('applies { strokeWidth } when the width slider changes', () => {
      mockDetails = detailsWith(['strokeWidth'], { strokeWidth: 4 });
      render(<DmSelectionOptions />);
      fireEvent.change(screen.getByLabelText('Stroke width'), {
        target: { value: '8' },
      });
      expect(applyStyle).toHaveBeenCalledWith({ strokeWidth: 8 });
    });

    it('applies { fontSize } when the font size slider changes', () => {
      mockDetails = detailsWith(['fontSize'], { fontSize: 16 });
      render(<DmSelectionOptions />);
      fireEvent.change(screen.getByLabelText('Font size'), {
        target: { value: '32' },
      });
      expect(applyStyle).toHaveBeenCalledWith({ fontSize: 32 });
    });
  });

  describe('group / ungroup visibility', () => {
    it('hides both group and ungroup when neither predicate is true', () => {
      render(<DmSelectionOptions />);
      expect(screen.queryByTitle('Group')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Ungroup')).not.toBeInTheDocument();
    });

    it('shows group and forwards the click when canGroup is true', () => {
      mockCanGroup = true;
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByTitle('Group'));
      expect(group).toHaveBeenCalledTimes(1);
    });

    it('shows ungroup and forwards the click when canUngroup is true', () => {
      mockCanUngroup = true;
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByTitle('Ungroup'));
      expect(ungroup).toHaveBeenCalledTimes(1);
    });
  });

  it('deletes the selection via viewport.removeElements(selectedIds)', () => {
    mockSelectedIds = ['x', 'y', 'z'];
    render(<DmSelectionOptions />);
    fireEvent.click(screen.getByTitle('Delete selected'));
    expect(removeElements).toHaveBeenCalledWith(['x', 'y', 'z']);
  });

  it('toggles lock and shows the correct icon state via title', () => {
    mockIsLocked = false;
    const { rerender } = render(<DmSelectionOptions />);
    expect(screen.getByTitle('Lock')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Lock'));
    expect(toggleLock).toHaveBeenCalledTimes(1);

    mockIsLocked = true;
    rerender(<DmSelectionOptions />);
    expect(screen.getByTitle('Unlock')).toBeInTheDocument();
  });

  it('forwards rotate clicks', () => {
    render(<DmSelectionOptions />);
    fireEvent.click(screen.getByTitle('Rotate 90° clockwise'));
    fireEvent.click(screen.getByTitle('Rotate 90° counter-clockwise'));
    expect(rotateCW).toHaveBeenCalledTimes(1);
    expect(rotateCCW).toHaveBeenCalledTimes(1);
  });

  it('gives every interactive control an h-11-based (>=44px) class', () => {
    mockCanGroup = true;
    mockCanUngroup = true;
    render(<DmSelectionOptions />);

    const interactiveEls = [
      ...screen.getAllByRole('radio'),
      screen.getByLabelText('Stroke width'),
      screen.getByLabelText('Font size'),
      screen.getByTitle('Align & distribute'),
      screen.getByTitle('Rotate 90° clockwise'),
      screen.getByTitle('Rotate 90° counter-clockwise'),
      screen.getByTitle('Group'),
      screen.getByTitle('Ungroup'),
      screen.getByTitle('Lock'),
      screen.getByTitle('Delete selected'),
    ];

    for (const el of interactiveEls) {
      expect(el.className).toMatch(/\bh-11\b/);
    }
  });
});
