import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

const getTrigger = () => screen.getByRole('button', { name: 'Align' });

async function openMenu() {
  const user = userEvent.setup();
  const view = render(<DmLocationAlignMenu />);
  await user.click(getTrigger());
  return { user, ...view };
}

describe('DmLocationAlignMenu', () => {
  beforeEach(() => {
    mockCanAlign = true;
    mockCanDistribute = true;
    align.mockClear();
    distribute.mockClear();
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

  it('disables the trigger when alignment is not possible', () => {
    mockCanAlign = false;
    render(<DmLocationAlignMenu />);
    expect(getTrigger()).toBeDisabled();
    expect(getTrigger()).not.toHaveAttribute('title');
  });

  it('opens a portalled panel and marks the trigger expanded and selected', async () => {
    const { container } = await openMenu();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(getTrigger()).toHaveAttribute('data-selected');
    const dialog = screen.getByRole('dialog');
    expect(document.body).toContainElement(dialog);
    expect(container).not.toContainElement(dialog);
  });

  it('forwards each align edge exactly', async () => {
    const { user } = await openMenu();
    for (const [name, edge] of ALIGN_CASES) {
      await user.click(screen.getByRole('button', { name }));
      expect(align).toHaveBeenLastCalledWith(edge);
    }
    expect(align).toHaveBeenCalledTimes(6);
  });

  it('keeps the panel open after an align action', async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole('button', { name: 'Align left' }));
    expect(
      screen.getByRole('button', { name: 'Align top' })
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('disables distribute (but not align) below three movable elements', async () => {
    mockCanDistribute = false;
    await openMenu();
    expect(
      screen.getByRole('button', { name: 'Distribute horizontally' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Distribute vertically' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Align left' })).toBeEnabled();
  });

  it('forwards distribute axes when possible', async () => {
    const { user } = await openMenu();
    await user.click(
      screen.getByRole('button', { name: 'Distribute horizontally' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Distribute vertically' })
    );
    expect(distribute).toHaveBeenNthCalledWith(1, 'horizontal');
    expect(distribute).toHaveBeenNthCalledWith(2, 'vertical');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user } = await openMenu();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(getTrigger()).toHaveFocus());
  });

  it('closes when alignment becomes impossible', async () => {
    const { rerender } = await openMenu();
    expect(
      screen.getByRole('button', { name: 'Align left' })
    ).toBeInTheDocument();
    mockCanAlign = false;
    rerender(<DmLocationAlignMenu />);
    expect(
      screen.queryByRole('button', { name: 'Align left' })
    ).not.toBeInTheDocument();
  });
});
