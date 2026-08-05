import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import DmLocationToolOptions from '@/components/ui/campaign/location-map/DmLocationToolOptions';

let mockActiveTool = 'pencil';
let mockToolOptions: Record<string, Record<string, unknown> | undefined> = {};
const setOptionsSpies: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => [mockActiveTool, vi.fn()] as const,
  useToolOptions: (name: string) => {
    setOptionsSpies[name] ??= vi.fn();
    return [mockToolOptions[name], setOptionsSpies[name]] as const;
  },
}));

describe('DmLocationToolOptions pencil options', () => {
  beforeEach(() => {
    mockActiveTool = 'pencil';
    mockToolOptions = { pencil: { color: '#F4C430', width: 2.6 } };
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('shows a width slider bound to the pencil tool', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('2.6');
    fireEvent.change(slider, { target: { value: '6' } });
    expect(setOptionsSpies['pencil']).toHaveBeenCalledWith({ width: 6 });
  });

  it('routes color swatches to the pencil tool', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByTitle('#ef4444'));
    expect(setOptionsSpies['pencil']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('shows laser colors in battle-map mode and updates the laser tool', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByTitle('#ef4444'));
    expect(setOptionsSpies['laser']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('does not show laser options outside battle-map mode', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    const { container } = render(<DmLocationToolOptions mode="location" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no pencil tool is registered (location editor)', () => {
    mockToolOptions = { pencil: undefined };
    const { container } = render(<DmLocationToolOptions mode="location" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows ping colors in battle-map mode and updates the ping tool', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByTitle('#3b82f6'));
    expect(setOptionsSpies['ping']).toHaveBeenCalledWith({
      color: '#3b82f6',
    });
  });

  it('does not show ping options outside battle-map mode', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    const { container } = render(<DmLocationToolOptions mode="location" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DmLocationToolOptions measure sharing control', () => {
  beforeEach(() => {
    mockActiveTool = 'measure';
    mockToolOptions = { measure: { color: '#FF5722', feetPerCell: 5 } };
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('renders no share control when measureSharing is not provided', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    expect(screen.queryByLabelText(/share with players/i)).toBeNull();
  });

  it('renders the share toggle unchecked by default state and fires onChange', () => {
    const onChange = vi.fn();
    render(
      <DmLocationToolOptions
        mode="battlemap"
        measureSharing={{ enabled: false, onChange }}
      />
    );

    const toggle = screen.getByLabelText(/share with players/i);
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects enabled sharing state', () => {
    const onChange = vi.fn();
    render(
      <DmLocationToolOptions
        mode="battlemap"
        measureSharing={{ enabled: true, onChange }}
      />
    );

    const toggle = screen.getByLabelText(/share with players/i);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('sets measureOpts.color when a swatch is clicked', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByTitle('#22c55e'));
    expect(setOptionsSpies['measure']).toHaveBeenCalledWith({
      color: '#22c55e',
    });
  });

  it('reflects measureOpts.color as the active color for the measure tool', () => {
    mockToolOptions = { measure: { color: '#3b82f6', feetPerCell: 5 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    const swatch = screen.getByTitle('#3b82f6');
    expect(swatch.className).toContain('border-accent-blue-border');
  });
});
