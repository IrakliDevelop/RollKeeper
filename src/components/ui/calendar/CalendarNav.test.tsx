import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarNav } from './CalendarNav';
import type { CalendarConfig } from '@/types/calendar';

afterEach(cleanup);

describe('CalendarNav', () => {
  it('names both month navigation controls', () => {
    render(
      <CalendarNav
        browseYear={1}
        browseMonth={0}
        config={
          {
            months: [{ name: 'Hammer', days: 30 }],
            eras: [],
          } as unknown as CalendarConfig
        }
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
        isBrowsing={false}
      />
    );
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
  });
});
