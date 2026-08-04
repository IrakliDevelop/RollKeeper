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
});
