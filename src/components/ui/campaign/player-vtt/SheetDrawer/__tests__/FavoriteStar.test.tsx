import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';

import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

import { FavoriteStar } from '../tabs/FavoriteStar';
import { renderWithTooltips, stubResizeObserver } from './renderWithTooltips';

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
  stubResizeObserver();
  seed();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FavoriteStar', () => {
  it('pins an item and flips its selected state', () => {
    renderWithTooltips(
      <FavoriteStar kind="item" id="rope1" name="Rope, 50ft" />
    );
    const button = screen.getByRole('button', { name: 'Pin Rope, 50ft' });
    expect(button).not.toHaveAttribute('data-selected');
    expect(button).not.toHaveAttribute('aria-pressed');

    fireEvent.click(button);

    expect(getChar().sheetFavorites).toEqual([{ kind: 'item', id: 'rope1' }]);
    const unpin = screen.getByRole('button', { name: 'Unpin Rope, 50ft' });
    expect(unpin).toHaveAttribute('data-selected', 'true');
    expect(unpin).not.toHaveAttribute('aria-pressed');
  });

  it('unpins an already-pinned item', () => {
    seed({ sheetFavorites: [{ kind: 'item', id: 'rope1' }] });
    renderWithTooltips(
      <FavoriteStar kind="item" id="rope1" name="Rope, 50ft" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unpin Rope, 50ft' }));

    expect(getChar().sheetFavorites).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Pin Rope, 50ft' })
    ).not.toHaveAttribute('data-selected');
  });

  it('tracks favorites per-id — pinning one item does not pin another', () => {
    renderWithTooltips(
      <>
        <FavoriteStar kind="item" id="rope1" name="Rope, 50ft" />
        <FavoriteStar kind="item" id="torch1" name="Torch" />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin Rope, 50ft' }));
    expect(
      screen.getByRole('button', { name: 'Pin Torch' })
    ).not.toHaveAttribute('data-selected');
  });
});
