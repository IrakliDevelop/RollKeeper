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
    <CharacterActions onExport={vi.fn()} onShare={onShare} onReset={onReset} />
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
it('leaves import on the player dashboard', async () => {
  const { container } = render(
    <CharacterActions onExport={vi.fn()} onShare={vi.fn()} onReset={vi.fn()} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Character' }));
  expect(
    await screen.findByRole('button', { name: 'Export character' })
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Import' })
  ).not.toBeInTheDocument();
  expect(container.querySelector('input[type="file"]')).toBeNull();
});
