import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DmLocationGridPopover from '@/components/ui/campaign/location-map/DmLocationGridPopover';

const baseProps = {
  gridEnabled: true,
  gridType: 'hex' as const,
  gridCellSize: 50,
  gridColor: '#94a3b8',
  gridOpacity: 0.5,
  onSetGridType: vi.fn(),
  onUpdateGridSettings: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  baseProps.onSetGridType.mockClear();
  baseProps.onUpdateGridSettings.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const getTrigger = () => screen.getByRole('button', { name: /^Grid:/ });

async function openPopover(props: Partial<typeof baseProps> = {}) {
  const user = userEvent.setup();
  const view = render(<DmLocationGridPopover {...baseProps} {...props} />);
  await user.click(getTrigger());
  return { user, ...view };
}

describe('DmLocationGridPopover', () => {
  it('is closed by default and shows the current grid state on the trigger', () => {
    render(<DmLocationGridPopover {...baseProps} />);
    const trigger = getTrigger();
    expect(trigger).toHaveTextContent('Grid: Hex');
    expect(trigger).not.toHaveAttribute('title');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows "Off" on the trigger when the grid is disabled', () => {
    render(<DmLocationGridPopover {...baseProps} gridEnabled={false} />);
    expect(getTrigger()).toHaveTextContent('Grid: Off');
  });

  it('opens a portalled dialog and marks the trigger expanded and selected', async () => {
    const { container } = await openPopover();
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-selected');
    const dialog = screen.getByRole('dialog', { name: 'Grid' });
    expect(document.body).toContainElement(dialog);
    expect(container).not.toContainElement(dialog);
  });

  it('names the grid type group and reflects the type in aria-pressed', async () => {
    await openPopover();
    const group = within(screen.getByRole('group', { name: 'Grid type' }));
    const pressed = (name: string) =>
      group.getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Off')).toBe('false');
    expect(pressed('Hex')).toBe('true');
    expect(pressed('Square')).toBe('false');
  });

  it('reflects Off when the grid is disabled', async () => {
    await openPopover({ gridEnabled: false });
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Hex' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('forwards grid-type selection', async () => {
    const { user } = await openPopover();
    await user.click(screen.getByRole('button', { name: 'Square' }));
    expect(baseProps.onSetGridType).toHaveBeenCalledWith('square');
  });

  it('forwards slider changes to onUpdateGridSettings', async () => {
    await openPopover();
    fireEvent.change(screen.getByRole('slider', { name: 'Grid cell size' }), {
      target: { value: '80' },
    });
    expect(baseProps.onUpdateGridSettings).toHaveBeenCalledWith({
      cellSize: 80,
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Grid opacity' }), {
      target: { value: '70' },
    });
    expect(baseProps.onUpdateGridSettings).toHaveBeenLastCalledWith({
      opacity: 0.7,
    });
  });

  it('shows the values beside the sliders', async () => {
    await openPopover();
    expect(screen.getByText('50px')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('steps size and opacity with the existing clamps', async () => {
    const { user, rerender } = await openPopover({ gridCellSize: 20 });
    await user.click(
      screen.getByRole('button', { name: 'Decrease grid size' })
    );
    expect(baseProps.onUpdateGridSettings).toHaveBeenLastCalledWith({
      cellSize: 20,
    });
    await user.click(
      screen.getByRole('button', { name: 'Increase grid size' })
    );
    expect(baseProps.onUpdateGridSettings).toHaveBeenLastCalledWith({
      cellSize: 21,
    });

    rerender(
      <DmLocationGridPopover
        {...baseProps}
        gridCellSize={150}
        gridOpacity={1}
      />
    );
    await user.click(
      screen.getByRole('button', { name: 'Increase grid size' })
    );
    expect(baseProps.onUpdateGridSettings).toHaveBeenLastCalledWith({
      cellSize: 150,
    });
    await user.click(screen.getByRole('button', { name: 'Increase opacity' }));
    expect(baseProps.onUpdateGridSettings).toHaveBeenLastCalledWith({
      opacity: 1,
    });
    await user.click(screen.getByRole('button', { name: 'Decrease opacity' }));
    expect(
      baseProps.onUpdateGridSettings.mock.calls.at(-1)?.[0].opacity
    ).toBeCloseTo(0.99);
  });

  it('forwards colour changes from the native colour input', async () => {
    await openPopover();
    fireEvent.change(screen.getByLabelText('Grid color'), {
      target: { value: '#ff0000' },
    });
    expect(baseProps.onUpdateGridSettings).toHaveBeenCalledWith({
      strokeColor: '#ff0000',
    });
  });

  it('hides the settings rows (but not the type selector) when grid is disabled', async () => {
    await openPopover({ gridEnabled: false });
    expect(
      screen.getByRole('group', { name: 'Grid type' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: 'Grid cell size' })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Grid color')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user } = await openPopover();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(getTrigger()).toHaveFocus());
  });
});
