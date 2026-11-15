import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import RichTextEditor from '../RichTextEditor';

type EditorProps = ComponentProps<typeof RichTextEditor>;

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

function StatefulEditor(args: EditorProps) {
  const [content, setContent] = useState(args.content);
  return (
    <RichTextEditor
      {...args}
      content={content}
      onChange={html => {
        setContent(html);
        args.onChange(html);
      }}
    />
  );
}

const meta: Meta<typeof RichTextEditor> = {
  title: 'Forms/RichTextEditor',
  component: RichTextEditor,
  args: { ariaLabel: 'Note content', content: '', onChange: fn() },
  parameters: { a11y: { test: 'error' } },
  render: args => <StatefulEditor {...args} />,
};

export default meta;
type Story = StoryObj<typeof RichTextEditor>;

export const Empty: Story = {
  args: {
    ariaLabel: 'Spell description',
    placeholder: 'Describe what the spell does',
  },
};

export const WithContent: Story = {
  args: { content: ALL_FORMATTING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textbox = await canvas.findByRole('textbox', {
      name: 'Note content',
    });
    const toolbar = canvas.getByRole('toolbar', {
      name: 'Note content formatting',
    });
    const frame = toolbar.parentElement as HTMLElement;
    const bold = canvas.getByRole('button', { name: 'Bold' });

    await expect(
      getComputedStyle(within(textbox).getByText('Vel-thar')).fontFamily
    ).toMatch(/monospace/);

    await userEvent.click(bold);
    await expect(bold).toHaveAttribute('aria-pressed', 'true');

    // The tool hands focus back to the text, and the box shows the ring.
    await waitFor(() => expect(textbox).toHaveFocus());
    await waitFor(() =>
      expect(getComputedStyle(frame).outlineStyle).toBe('solid')
    );

    bold.focus();
    await expect(bold).toHaveFocus();
    await waitFor(() =>
      expect(getComputedStyle(frame).outlineStyle).toBe('none')
    );
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Italic' })).toHaveFocus();
  },
};

export const Dark: Story = {
  args: WithContent.args,
  globals: { theme: 'dark' },
};

export const Touch: Story = {
  args: Empty.args,
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
    const textbox = await canvas.findByRole('textbox', {
      name: 'Spell description',
    });
    const placeholder = canvas.getByText('Describe what the spell does');
    const toolbar = canvas.getByRole('toolbar', {
      name: 'Spell description formatting',
    });

    await expect(getComputedStyle(textbox).fontSize).toBe('15px');
    const restore = emulateCoarsePointer();
    try {
      await expect(getComputedStyle(textbox).fontSize).toBe('16px');
      await expect(getComputedStyle(placeholder).fontSize).toBe('16px');
      for (const button of within(toolbar).getAllByRole('button')) {
        await expect(
          button.getBoundingClientRect().height
        ).toBeGreaterThanOrEqual(44);
      }
      await expect(toolbar.scrollWidth).toBeLessThanOrEqual(
        toolbar.clientWidth
      );
    } finally {
      restore();
    }
  },
};
