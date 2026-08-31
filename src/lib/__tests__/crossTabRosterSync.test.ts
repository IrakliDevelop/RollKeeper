import { describe, it, expect, vi } from 'vitest';

import { initCrossTabRosterSync } from '@/lib/crossTabRosterSync';
import { PLAYER_STORAGE_KEY } from '@/utils/constants';

const entry = (id: string, revision: number, lastMutatedAt?: number) => ({
  id,
  name: id,
  characterData: { id, revision, lastMutatedAt },
});

function makeStore(
  initial: ReturnType<typeof entry>[],
  characterTombstones: Record<string, unknown> = {}
) {
  let characters = initial;
  let tombstones = characterTombstones;
  return {
    getState: () => ({ characters, characterTombstones: tombstones }),
    setState: vi.fn(
      (partial: {
        characters: typeof characters;
        characterTombstones: Record<string, unknown>;
      }) => {
        characters = partial.characters;
        tombstones = partial.characterTombstones;
      }
    ),
    read: () => characters,
  };
}

const fire = (
  characters: unknown[],
  characterTombstones: Record<string, unknown> = {}
) =>
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: PLAYER_STORAGE_KEY,
      newValue: JSON.stringify({
        state: { characters, characterTombstones },
        version: 0,
      }),
      storageArea: localStorage,
    })
  );

describe('cross-tab roster ordering', () => {
  it('does not resurrect a locally tombstoned character from a stale tab', () => {
    const deleted = entry('a', 3, 300);
    const store = makeStore([], {
      a: { id: 'a', deletedAt: 400, beforeImage: deleted },
    });
    const stop = initCrossTabRosterSync(
      store as unknown as Parameters<typeof initCrossTabRosterSync>[0]
    );

    fire([entry('a', 2, 200)]);

    expect(store.read()).toEqual([]);
    stop();
  });

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

  it('uses a newer tombstone resolution to roll back a fresher leaked replacement', () => {
    const leaked = entry('a', 5, 500);
    const previous = entry('a', 3, 300);
    const store = makeStore([leaked], {
      a: {
        id: 'a',
        deletedAt: 0,
        resolvedAt: 600,
        beforeImage: previous,
      },
    });
    const stop = initCrossTabRosterSync(
      store as unknown as Parameters<typeof initCrossTabRosterSync>[0]
    );

    fire([previous], {
      a: {
        id: 'a',
        deletedAt: 0,
        resolvedAt: 700,
        beforeImage: previous,
      },
    });

    expect(store.read()).toEqual([previous]);
    stop();
  });

  it('rejects a leaked replacement coupled to an older tombstone resolution', () => {
    const previous = entry('a', 3, 300);
    const leaked = entry('a', 5, 500);
    const store = makeStore([previous], {
      a: {
        id: 'a',
        deletedAt: 0,
        resolvedAt: 700,
        beforeImage: previous,
      },
    });
    const stop = initCrossTabRosterSync(
      store as unknown as Parameters<typeof initCrossTabRosterSync>[0]
    );

    fire([leaked], {
      a: {
        id: 'a',
        deletedAt: 0,
        resolvedAt: 600,
        beforeImage: previous,
      },
    });

    expect(store.read()).toEqual([previous]);
    stop();
  });

  it('allows an explicit newer resolution to restore a tombstoned character', () => {
    const restored = entry('a', 2, 200);
    const beforeImage = entry('a', 1, 100);
    const store = makeStore([], {
      a: { id: 'a', deletedAt: 600, beforeImage },
    });
    const stop = initCrossTabRosterSync(
      store as unknown as Parameters<typeof initCrossTabRosterSync>[0]
    );

    fire([restored], {
      a: {
        id: 'a',
        deletedAt: 600,
        resolvedAt: 700,
        beforeImage,
      },
    });

    expect(store.read()).toEqual([restored]);
    stop();
  });
});
