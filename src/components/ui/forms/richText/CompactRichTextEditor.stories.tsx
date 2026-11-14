import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { CompactRichTextEditor } from '../CompactRichTextEditor';

type EditorProps = ComponentProps<typeof CompactRichTextEditor>;

const LORE = [
  '<p>The <strong>Ashen Circle</strong> meets under the old mill. ',
  '<em>Nobody</em> leaves before the bell.</p>',
  '<ul><li><p>Knows the cistern route</p></li><li><p>Owes Mira a favour</p></li></ul>',
  // Ends on a paragraph: StarterKit's trailing node would otherwise add one on
  // the first transaction, and that step drops a just-pressed mark.
  '<p>Last seen at the Copper Kettle.</p>',
].join('');

function StatefulEditor(args: EditorProps) {
  const [content, setContent] = useState(args.content);
  return (
    <CompactRichTextEditor
      {...args}
      content={content}
      onChange={html => {
        setContent(html);
        args.onChange(html);
      }}
    />
  );
}

const meta: Meta<typeof CompactRichTextEditor> = {
  title: 'Forms/CompactRichTextEditor',
  component: CompactRichTextEditor,
  args: { ariaLabel: 'Lore', content: '', onChange: fn() },
  parameters: { a11y: { test: 'error' } },
  render: args => <StatefulEditor {...args} />,
};

export default meta;
type Story = StoryObj<typeof CompactRichTextEditor>;

export const NpcLore: Story = {
  args: { ariaLabel: 'Lore', content: LORE, minHeight: '240px' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textbox = await canvas.findByRole('textbox', { name: 'Lore' });
    const bold = canvas.getByRole('button', { name: 'Bold' });

    await userEvent.click(bold);
    await expect(bold).toHaveAttribute('aria-pressed', 'true');

    // The tool hands focus back to the text; focus the tool after that.
    await waitFor(() => expect(textbox).toHaveFocus());
    bold.focus();
    await expect(bold).toHaveFocus();
    // The frame clips overflow: the ring has to sit inside the thin padding.
    await expect(getComputedStyle(bold).outlineOffset).toBe('0px');
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Italic' })).toHaveFocus();
  },
};

export const MarkerTitle: Story = {
  args: { ariaLabel: 'Title', content: '', minHeight: '44px' },
};

export const Dark: Story = {
  args: { ariaLabel: 'Lore', content: LORE, minHeight: '240px' },
  globals: { theme: 'dark' },
};

export const Touch: Story = {
  args: { ariaLabel: 'Lore', content: LORE, minHeight: '240px' },
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
    const textbox = await canvas.findByRole('textbox', { name: 'Lore' });
    const toolbar = canvas.getByRole('toolbar', { name: 'Lore formatting' });

    await expect(getComputedStyle(textbox).fontSize).toBe('13px');
    const restore = emulateCoarsePointer();
    try {
      await expect(getComputedStyle(textbox).fontSize).toBe('16px');
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
