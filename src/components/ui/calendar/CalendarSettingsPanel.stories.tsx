import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { createHarptosCalendar } from '@/utils/calendarPresets';
import { CalendarSettingsPanel } from './CalendarSettingsPanel';

const VIEWPORTS = {
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  desktop: { name: 'Desktop', styles: { width: '1180px', height: '820px' } },
};

function Harness() {
  return (
    <div className="p-4">
      <CalendarSettingsPanel config={createHarptosCalendar()} onSave={fn()} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Calendar/CalendarSettingsPanel',
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
 * On a phone the page never scrolls sideways, the season, moon and era names
 * stay wide enough to read, the season hour fields stay on screen, and the
 * remove buttons are big enough to tap. The phone viewport does not report a
 * coarse pointer, so the tap size checked is the 36px mouse size; the 44px
 * touch size comes from the Button primitive's pointer-coarse classes.
 */
export const Narrow390: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);

    for (const name of canvas.getAllByRole('textbox', { name: 'Name' })) {
      await expect(name.getBoundingClientRect().width).toBeGreaterThanOrEqual(
        191
      );
    }
    for (const sunset of canvas.getAllByRole('textbox', {
      name: 'Sunset (hour)',
    })) {
      await expect(sunset.getBoundingClientRect().right).toBeLessThanOrEqual(
        390
      );
    }
    for (const remove of canvas.getAllByRole('button', { name: /^Remove / })) {
      const rect = remove.getBoundingClientRect();
      await expect(rect.height).toBeGreaterThanOrEqual(36);
      await expect(rect.width).toBeGreaterThanOrEqual(36);
    }
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'Year and mechanics' })
    ).toBeVisible();
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
  },
};
