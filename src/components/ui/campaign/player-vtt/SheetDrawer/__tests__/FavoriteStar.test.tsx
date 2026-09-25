import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

import { FavoriteStar } from '../tabs/FavoriteStar';

function seed(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    classes: [{ className: 'Fighter', level: 1, isCustom: false, hitDie: 10 }],
    sheetFavorites: [],
    ...overrides,
  } as CharacterState);
}

const getChar = () => useCharacterStore.getState().character;

beforeEach(() => {
  seed();
});

afterEach(() => {
  cleanup();
});

describe('FavoriteStar', () => {
  it('pins an item and flips aria-pressed', () => {
    render(<FavoriteStar kind="item" id="rope1" name="Rope, 50ft" />);
    const button = screen.getByRole('button', { name: 'Pin Rope, 50ft' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(getChar().sheetFavorites).toEqual([{ kind: 'item', id: 'rope1' }]);
    expect(
      screen.getByRole('button', { name: 'Unpin Rope, 50ft' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('unpins an already-pinned item', () => {
    seed({ sheetFavorites: [{ kind: 'item', id: 'rope1' }] });
    render(<FavoriteStar kind="item" id="rope1" name="Rope, 50ft" />);

    fireEvent.click(screen.getByRole('button', { name: 'Unpin Rope, 50ft' }));

    expect(getChar().sheetFavorites).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Pin Rope, 50ft' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('tracks favorites per-id — pinning one item does not pin another', () => {
    render(
      <>
        <FavoriteStar kind="item" id="rope1" name="Rope, 50ft" />
        <FavoriteStar kind="item" id="torch1" name="Torch" />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin Rope, 50ft' }));
    expect(screen.getByRole('button', { name: 'Pin Torch' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
