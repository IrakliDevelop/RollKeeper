import type { FogManager, FogStateV1 } from '@fieldnotes/core';

export function attachFogPersistence(
  fogManager: FogManager,
  onSave: (state: FogStateV1 | null) => void
): () => void {
  let disposed = false;

  const unsub = fogManager.on('change', event => {
    if (disposed) return;
    // The SDK reserves an undefined/local origin for authoring on this
    // viewport. Any other origin is externally applied sync state and is
    // already durable at the hub; writing it back to local storage creates
    // noisy save loops and can race a newer authoritative snapshot.
    if (event.origin !== undefined && event.origin !== 'local') return;
    onSave(fogManager.getState());
  });

  return () => {
    if (disposed) return;
    disposed = true;
    unsub();
  };
}
