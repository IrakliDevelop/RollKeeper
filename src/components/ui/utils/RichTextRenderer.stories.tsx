import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import RichTextRenderer from './RichTextRenderer';

const ALL_FORMATTING = [
  '<h1>Ashfall Keep</h1>',
  '<h2>The lower halls</h2>',
  '<h3>Room 4: the cistern</h3>',
  '<p>The water is <strong>waist deep</strong> and <em>very cold</em>. ',
  '<u>Mira</u> marked the dry ledge on <a href="https://example.com/map">the map</a>; ',
  '<s>the grate is open</s> the grate is rusted shut. Say <code>Vel-thar</code> to open the door.</p>',
  '<ul><li><p>Two giant rats</p></li><li><p>A drowned cleric</p></li></ul>',
  '<ol><li><p>Search the ledge</p></li><li><p>Pry the grate</p></li></ol>',
  '<blockquote><p>Those who drink here sleep for a hundred years.</p></blockquote>',
  '<pre><code>DC 15 Constitution save</code></pre>',
  '<hr>',
  '<table><tbody>',
  '<tr><th><p>Creature</p></th><th><p>HP</p></th><th><p>AC</p></th></tr>',
  '<tr><td><p>Giant rat</p></td><td><p>7</p></td><td><p>12</p></td></tr>',
  '<tr><td><p>Drowned cleric</p></td><td><p>27</p></td><td><p>13</p></td></tr>',
  '</tbody></table>',
].join('');

const meta: Meta<typeof RichTextRenderer> = {
  title: 'Utils/RichTextRenderer',
  component: RichTextRenderer,
  args: { content: ALL_FORMATTING },
  parameters: { a11y: { test: 'error' } },
};

export default meta;
type Story = StoryObj<typeof RichTextRenderer>;

export const AllFormatting: Story = {};

/** The two-line note preview in NotesManager. */
export const NotesPreview: Story = {
  render: args => (
    <div className="type-caption line-clamp-2">
      <RichTextRenderer {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('heading', {
      level: 1,
      name: 'Ashfall Keep',
    });
    const wrapper = title.parentElement?.parentElement as HTMLElement;

    await expect(getComputedStyle(title).fontSize).toBe('16.5px');
    await expect(wrapper.clientHeight).toBeLessThan(wrapper.scrollHeight);
  },
};

export const Dark: Story = {
  args: AllFormatting.args,
  globals: { theme: 'dark' },
};

export const Phone: Story = {
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('heading', { level: 1 })
      .parentElement as HTMLElement;

    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};
