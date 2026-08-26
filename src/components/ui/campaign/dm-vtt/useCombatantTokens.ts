import { useEffect, useState } from 'react';

import { isCombatantToken } from './combatantToken';

import type { ElementStore } from '@fieldnotes/core';

/** entityId → element ids for every combatant token currently in the store. */
export function combatantTokenIndex(
  store: Pick<ElementStore, 'getAll'>
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const el of store.getAll()) {
    if (!isCombatantToken(el)) continue;
    const ids = index.get(el.entityId) ?? [];
    ids.push(el.id);
    index.set(el.entityId, ids);
  }
  return index;
}

/**
 * Live placed-state index. Recomputes on membership changes only
 * (add/remove/clear) — position updates during drags don't re-render.
 */
export function useCombatantTokens(
  store: ElementStore | null
): Map<string, string[]> {
  const [index, setIndex] = useState<Map<string, string[]>>(() =>
    store ? combatantTokenIndex(store) : new Map()
  );

  useEffect(() => {
    if (!store) {
      setIndex(new Map());
      return;
    }
    const recompute = () => setIndex(combatantTokenIndex(store));
    recompute();
    const unsubs = [
      store.on('add', recompute),
      store.on('remove', recompute),
      store.on('clear', recompute),
    ];
    return () => unsubs.forEach(u => u());
  }, [store]);

  return index;
}

/** The entity behind the first combatant token in a selection, if any. */
export function selectedEntityId(
  selectedIds: readonly string[],
  store: Pick<ElementStore, 'getById'>
): string | null {
  for (const id of selectedIds) {
    const el = store.getById(id);
    if (el && isCombatantToken(el)) return el.entityId;
  }
  return null;
}
