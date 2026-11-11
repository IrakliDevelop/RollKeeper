import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BestiaryImport } from '../BestiaryImport';
import { PortraitField } from '../PortraitField';
import { TagsField } from '../TagsField';
import type { usePortraitUpload } from '../usePortraitUpload';
import { GOBLIN } from './npcFormFixtures';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // `fill` and `priority` are next/image-only props, not native <img> attributes.
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

const PORTRAIT_URL =
  'https://rollkeeper-images.s3.eu-central-1.amazonaws.com/npc/brenn.png';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BestiaryImport', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ monsters: [GOBLIN] }))
    );
  });

  it('selecting a creature calls onSelect and clears the search', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <BestiaryImport sourceName={null} onSelect={onSelect} onClear={vi.fn()} />
    );
    const search = screen.getByRole('textbox', {
      name: 'Search the bestiary',
    });
    await user.type(search, 'gob');
    await user.click(await screen.findByRole('button', { name: /Goblin/ }));
    expect(onSelect).toHaveBeenCalledWith(GOBLIN);
    expect(search).toHaveValue('');
  });

  it('shows the retry state when the bestiary fails to load', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(
      <BestiaryImport sourceName={null} onSelect={vi.fn()} onClear={vi.fn()} />
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search the bestiary' }),
      'gob'
    );
    expect(await screen.findByText("Bestiary didn't load.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry search' })).toBeTruthy();
  });

  it('shows the source and clears the import', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <BestiaryImport
        sourceName="Goblin"
        onSelect={vi.fn()}
        onClear={onClear}
      />
    );
    expect(screen.getByText('Imported from Goblin')).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Clear import from Goblin' })
    );
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows no source line without an import', () => {
    render(
      <BestiaryImport sourceName={null} onSelect={vi.fn()} onClear={vi.fn()} />
    );
    expect(screen.queryByText(/Imported from/)).toBeNull();
  });
});

function stubPortrait(
  overrides: Partial<ReturnType<typeof usePortraitUpload>> = {}
): ReturnType<typeof usePortraitUpload> {
  return {
    uploading: false,
    error: null,
    upload: vi.fn(async () => {}),
    remove: vi.fn(),
    commit: vi.fn(),
    discardAll: vi.fn(),
    ...overrides,
  };
}

describe('PortraitField', () => {
  it('offers only Add portrait when there is no portrait', () => {
    const { container } = render(
      <PortraitField url="" portrait={stubPortrait()} />
    );
    expect(screen.getByRole('button', { name: 'Add portrait' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Remove portrait' })
    ).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the preview, Change and Remove when a portrait is set', async () => {
    const user = userEvent.setup();
    const portrait = stubPortrait();
    const { container } = render(
      <PortraitField url={PORTRAIT_URL} portrait={portrait} />
    );
    expect(
      screen.getByRole('button', { name: 'Change portrait' })
    ).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    await user.click(screen.getByRole('button', { name: 'Remove portrait' }));
    expect(portrait.remove).toHaveBeenCalledTimes(1);
  });

  it('passes the chosen file to upload', async () => {
    const user = userEvent.setup();
    const portrait = stubPortrait();
    const { container } = render(<PortraitField url="" portrait={portrait} />);
    const file = new File(['x'], 'brenn.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]');
    await user.upload(input as HTMLInputElement, file);
    expect(portrait.upload).toHaveBeenCalledWith(file);
  });

  it('disables Add portrait while uploading', () => {
    render(
      <PortraitField url="" portrait={stubPortrait({ uploading: true })} />
    );
    expect(screen.getByRole('button', { name: 'Add portrait' })).toBeDisabled();
  });

  it.each([
    ['type', 'Choose an image file.'],
    ['size', 'Choose an image under 5 MB.'],
    ['upload', "The portrait wasn't uploaded. Try again."],
  ] as const)('shows the %s error', (error, message) => {
    render(<PortraitField url="" portrait={stubPortrait({ error })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('shows no alert without an error', () => {
    render(<PortraitField url="" portrait={stubPortrait()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('TagsField', () => {
  function renderTags(tags: string[] = []) {
    const handlers = {
      onAdd: vi.fn(),
      onRemove: vi.fn(),
      onRemoveLast: vi.fn(),
    };
    render(<TagsField tags={tags} {...handlers} />);
    return {
      ...handlers,
      input: screen.getByRole('textbox', { name: 'Tags' }),
    };
  }

  it('adds a tag on Enter and clears the text', async () => {
    const user = userEvent.setup();
    const { input, onAdd } = renderTags();
    await user.type(input, 'merchant{Enter}');
    expect(onAdd).toHaveBeenCalledWith('merchant');
    expect(input).toHaveValue('');
  });

  it('adds a tag on comma and clears the text', async () => {
    const user = userEvent.setup();
    const { input, onAdd } = renderTags();
    await user.type(input, 'merchant,');
    expect(onAdd).toHaveBeenCalledWith('merchant');
    expect(input).toHaveValue('');
  });

  it('adds a tag on blur and clears the text', async () => {
    const user = userEvent.setup();
    const { input, onAdd } = renderTags();
    await user.type(input, 'merchant');
    await user.tab();
    expect(onAdd).toHaveBeenCalledWith('merchant');
    expect(input).toHaveValue('');
  });

  it('does not add a blank tag on blur', async () => {
    const user = userEvent.setup();
    const { input, onAdd } = renderTags();
    await user.type(input, '   ');
    await user.tab();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('removes the last tag on Backspace in an empty field', async () => {
    const user = userEvent.setup();
    const { input, onRemoveLast } = renderTags(['merchant']);
    await user.click(input);
    await user.keyboard('{Backspace}');
    expect(onRemoveLast).toHaveBeenCalledTimes(1);
  });

  it('ignores a held Backspace so one press removes one tag', async () => {
    const user = userEvent.setup();
    const { input, onRemoveLast } = renderTags(['merchant', 'smith']);
    await user.click(input);
    fireEvent.keyDown(input, { key: 'Backspace', repeat: true });
    expect(onRemoveLast).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onRemoveLast).toHaveBeenCalledTimes(1);
  });

  it('keeps Backspace for editing when the field has text', async () => {
    const user = userEvent.setup();
    const { input, onRemoveLast } = renderTags(['merchant']);
    await user.type(input, 'ab{Backspace}');
    expect(onRemoveLast).not.toHaveBeenCalled();
    expect(input).toHaveValue('a');
  });

  it('removes a tag from its button', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderTags(['merchant', 'guard']);
    await user.click(
      screen.getByRole('button', { name: 'Remove tag merchant' })
    );
    expect(onRemove).toHaveBeenCalledWith('merchant');
  });

  it('shows the tag list only when tags exist', () => {
    renderTags();
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull();
    cleanup();
    renderTags(['merchant']);
    expect(screen.getByRole('list', { name: 'Tags' })).toBeTruthy();
  });
});
