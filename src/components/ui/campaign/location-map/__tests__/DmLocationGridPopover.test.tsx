import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

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

describe('DmLocationGridPopover', () => {
  afterEach(() => cleanup());

  it('is closed by default and shows the current grid state on the trigger', () => {
    render(<DmLocationGridPopover {...baseProps} />);
    expect(screen.getByTitle('Grid settings')).toHaveTextContent('Grid: Hex');
    expect(screen.queryByTitle('Square grid')).not.toBeInTheDocument();
  });

  it('shows "Off" on the trigger when the grid is disabled', () => {
    render(<DmLocationGridPopover {...baseProps} gridEnabled={false} />);
    expect(screen.getByTitle('Grid settings')).toHaveTextContent('Grid: Off');
  });

  it('opens on trigger click and forwards grid-type selection', () => {
    render(<DmLocationGridPopover {...baseProps} />);
    fireEvent.click(screen.getByTitle('Grid settings'));
    fireEvent.click(screen.getByTitle('Square grid'));
    expect(baseProps.onSetGridType).toHaveBeenCalledWith('square');
  });

  it('forwards slider changes to onUpdateGridSettings', () => {
    render(<DmLocationGridPopover {...baseProps} />);
    fireEvent.click(screen.getByTitle('Grid settings'));
    fireEvent.change(screen.getByTitle('Grid cell size'), {
      target: { value: '80' },
    });
    expect(baseProps.onUpdateGridSettings).toHaveBeenCalledWith({
      cellSize: 80,
    });
  });

  it('hides the settings rows (but not the type selector) when grid is disabled', () => {
    render(<DmLocationGridPopover {...baseProps} gridEnabled={false} />);
    fireEvent.click(screen.getByTitle('Grid settings'));
    expect(screen.getByTitle('No grid')).toBeInTheDocument();
    expect(screen.queryByTitle('Grid cell size')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<DmLocationGridPopover {...baseProps} />);
    fireEvent.click(screen.getByTitle('Grid settings'));
    expect(screen.getByTitle('No grid')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTitle('No grid')).not.toBeInTheDocument();
  });

  it('closes on outside pointerdown but not on inside pointerdown', () => {
    render(
      <div>
        <button data-testid="outside">outside</button>
        <DmLocationGridPopover {...baseProps} />
      </div>
    );
    fireEvent.click(screen.getByTitle('Grid settings'));
    fireEvent.pointerDown(screen.getByTitle('No grid'));
    expect(screen.getByTitle('No grid')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByTitle('No grid')).not.toBeInTheDocument();
  });
});
