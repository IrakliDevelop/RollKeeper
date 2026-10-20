import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import BookmarkTabs, { type BookmarkTabItem } from './BookmarkTabs';

/**
 * The character sheet's tabs: text tabs on a 1px divider rule, the active
 * one in heading text with a 2px brass underline. The panel sits on the
 * page canvas. Arrow keys, Home and End move between tabs and open them.
 */
const meta: Meta<typeof BookmarkTabs> = {
  title: 'Layout/BookmarkTabs',
  component: BookmarkTabs,
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const TABS: BookmarkTabItem[] = [
  { id: 'actions', label: 'Actions', content: <p>Longsword +5, 1d8 + 3</p> },
  { id: 'stats', label: 'Stats', content: <p>Strength 16, Dexterity 12</p> },
  { id: 'combat', label: 'Combat', content: <p>Hit points 24 of 31</p> },
  { id: 'spells', label: 'Spells', content: <p>2 of 3 slots left</p> },
];

const BRASS = { paper: 'rgb(160, 123, 44)', felt: 'rgb(200, 161, 75)' };

async function checkTabs(
  canvasElement: HTMLElement,
  theme: keyof typeof BRASS
) {
  const canvas = within(canvasElement);
  const actions = canvas.getByRole('tab', { name: 'Actions' });

  await waitFor(() => {
    const style = getComputedStyle(actions);
    expect(style.borderBottomWidth).toBe('2px');
    expect(style.borderBottomColor).toBe(BRASS[theme]);
  });
  const panel = canvas.getByRole('tabpanel');
  const box = getComputedStyle(panel.parentElement!);
  await expect(box.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  await expect(box.borderTopWidth).toBe('0px');
  await expect(box.boxShadow).toBe('none');

  // Keyboard: Tab lands on the active tab, arrows move and open.
  await userEvent.tab();
  await expect(actions).toHaveFocus();
  await waitFor(() => {
    const outline = getComputedStyle(actions);
    expect(outline.outlineStyle).toBe('solid');
    expect(outline.outlineColor).toBe(BRASS[theme]);
  });
  await userEvent.keyboard('{ArrowRight}');
  const stats = canvas.getByRole('tab', { name: 'Stats' });
  await expect(stats).toHaveFocus();
  await expect(stats).toHaveAttribute('aria-selected', 'true');
  await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Strength 16');
  await userEvent.keyboard('{End}');
  await expect(canvas.getByRole('tab', { name: 'Spells' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  await expect(actions).toHaveFocus();

  // Touch: tabs reach 44px.
  const restore = emulateCoarsePointer();
  try {
    await expect(actions.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44
    );
  } finally {
    restore();
  }
}

export const Default: Story = {
  args: { tabs: TABS },
  play: ({ canvasElement }) => checkTabs(canvasElement, 'paper'),
};

export const DefaultDark: Story = {
  args: { tabs: TABS },
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkTabs(canvasElement, 'felt'),
};

const MANY_TABS: BookmarkTabItem[] = [
  'Actions',
  'Stats',
  'Combat',
  'Spells',
  'Inventory',
  'Features',
  'Character',
].map(label => ({
  id: label.toLowerCase(),
  label,
  content: <p>{label} panel</p>,
}));

/** A narrow strip: arrowing to a tab never leaves it under a chevron. */
export const NarrowStrip: Story = {
  args: { tabs: MANY_TABS },
  render: args => (
    <div className="w-[300px]">
      <BookmarkTabs {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    for (const label of MANY_TABS.slice(1).map(tab => tab.label)) {
      await userEvent.keyboard('{ArrowRight}');
      const tab = canvas.getByRole('tab', { name: label });
      await expect(tab).toHaveFocus();
      await waitFor(() => {
        const rect = tab.getBoundingClientRect();
        for (const name of ['Scroll tabs left', 'Scroll tabs right']) {
          const chevron = canvas.queryByRole('button', { name });
          if (!chevron) continue;
          const box = chevron.getBoundingClientRect();
          // 1px of slack for sub-pixel tab widths.
          expect(rect.right <= box.left + 1 || rect.left >= box.right - 1).toBe(
            true
          );
        }
      });
    }
  },
};
