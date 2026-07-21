import type { useCharacterStore } from '@/store/characterStore';
import type { usePlayerStore } from '@/store/playerStore';

// Dev/test-only global exposed by `exposeStoreForE2E` (see src/lib/e2eStoreHandles.ts).
// Only ever present when NODE_ENV !== 'production'.
declare global {
  interface Window {
    __rkStores?: {
      character: typeof useCharacterStore;
      player: typeof usePlayerStore;
    };
  }
}

export {};
