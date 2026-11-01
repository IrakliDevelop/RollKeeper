import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import NewCharacterPage from '../page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/races') ? [] : { classes: [] }),
    }))
  );
});

afterEach(() => vi.unstubAllGlobals());

it('offers one new-character heading and a primary submit', async () => {
  render(<NewCharacterPage />);
  expect(
    screen.getAllByRole('heading', { name: 'New character' })
  ).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'Create character' })
  ).toHaveAttribute('type', 'submit');
  expect(screen.getByRole('link', { name: 'Characters' })).toHaveAttribute(
    'href',
    '/player'
  );
});
