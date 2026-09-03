import type { useCharacterStore } from '@/store/characterStore';
import type { usePlayerStore } from '@/store/playerStore';
import type { useEncounterStore } from '@/store/encounterStore';
import type { useLocationStore } from '@/store/locationStore';

// Dev/test-only global exposed by `exposeStoreForE2E` (see src/lib/e2eStoreHandles.ts).
// Only ever present when NODE_ENV !== 'production'.
declare global {
  interface Window {
    __rkStores?: {
      character: typeof useCharacterStore;
      player: typeof usePlayerStore;
      encounter: typeof useEncounterStore;
      location?: typeof useLocationStore;
      /** Fieldnotes Viewport exposed from DmLocationEditor / DmBattleMapCanvas
       *  for E2E marker tests. Available once the canvas `onReady` fires. */
      viewport?: {
        camera: { x: number; y: number; z: number };
        store: {
          getById(
            id: string
          ): {
            id: string;
            position: { x: number; y: number };
            size: { w: number; h: number };
            type: string;
            htmlType?: string;
          } | null;
        };
      };
    };
  }
}

export {};
