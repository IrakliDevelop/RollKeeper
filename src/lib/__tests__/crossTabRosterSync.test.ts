import { describe, it, expect, vi } from 'vitest';

import { initCrossTabRosterSync } from '@/lib/crossTabRosterSync';
import { PLAYER_STORAGE_KEY } from '@/utils/constants';

const entry = (id: string, revision: number, lastMutatedAt?: number) => ({
  id,
  name: id,
  characterData: { id, revision, lastMutatedAt },
});

function makeStore(initial: ReturnType<typeof entry>[]) {
  let characters = initial;
  return {
    getState: () => ({ characters }),
    setState: vi.fn((partial: { characters: typeof characters }) => {
      characters = partial.characters;
    }),
    read: () => characters,
  };
}

const fire = (characters: unknown[]) =>
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: PLAYER_STORAGE_KEY,
      newValue: JSON.stringify({ state: { characters }, version: 0 }),
      storageArea: localStorage,
    })
  );

describe('cross-tab roster ordering', () => {
  it('equal revision with fresher stamp wins (the old code ignored this)', () => {
    const store = makeStore([entry('a', 3, 100)]);
    const stop = initCrossTabRosterSync(
      store as unknown as Parameters<typeof initCrossTabRosterSync>[0]
    );
    fire([entry('a', 3, 200)]);
    expect(store.read()[0].characterData.lastMutatedAt).toBe(200);
    stop();
  });

  it('stale incoming entries are kept out', () => {
    const store = makeStore([entry('a', 5, 100)]);
    const stop = initCrossTabRosterSync(
      store as unknown as Parameters<typeof initCrossTabRosterSync>[0]
    );
    fire([entry('a', 4, 999)]);
    expect(store.read()[0].characterData.revision).toBe(5);
    stop();
  });
});
