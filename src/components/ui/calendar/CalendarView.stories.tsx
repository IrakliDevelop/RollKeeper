import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useCalendarStore } from '@/store/calendarStore';
import { dateToTime } from '@/utils/calendarCalculations';
import {
  createDefaultCalendar,
  createHarptosCalendar,
} from '@/utils/calendarPresets';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';
import { CalendarView } from './CalendarView';

const CODE = 'K7QX2M';

const VIEWPORTS = {
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  desktop: { name: 'Desktop', styles: { width: '1180px', height: '820px' } },
};

const makeEvent = (
  id: string,
  title: string,
  day: number,
  month = 0,
  year = 1
): CalendarEvent => ({
  id,
  title,
  description: '',
  year,
  month,
  day,
  createdAt: day,
});

const seed = (
  config: CalendarConfig,
  time: Parameters<typeof dateToTime>[0],
  events: CalendarEvent[]
) =>
  function seedCalendar() {
    const currentTime = dateToTime(time, config);
    useCalendarStore.setState({
      calendars: [
        {
          campaignCode: CODE,
          config,
          currentTime,
          startTime: currentTime,
          events,
          weather: 'rain',
        },
      ],
    });
    return () => useCalendarStore.setState({ calendars: [] });
  };

function Harness() {
  return (
    <div className="p-4" data-testid="calendar-root">
      <CalendarView campaignCode={CODE} onReset={fn()} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Calendar/CalendarView',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * On a phone the page never scrolls sideways: the ten Harptos columns scroll
 * inside the grid, the day popover stays inside it, and the Events tab fits.
 */
export const Narrow390: Story = {
  beforeEach: seed(
    createHarptosCalendar(),
    { year: 1492, month: 0, dayOfMonth: 4, hour: 9, minute: 0, second: 0 },
    [makeEvent('e1', 'Market', 4, 0, 1492)]
  ),
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    const scroller = canvasElement.querySelector('table')!.parentElement!;
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);

    await userEvent.click(
      canvas.getByRole('button', { name: '5 Hammer 1492' })
    );
    const addButton = canvas.getByRole('button', { name: 'Add event' });
    const pop = addButton.closest('.absolute')!.getBoundingClientRect();
    const box = addButton.closest('.relative')!.getBoundingClientRect();
    await expect(pop.left).toBeGreaterThanOrEqual(box.left - 1);
    await expect(pop.right).toBeLessThanOrEqual(box.right + 1);
    await expect(pop.right).toBeLessThanOrEqual(390);

    await userEvent.click(canvas.getByRole('tab', { name: /^Events/ }));
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  },
};

export const Dark: Story = {
  beforeEach: seed(
    createDefaultCalendar(),
    { year: 1, month: 0, dayOfMonth: 4, hour: 14, minute: 30, second: 0 },
    [makeEvent('e1', 'Market', 4), makeEvent('e2', 'Feast', 9)]
  ),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Edit time' })
    ).toBeVisible();
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
  },
};
