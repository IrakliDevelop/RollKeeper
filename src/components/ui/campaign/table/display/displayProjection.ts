import type {
  CanvasElement,
  ElementChangeMeta,
  ElementStore,
} from '@fieldnotes/core';

/**
 * PR07 M2: table-output-only physical minis. The display connection syncs
 * into a private source store; this projection mirrors it synchronously
 * into the viewport store, omitting elements tagged
 * `tableRepresentation: 'physical'`. Nothing is ever written back: the
 * source store is the only store the sync client observes, and mirror
 * writes carry a non-local origin (history ignores them).
 */

export const TABLE_REPRESENTATION_FIELD = 'tableRepresentation';
export const PHYSICAL_REPRESENTATION = 'physical';

const META: ElementChangeMeta = { origin: 'remote' };

export function isTablePhysical(element: CanvasElement): boolean {
  return (
    (element as unknown as Record<string, unknown>)[
      TABLE_REPRESENTATION_FIELD
    ] === PHYSICAL_REPRESENTATION
  );
}

/** Same shape as the sync client's replacement patch: dropped keys → undefined. */
function replacementPatch(
  existing: CanvasElement,
  next: CanvasElement
): Partial<CanvasElement> {
  const patch: Record<string, unknown> = { ...next };
  for (const key of Object.keys(existing))
    if (!(key in next)) patch[key] = undefined;
  return patch as Partial<CanvasElement>;
}

export function createDisplayProjection(
  source: ElementStore,
  target: ElementStore
): () => void {
  /** Source element reference last mirrored per id (echo/change detection). */
  const mirrored = new Map<string, CanvasElement>();

  const upsert = (element: CanvasElement) => {
    if (isTablePhysical(element)) {
      mirrored.delete(element.id);
      if (target.getById(element.id)) target.remove(element.id, META);
      return;
    }
    if (mirrored.get(element.id) === element && target.getById(element.id))
      return;
    mirrored.set(element.id, element);
    const existing = target.getById(element.id);
    if (!existing) target.add({ ...element }, META);
    else if (existing.type !== element.type) {
      target.remove(element.id, META);
      target.add({ ...element }, META);
    } else target.update(element.id, replacementPatch(existing, element), META);
  };

  /** One filtered snapshot (source `loadSnapshot`/`clear`). */
  const reload = () => {
    const visible = source
      .getAll()
      .filter(element => !isTablePhysical(element));
    mirrored.clear();
    for (const element of visible) mirrored.set(element.id, element);
    target.loadSnapshot(
      visible.map(element => ({ ...element })),
      META
    );
  };

  /** Coalesced source notifications: diff into one target batch. */
  const resync = () => {
    const visible = source
      .getAll()
      .filter(element => !isTablePhysical(element));
    const keep = new Set(visible.map(element => element.id));
    const controller = target.suspendNotifications();
    try {
      for (const element of [...target.getAll()])
        if (!keep.has(element.id)) {
          mirrored.delete(element.id);
          target.remove(element.id, META);
        }
      for (const element of visible) upsert(element);
    } finally {
      controller.resume();
    }
  };

  const unsubscribers = [
    source.on('add', upsert),
    source.on('update', ({ current }) => upsert(current)),
    source.on('remove', element => {
      mirrored.delete(element.id);
      if (target.getById(element.id)) target.remove(element.id, META);
    }),
    source.on('clear', reload),
    source.on('batch', resync),
  ];
  if (source.count > 0 || target.count > 0) reload();

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const unsubscribe of unsubscribers) unsubscribe();
    mirrored.clear();
  };
}
