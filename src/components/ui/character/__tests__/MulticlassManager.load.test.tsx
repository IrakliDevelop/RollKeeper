import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import MulticlassManager from '../MulticlassManager';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows the approved recovery message when the classes request fails', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(null, { status: 503 })
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <MulticlassManager
      character={makeCharacter()}
      onAddClassLevel={vi.fn()}
      onRemoveClassLevel={vi.fn()}
      onUpdateClassLevel={vi.fn()}
    />
  );
  expect(
    await screen.findByText(
      "Classes didn't load. Check your connection and open Manage classes again."
    )
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add class' })
  ).not.toBeInTheDocument();
});
