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
  expect(
    screen.getByRole('heading', { name: 'Character preview', level: 2 })
  ).toBeInTheDocument();
  expect(screen.getByText('Unnamed')).toBeInTheDocument();
  expect(await screen.findByPlaceholderText('Elf')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Upload your character avatar' })
  ).toBeInTheDocument();
});

it('identifies the race and class detail controls', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('/races')
          ? [{ name: 'Human', displayName: 'Human' }]
          : {
              classes: [
                {
                  id: 'fighter',
                  name: 'Fighter',
                  source: 'PHB',
                  hitDie: 'd10',
                  primaryAbilities: [],
                  spellcasting: { type: 'none' },
                  proficiencies: { savingThrows: [] },
                  startingEquipment: [],
                  features: [],
                  subclasses: [],
                  isSrd: true,
                  tags: [],
                },
              ],
            },
    }))
  );
  render(<NewCharacterPage />);
  const details = await screen.findAllByRole('button', { name: 'Details' });
  expect(details).toHaveLength(2);
  expect(details[0]).toHaveAccessibleDescription('Race');
  expect(details[1]).toHaveAccessibleDescription('Class');
});
