import { STORAGE_KEY } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

interface CharacterStoreLike {
  getState: () => {
    character: CharacterState;
    loadCharacterState: (characterState: CharacterState) => void;
  };
}

/**
 * Cross-tab character convergence. Zustand persist already writes every
 * mutation to localStorage; other tabs receive a `storage` event. Apply the
 * incoming character iff it is the SAME character and a NEWER revision —
 * `loadCharacterState` runs under withExternalApply, so the adopted
 * revision is kept as-is (no bump, no echo loop).
 */
export function initCrossTabCharacterSync(
  store: CharacterStoreLike
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;

    let incoming: CharacterState | undefined;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      incoming = (parsed as { state?: { character?: CharacterState } } | null)
        ?.state?.character;
    } catch {
      return;
    }
    if (!incoming || typeof incoming.id !== 'string') return;

    const { character, loadCharacterState } = store.getState();
    if (incoming.id !== character.id) return;
    if ((incoming.revision ?? 0) <= (character.revision ?? 0)) return;

    loadCharacterState(incoming);
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
