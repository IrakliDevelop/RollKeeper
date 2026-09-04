import type { FogManager, FogStateV1 } from '@fieldnotes/core';

const REMOTE_ORIGIN = 'remote';

export function attachFogPersistence(
  fogManager: FogManager,
  onSave: (state: FogStateV1 | null) => void
): () => void {
  let disposed = false;

  const unsub = fogManager.on('change', event => {
    if (disposed) return;
    if (event.origin === REMOTE_ORIGIN) return;
    onSave(fogManager.getState());
  });

  return () => {
    if (disposed) return;
    disposed = true;
    unsub();
  };
}
