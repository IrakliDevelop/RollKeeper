import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CharacterActions } from '../CharacterActions';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('returns focus to its persistent trigger before opening Share or Reset', async () => {
  const onShare = vi.fn(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Character' })
    )
  );
  const onReset = vi.fn(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Character' })
    )
  );
  render(
    <CharacterActions
      onExport={vi.fn()}
      onShare={onShare}
      onReset={onReset}
      onAddToast={vi.fn()}
    />
  );
  for (const [label, callback] of [
    ['Share with QR code', onShare],
    ['Reset character', onReset],
  ] as const) {
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    fireEvent.click(await screen.findByRole('button', { name: label }));
    await waitFor(() => expect(callback).toHaveBeenCalledOnce());
  }
});
it('keeps the file input mounted after Import closes and resets it after malformed-file retries', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const toast = vi.fn();
  const { container } = render(
    <CharacterActions
      onExport={vi.fn()}
      onShare={vi.fn()}
      onReset={vi.fn()}
      onAddToast={toast}
    />
  );
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const choose = vi
    .spyOn(input as HTMLInputElement, 'click')
    .mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Character' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
  expect(choose).toHaveBeenCalledOnce();
  expect(document.body).toContainElement(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.change(input, {
      target: { files: [{ text: async () => 'invalid json' }] },
    });
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(attempt + 1));
    expect(input).toHaveValue('');
  }
  expect(toast).toHaveBeenLastCalledWith({
    type: 'error',
    title: "Couldn't import that file",
    message:
      'Choose a character .json file exported from RollKeeper and try again.',
  });
});
