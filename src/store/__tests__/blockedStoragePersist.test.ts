import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every persisted store, imported after storage is blocked. Zustand's persist
// middleware drops the whole `store.persist` API when its storage factory
// throws, which breaks `useHydration` and the persistence bootstrap.
const STORE_MODULES = [
  ['battleMapStore', 'useBattleMapStore'],
  ['calendarStore', 'useCalendarStore'],
  ['characterStore', 'useCharacterStore'],
  ['combatLogStore', 'useCombatLogStore'],
  ['dmStore', 'useDmStore'],
  ['encounterStore', 'useEncounterStore'],
  ['locationStore', 'useLocationStore'],
  ['magicItemLibraryStore', 'useMagicItemLibraryStore'],
  ['npcStore', 'useNPCStore'],
  ['playerStore', 'usePlayerStore'],
] as const;

const originals = {
  localStorage: Object.getOwnPropertyDescriptor(window, 'localStorage')!,
  sessionStorage: Object.getOwnPropertyDescriptor(window, 'sessionStorage')!,
};

function blockStorage(name: 'localStorage' | 'sessionStorage') {
  Object.defineProperty(window, name, {
    configurable: true,
    enumerable: true,
    get() {
      throw new DOMException('sandboxed', 'SecurityError');
    },
  });
}

describe.each([
  ['default flags', {}],
  [
    'character cutover enabled',
    { NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED: 'true' },
  ],
  [
    'IndexedDB migration enabled',
    { NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED: 'true' },
  ],
])('persisted stores with blocked browser storage (%s)', (_label, env) => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    blockStorage('localStorage');
    blockStorage('sessionStorage');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'localStorage', originals.localStorage);
    Object.defineProperty(window, 'sessionStorage', originals.sessionStorage);
    document.documentElement.removeAttribute('data-storage-blocked');
  });

  it.each(STORE_MODULES)(
    '%s keeps its persist API and rehydrates',
    async (file, hook) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storeModule = (await import(`@/store/${file}.ts`)) as Record<
        string,
        { persist?: { rehydrate: () => Promise<void> | void } }
      >;
      const store = storeModule[hook]!;

      expect(store.persist).toBeDefined();
      await store.persist!.rehydrate();
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('storage is currently unavailable')
      );
      warn.mockRestore();
    }
  );
});
