import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';

import {
  COLOR_SWATCHES,
  COLOR_SWATCH_NAMES,
} from '@/components/ui/campaign/location-map/DmLocationToolOptions';
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
    // Radix Popover (the Align menu) and Tooltip measure with ResizeObserver.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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
    expect(screen.getByRole('button', { name: 'Align' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rotate 90° counter-clockwise' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rotate 90° clockwise' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete selected' })
    ).toBeInTheDocument();
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
    it('names the stroke group (mixed) and checks no swatch when color is mixed', () => {
      mockDetails = detailsWith(['color'], { color: '#ef4444' }, ['color']);
      render(<DmSelectionOptions />);
      const mixedGroup = screen.getByRole('radiogroup', {
        name: 'Stroke color (mixed)',
      });
      const swatches = within(mixedGroup).getAllByRole('radio');
      expect(swatches).toHaveLength(COLOR_SWATCHES.length);
      for (const swatch of swatches) {
        expect(swatch).toHaveAttribute('aria-checked', 'false');
      }
    });

    it('names the fill group (mixed) and checks no swatch when fillColor is mixed', () => {
      mockDetails = detailsWith(['fillColor'], { fillColor: '#22c55e' }, [
        'fillColor',
      ]);
      render(<DmSelectionOptions />);
      const mixedGroup = screen.getByRole('radiogroup', {
        name: 'Fill color (mixed)',
      });
      const swatches = within(mixedGroup).getAllByRole('radio');
      expect(swatches).toHaveLength(COLOR_SWATCHES.length);
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
      fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
      expect(applyStyle).toHaveBeenCalledWith({ color: '#3b82f6' });
    });

    it('applies { fillColor } when a fill swatch is clicked', () => {
      mockDetails = detailsWith(['fillColor'], { fillColor: '#22c55e' });
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
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
      expect(
        screen.queryByRole('button', { name: 'Group' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Ungroup' })
      ).not.toBeInTheDocument();
    });

    it('shows group and forwards the click when canGroup is true', () => {
      mockCanGroup = true;
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByRole('button', { name: 'Group' }));
      expect(group).toHaveBeenCalledTimes(1);
    });

    it('shows ungroup and forwards the click when canUngroup is true', () => {
      mockCanUngroup = true;
      render(<DmSelectionOptions />);
      fireEvent.click(screen.getByRole('button', { name: 'Ungroup' }));
      expect(ungroup).toHaveBeenCalledTimes(1);
    });
  });

  it('deletes the selection via viewport.removeElements(selectedIds)', () => {
    mockSelectedIds = ['x', 'y', 'z'];
    render(<DmSelectionOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(removeElements).toHaveBeenCalledWith(['x', 'y', 'z']);
  });

  it('toggles lock and names the button for its next action', () => {
    mockIsLocked = false;
    const { rerender } = render(<DmSelectionOptions />);
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(toggleLock).toHaveBeenCalledTimes(1);

    mockIsLocked = true;
    rerender(<DmSelectionOptions />);
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  });

  it('forwards rotate clicks', () => {
    render(<DmSelectionOptions />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Rotate 90° clockwise' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Rotate 90° counter-clockwise' })
    );
    expect(rotateCW).toHaveBeenCalledTimes(1);
    expect(rotateCCW).toHaveBeenCalledTimes(1);
  });

  describe('named swatches', () => {
    it('renders the stroke and fill rows as radiogroups of named swatches', () => {
      render(<DmSelectionOptions />);
      const names = COLOR_SWATCHES.map(color => COLOR_SWATCH_NAMES[color]);
      expect(names).toEqual([
        'Slate',
        'Red',
        'Orange',
        'Yellow',
        'Green',
        'Blue',
        'Violet',
        'Pink',
        'White',
      ]);
      for (const label of ['Stroke color', 'Fill color']) {
        const row = screen.getByRole('radiogroup', { name: label });
        const radios = within(row).getAllByRole('radio');
        expect(radios.map(radio => radio.getAttribute('aria-label'))).toEqual(
          names
        );
        for (const radio of radios) {
          expect(radio).not.toHaveAttribute('title');
        }
      }
    });

    it('checks only the swatch matching the shared colour', () => {
      render(<DmSelectionOptions />);
      const stroke = screen.getByRole('radiogroup', { name: 'Stroke color' });
      const fill = screen.getByRole('radiogroup', { name: 'Fill color' });
      expect(within(stroke).getAllByRole('radio', { checked: true })).toEqual([
        within(stroke).getByRole('radio', { name: 'Red' }),
      ]);
      expect(within(fill).getAllByRole('radio', { checked: true })).toEqual([
        within(fill).getByRole('radio', { name: 'Green' }),
      ]);
    });
  });

  describe('range values', () => {
    it('shows the stroke width and font size beside their sliders', () => {
      mockDetails = detailsWith(['strokeWidth', 'fontSize'], {
        strokeWidth: 7,
        fontSize: 24,
      });
      render(<DmSelectionOptions />);
      expect(screen.getByRole('slider', { name: 'Stroke width' })).toHaveValue(
        '7'
      );
      expect(screen.getByText('Width')).toBeInTheDocument();
      expect(screen.getByText('7px')).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: 'Font size' })).toHaveValue(
        '24'
      );
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('24px')).toBeInTheDocument();
    });

    it('keeps the (mixed) slider names', () => {
      mockDetails = detailsWith(
        ['strokeWidth', 'fontSize'],
        { strokeWidth: 7, fontSize: 24 },
        ['strokeWidth', 'fontSize']
      );
      render(<DmSelectionOptions />);
      expect(
        screen.getByRole('slider', { name: 'Stroke width (mixed)' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('slider', { name: 'Font size (mixed)' })
      ).toBeInTheDocument();
    });

    it('shows a dash, not the fallback value, beside a mixed slider', () => {
      mockDetails = detailsWith(
        ['strokeWidth', 'fontSize'],
        { strokeWidth: 7, fontSize: 24 },
        ['strokeWidth', 'fontSize']
      );
      render(<DmSelectionOptions />);
      expect(screen.getAllByText('—')).toHaveLength(2);
      for (const px of ['4px', '16px', '7px', '24px']) {
        expect(screen.queryByText(px)).not.toBeInTheDocument();
      }
    });
  });

  describe('arrange actions', () => {
    it('are named icon buttons with no title attribute', () => {
      mockCanGroup = true;
      mockCanUngroup = true;
      mockIsLocked = false;
      render(<DmSelectionOptions />);
      for (const name of [
        'Rotate 90° counter-clockwise',
        'Rotate 90° clockwise',
        'Group',
        'Ungroup',
        'Lock',
        'Delete selected',
      ]) {
        const button = screen.getByRole('button', { name });
        expect(button).not.toHaveAttribute('title');
      }
    });

    it('marks Delete selected as a danger button', () => {
      render(<DmSelectionOptions />);
      expect(
        screen.getByRole('button', { name: 'Delete selected' })
      ).toHaveAttribute('data-variant', 'danger');
    });
  });

  it('builds every button from the Button primitive', () => {
    mockCanGroup = true;
    mockCanUngroup = true;
    const { container } = render(<DmSelectionOptions />);
    const selectionGroup = container.firstChild as HTMLElement;
    expect(selectionGroup).toHaveAttribute('role', 'group');
    const buttons = selectionGroup.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveAttribute('data-variant');
    }
  });
});
