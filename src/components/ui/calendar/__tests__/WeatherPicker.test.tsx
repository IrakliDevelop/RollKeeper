import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeatherPicker } from '../WeatherPicker';

afterEach(cleanup);

describe('WeatherPicker', () => {
  it('is a labelled group of toggle buttons', () => {
    const { container } = render(<WeatherPicker onChange={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Weather' })
    ).toHaveClass('type-subheading', 'text-heading');
    expect(container.querySelector('section')).toBeNull();
    const group = screen.getByRole('group', { name: 'Weather' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(13);
    expect(
      within(group).getByRole('button', { name: 'Heavy rain' })
    ).toBeInTheDocument();
    for (const button of buttons) {
      expect(button).toHaveAttribute('data-variant', 'outline');
      expect(button).not.toHaveAttribute('title');
    }
  });

  it('marks the current weather', () => {
    const { container } = render(
      <WeatherPicker current="fog" onChange={vi.fn()} />
    );
    const fog = screen.getByRole('button', { name: 'Fog' });
    expect(fog).toHaveAttribute('aria-pressed', 'true');
    expect(fog).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(
      container.querySelector('[class*="accent-"], .border-2, .rounded-lg')
    ).toBeNull();
  });

  it('reports a choice', () => {
    const onChange = vi.fn();
    render(<WeatherPicker onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Snow' }));
    expect(onChange).toHaveBeenCalledWith('snow');
  });
});
