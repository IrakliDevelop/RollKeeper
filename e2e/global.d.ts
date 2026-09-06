import type { useCharacterStore } from '@/store/characterStore';
import type { usePlayerStore } from '@/store/playerStore';
import type { useEncounterStore } from '@/store/encounterStore';
import type { useLocationStore } from '@/store/locationStore';

/** Minimal shape of a Fieldnotes canvas element as seen by e2e specs —
 *  `data` is untyped here on purpose: specs narrow it themselves per marker
 *  kind (see markerData.ts's `MarkerData` for the real shape). */
interface RkE2ECanvasElement {
  id: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  type: string;
  htmlType?: string;
  data?: unknown;
}

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
          getById(id: string): RkE2ECanvasElement | null;
          getAll(): RkE2ECanvasElement[];
        };
      };
    };
  }
}

export {};
