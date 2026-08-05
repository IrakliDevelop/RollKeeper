// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  EventMarker,
  DEFAULT_EVENT_COLOR,
  isValidHexColor,
} from '@/components/ui/calendar/EventMarker';

afterEach(cleanup);

describe('isValidHexColor', () => {
  it('accepts #rrggbb', () => {
    expect(isValidHexColor('#3b82f6')).toBe(true);
    expect(isValidHexColor('#ABCDEF')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor('')).toBe(false);
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#12345g')).toBe(false);
    expect(isValidHexColor('#1234567')).toBe(false);
  });
});

describe('EventMarker', () => {
  it('renders default blue dot for legacy event with no marker fields', () => {
    const { container } = render(<EventMarker event={{}} size="grid" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: DEFAULT_EVENT_COLOR });
    expect(dot).toHaveClass('h-1.5', 'w-1.5', 'rounded-full');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders dot with custom color', () => {
    const { container } = render(
      <EventMarker event={{ color: '#ff0000' }} size="row" />
    );
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: '#ff0000' });
    expect(dot).toHaveClass('h-2', 'w-2');
  });

  it('emoji takes precedence over color', () => {
    const { container } = render(
      <EventMarker event={{ emoji: '🐉', color: '#ff0000' }} size="grid" />
    );
    const marker = container.firstElementChild as HTMLElement;
    expect(marker).toHaveTextContent('🐉');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
    expect(marker.style.backgroundColor).toBe('');
  });

  it('empty-string emoji falls through to color', () => {
    const { container } = render(
      <EventMarker event={{ emoji: '', color: '#00ff00' }} size="grid" />
    );
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: '#00ff00' });
  });

  it('invalid color falls back to default blue', () => {
    for (const bad of ['red', '#12345', '#12345g']) {
      const { container, unmount } = render(
        <EventMarker event={{ color: bad }} size="grid" />
      );
      expect(container.firstElementChild).toHaveStyle({
        backgroundColor: DEFAULT_EVENT_COLOR,
      });
      unmount();
    }
  });

  it('merges className', () => {
    const { container } = render(
      <EventMarker event={{}} size="row" className="group-hover:scale-125" />
    );
    expect(container.firstElementChild).toHaveClass('group-hover:scale-125');
  });
});
