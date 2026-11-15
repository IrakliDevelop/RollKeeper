import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { CompactRichTextEditor } from './CompactRichTextEditor';

const TOOL_NAMES = [
  'Bold',
  'Italic',
  'Underline',
  'Bullet list',
  'Numbered list',
];

beforeAll(() => {
  // TipTap's focus() scrolls the selection into view in a rAF, and jsdom has
  // no Range geometry.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  document.elementFromPoint ??= () => null;
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderEditor(
  props: Partial<Parameters<typeof CompactRichTextEditor>[0]> = {}
) {
  return render(
    <CompactRichTextEditor
      ariaLabel="Lore"
      content=""
      onChange={vi.fn()}
      {...props}
    />
  );
}

const tool = (name: string) => screen.getByRole('button', { name });

it('exposes a named multiline textbox', async () => {
  renderEditor();
  const textbox = await screen.findByRole('textbox', { name: 'Lore' });
  expect(textbox).toHaveAttribute('aria-multiline', 'true');
});

it('is still a textbox when no label is passed', async () => {
  renderEditor({ ariaLabel: undefined });
  const textbox = await screen.findByRole('textbox');
  expect(textbox).not.toHaveAttribute('aria-label');
  expect(screen.getByRole('toolbar')).not.toHaveAttribute('aria-label');
});

it('names the toolbar and its five tools', async () => {
  renderEditor();
  await screen.findByRole('textbox', { name: 'Lore' });
  const toolbar = screen.getByRole('toolbar', { name: 'Lore formatting' });
  const buttons = within(toolbar).getAllByRole('button');
  expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(TOOL_NAMES);
  for (const button of buttons) expect(button).not.toHaveAttribute('title');
});

it('presses a tool as soon as it is clicked', async () => {
  const user = userEvent.setup();
  renderEditor();
  await screen.findByRole('textbox', { name: 'Lore' });
  await user.click(tool('Underline'));
  expect(tool('Underline')).toHaveAttribute('aria-pressed', 'true');
  expect(tool('Underline')).toHaveAttribute('data-selected', 'true');
  expect(tool('Bold')).toHaveAttribute('aria-pressed', 'false');
});

it('moves along the toolbar with arrow keys', async () => {
  const user = userEvent.setup();
  renderEditor({ content: '<p></p>' });
  await screen.findByRole('textbox', { name: 'Lore' });
  const bold = tool('Bold');
  expect(bold).toHaveAttribute('tabindex', '0');
  act(() => bold.focus());
  expect(bold).toHaveFocus();
  await user.keyboard('{ArrowRight}');
  expect(tool('Italic')).toHaveFocus();
  await user.keyboard('{End}');
  expect(tool('Numbered list')).toHaveFocus();
});

it('has no placeholder by default', async () => {
  const { unmount } = renderEditor();
  await screen.findByRole('textbox', { name: 'Lore' });
  expect(screen.queryByText('Description...')).toBeNull();
  unmount();

  const second = renderEditor({ placeholder: 'Add lore' });
  await screen.findByRole('textbox', { name: 'Lore' });
  expect(screen.getByText('Add lore')).toHaveAttribute('aria-hidden', 'true');
  second.unmount();

  // Stored empty HTML equals getHTML(), so no transaction ever runs.
  renderEditor({ content: '<p></p>', placeholder: 'Add lore' });
  await screen.findByRole('textbox', { name: 'Lore' });
  expect(screen.getByText('Add lore')).toHaveAttribute('aria-hidden', 'true');
});

it('keeps underline in the HTML and registers it once', async () => {
  const warn = vi.spyOn(console, 'warn');
  renderEditor({ content: '<p><u>Under</u></p>' });
  const textbox = await screen.findByRole('textbox', { name: 'Lore' });
  expect(within(textbox).getByText('Under').tagName).toBe('U');
  const duplicate = warn.mock.calls.some(call =>
    /duplicate extension/i.test(String(call[0]))
  );
  expect(duplicate).toBe(false);
});
