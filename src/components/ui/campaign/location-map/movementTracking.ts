import {
  MovementTracker,
  movementRecordId,
  movementRecordTypeDefinition,
  MOVEMENT_TRAIL_MAX_POINTS,
} from '@fieldnotes/vtt';
import type { MovementTrackOptions, PathEmission } from '@fieldnotes/vtt';
import type { Viewport } from '@fieldnotes/core';

const trackers = new WeakMap<Viewport, MovementTracker>();
const settings = new WeakMap<Viewport, Map<string, MovementTrackOptions>>();

export function getMovementTracker(viewport: Viewport): MovementTracker {
  let tracker = trackers.get(viewport);
  if (!tracker) {
    tracker = new MovementTracker(viewport);
    trackers.set(viewport, tracker);
    settings.set(viewport, new Map());
  }
  return tracker;
}

export function configureMovement(
  viewport: Viewport,
  next: Map<string, MovementTrackOptions>
): void {
  const tracker = getMovementTracker(viewport);
  const previous = settings.get(viewport);
  for (const id of previous?.keys() ?? []) {
    if (!next.has(id)) tracker.untrack(id);
  }
  for (const [id, options] of next) {
    tracker.track(id, options);
    tracker.setVisibility(id, options.visibility);
  }
  settings.set(viewport, next);
}

export function movementSpent(viewport: Viewport, id: string): number {
  return trackers.get(viewport)?.getMovement(id)?.feet ?? 0;
}

/** Path commits and select drags share the same per-turn record and undo transaction. */
export function recordMovementPath(
  viewport: Viewport,
  id: string,
  path: PathEmission
): void {
  const options = settings.get(viewport)?.get(id);
  const target = viewport.store.getById(id);
  if (!options || !target) return;
  const stored = viewport.store.getById(movementRecordId(id));
  const old =
    stored?.type === 'extension' && stored.extensionType === 'vtt:movement'
      ? movementRecordTypeDefinition.unwrap(stored)
      : null;
  const current = old?.epoch === options.epoch ? old : null;
  const trail = [
    ...(current?.trail.map(run => [...run]) ?? []),
    [...path.waypoints],
  ];
  let excess =
    trail.reduce((count, run) => count + run.length, 0) -
    MOVEMENT_TRAIL_MAX_POINTS;
  while (excess > 0 && trail.length) {
    const run = trail[0];
    if (!run) break;
    const drop = Math.min(excess, run.length);
    run.splice(0, drop);
    excess -= drop;
    if (!run.length) trail.shift();
  }
  const envelope = movementRecordTypeDefinition.wrap({
    id: movementRecordId(id),
    type: 'movement',
    position: { x: 0, y: 0 },
    index: '',
    version: 0,
    locked: true,
    layerId: target.layerId,
    targetId: id,
    epoch: options.epoch,
    visibility: options.visibility,
    feet: (current?.feet ?? 0) + path.totalFeet,
    diagonals: current?.diagonals ?? 0,
    trail,
  });
  if (stored) viewport.store.update(stored.id, envelope);
  else viewport.store.add(envelope);
}
