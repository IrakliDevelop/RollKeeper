import { describe, it, expect } from 'vitest';

import {
  MARKER_REMOVAL_TRACKER_LIMIT,
  createMarkerRemovalTracker,
} from './markerRemovalTracker';

function record(id: string, ref = `ref-${id}`, wasDmOnly = false) {
  return { id, ref, wasDmOnly };
}

describe('createMarkerRemovalTracker', () => {
  it('hands back exactly what was recorded, and only once', () => {
    const tracker = createMarkerRemovalTracker();
    tracker.record(record('pin-1', 'ref-a', true));

    expect(tracker.take('pin-1')).toEqual({
      id: 'pin-1',
      ref: 'ref-a',
      wasDmOnly: true,
    });
    // Consumed: a SECOND add reusing that id is a new event, not the same
    // undo, and must fall through to the guard's fail-closed path.
    expect(tracker.take('pin-1')).toBeUndefined();
    expect(tracker.size()).toBe(0);
  });

  it('never grows past the cap, evicting the least recently removed first', () => {
    const tracker = createMarkerRemovalTracker();
    for (let index = 0; index < MARKER_REMOVAL_TRACKER_LIMIT + 10; index += 1) {
      tracker.record(record(`pin-${index}`));
    }

    expect(tracker.size()).toBe(MARKER_REMOVAL_TRACKER_LIMIT);
    // The ten oldest are gone — forgetting is safe, it only means the guard
    // treats that undo as a duplicate (fail closed).
    expect(tracker.take('pin-0')).toBeUndefined();
    expect(tracker.take('pin-9')).toBeUndefined();
    // ...and the newest are all still there.
    expect(tracker.take('pin-10')).toBeDefined();
    expect(
      tracker.take(`pin-${MARKER_REMOVAL_TRACKER_LIMIT + 9}`)
    ).toBeDefined();
  });

  it('re-recording an id makes it the NEWEST entry, not the oldest', () => {
    const tracker = createMarkerRemovalTracker(3);
    tracker.record(record('a'));
    tracker.record(record('b'));
    // `a` removed again (deleted, undone, deleted): it is now the freshest
    // thing the DM could still undo, so it must outlive `b`.
    tracker.record(record('a', 'ref-a2'));
    tracker.record(record('c'));
    tracker.record(record('d'));

    expect(tracker.take('b')).toBeUndefined();
    expect(tracker.take('a')?.ref).toBe('ref-a2');
    expect(tracker.take('c')).toBeDefined();
    expect(tracker.take('d')).toBeDefined();
  });
});
