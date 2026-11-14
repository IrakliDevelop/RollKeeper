import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import RichTextEditor from './RichTextEditor';
import { richTextEditorCss, richTextProseCss } from './richText/prose';

const TOOL_NAMES = [
  'Bold',
  'Italic',
  'Underline',
  'Strikethrough',
  'Inline code',
  'Heading 1',
  'Heading 2',
  'Heading 3',
  'Bullet list',
  'Numbered list',
  'Quote',
  'Horizontal line',
  'Insert table',
  'Clear formatting',
  'Undo',
  'Redo',
];

const CELL_TOOLS = [
  'Add column',
  'Add row',
  'Merge cells',
  'Split cell',
  'Delete table',
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
  props: Partial<Parameters<typeof RichTextEditor>[0]> = {}
) {
  return render(
    <RichTextEditor
      ariaLabel="Note content"
      content=""
      onChange={vi.fn()}
      {...props}
    />
  );
}

const tool = (name: string) => screen.getByRole('button', { name });

it('exposes the editor as a multiline textbox', async () => {
  renderEditor();
  const editor = await screen.findByRole('textbox', { name: 'Note content' });
  expect(editor).toHaveAttribute('aria-multiline', 'true');
});

it('names the toolbar after the editor', async () => {
  renderEditor();
  const toolbar = await screen.findByRole('toolbar', {
    name: 'Note content formatting',
  });
  const buttons = within(toolbar).getAllByRole('button');
  expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(TOOL_NAMES);
  for (const button of buttons) expect(button).not.toHaveAttribute('title');
});

it('presses Bold as soon as it is clicked', async () => {
  const user = userEvent.setup();
  renderEditor();
  await screen.findByRole('toolbar');
  await user.click(tool('Bold'));
  expect(tool('Bold')).toHaveAttribute('aria-pressed', 'true');
  expect(tool('Bold')).toHaveAttribute('data-selected', 'true');
  expect(tool('Italic')).toHaveAttribute('aria-pressed', 'false');
  expect(tool('Italic')).not.toHaveAttribute('data-selected');
  expect(tool('Insert table')).not.toHaveAttribute('aria-pressed');
  expect(tool('Undo')).not.toHaveAttribute('aria-pressed');
});

it('enables Undo after an edit and Redo after undoing', async () => {
  const user = userEvent.setup();
  renderEditor({ content: '<p></p>' });
  const textbox = await screen.findByRole('textbox', { name: 'Note content' });
  expect(tool('Undo')).toBeDisabled();
  expect(tool('Redo')).toBeDisabled();
  await user.click(tool('Horizontal line'));
  expect(tool('Undo')).toBeEnabled();
  expect(textbox.querySelector('hr')).not.toBeNull();
  await user.click(tool('Undo'));
  expect(tool('Redo')).toBeEnabled();
});

it('shows the placeholder for stored empty HTML', async () => {
  renderEditor({ content: '<p></p>', placeholder: 'Write your note here' });
  await screen.findByRole('textbox', { name: 'Note content' });
  expect(screen.getByText('Write your note here')).toBeInTheDocument();
  expect(tool('Undo')).toBeDisabled();
});

it('shows the cell tools only inside a table', async () => {
  const user = userEvent.setup();
  renderEditor();
  const textbox = await screen.findByRole('textbox', { name: 'Note content' });
  for (const name of CELL_TOOLS) {
    expect(screen.queryByRole('button', { name })).toBeNull();
  }
  await user.click(tool('Insert table'));
  expect(within(textbox).getByRole('table')).toBeInTheDocument();
  for (const name of CELL_TOOLS) expect(tool(name)).toBeInTheDocument();
  await user.click(tool('Delete table'));
  expect(within(textbox).queryByRole('table')).toBeNull();
  for (const name of CELL_TOOLS) {
    expect(screen.queryByRole('button', { name })).toBeNull();
  }
});

describe('roving focus', () => {
  it('keeps one tab stop and moves along the toolbar with arrow keys', async () => {
    const user = userEvent.setup();
    renderEditor({ content: '<p></p>' });
    const textbox = await screen.findByRole('textbox', {
      name: 'Note content',
    });
    const toolbar = screen.getByRole('toolbar');
    const bold = tool('Bold');
    for (const button of within(toolbar).getAllByRole('button')) {
      expect(button).toHaveAttribute('tabindex', button === bold ? '0' : '-1');
    }

    act(() => bold.focus());
    expect(bold).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tool('Italic')).toHaveFocus();
    expect(tool('Italic')).toHaveAttribute('tabindex', '0');
    expect(bold).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{End}');
    expect(tool('Clear formatting')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(bold).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tool('Clear formatting')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(bold).toHaveFocus();

    await user.tab();
    expect(textbox).toHaveFocus();
  });

  it('moves the tab stop when the focused tool disappears', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('textbox', { name: 'Note content' });
    await user.click(tool('Insert table'));
    await user.click(tool('Delete table'));
    expect(tool('Bold')).toHaveAttribute('tabindex', '0');
  });
});

it('has no placeholder by default and hides a given one from assistive tech', async () => {
  const user = userEvent.setup();
  const { unmount } = renderEditor();
  await screen.findByRole('textbox', { name: 'Note content' });
  expect(screen.queryByText('Start writing...')).toBeNull();
  unmount();

  renderEditor({ placeholder: 'Write your note here' });
  await screen.findByRole('textbox', { name: 'Note content' });
  expect(screen.getByText('Write your note here')).toHaveAttribute(
    'aria-hidden',
    'true'
  );
  await user.click(tool('Horizontal line'));
  expect(screen.queryByText('Write your note here')).toBeNull();
});

it('shows no loading text before the editor mounts', () => {
  // The server render is the pre-mount frame: no effects have run yet.
  const html = renderToStaticMarkup(
    <RichTextEditor ariaLabel="Note content" content="" onChange={vi.fn()} />
  );
  expect(html).not.toMatch(/loading/i);
});

it('keeps underline in the HTML and registers it once', async () => {
  const warn = vi.spyOn(console, 'warn');
  renderEditor({ content: '<p><u>Under</u></p>' });
  const textbox = await screen.findByRole('textbox', { name: 'Note content' });
  expect(within(textbox).getByText('Under').tagName).toBe('U');
  const duplicate = warn.mock.calls.some(call =>
    /duplicate extension/i.test(String(call[0]))
  );
  expect(duplicate).toBe(false);
});

it('prose CSS uses tokens only', () => {
  const css = richTextProseCss('.r') + richTextEditorCss('.s');
  expect(css).not.toMatch(/accent-|#[0-9a-f]{3,8}\b/i);
  expect(richTextEditorCss('.s')).toMatch(/@media \(pointer: coarse\)/);
});
