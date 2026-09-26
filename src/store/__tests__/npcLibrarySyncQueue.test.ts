import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NPC_LIBRARY_SYNC_DELAY_MS,
  flushNpcLibrarySync,
  queueNpcLibrarySync,
  resetNpcLibrarySync,
} from '@/store/npcLibrarySyncQueue';
import { createMockEncounterEntity } from '@/test/helpers';
import type { EncounterEntity } from '@/types/encounter';

function entity(id: string, armorClass: number): EncounterEntity {
  return createMockEncounterEntity({ id, armorClass });
}

describe('npcLibrarySyncQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetNpcLibrarySync();
    vi.useRealTimers();
  });

  it('coalesces quick edits into one apply(first before, latest after)', () => {
    const apply = vi.fn();
    queueNpcLibrarySync('enc', entity('a', 13), entity('a', 1), apply);
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS - 1);
    queueNpcLibrarySync('enc', entity('a', 1), entity('a', 18), apply);
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS - 1);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
    const [before, after] = apply.mock.calls[0];
    expect(before.armorClass).toBe(13);
    expect(after.armorClass).toBe(18);
  });

  it('edits after the delay make separate calls', () => {
    const apply = vi.fn();
    queueNpcLibrarySync('enc', entity('a', 13), entity('a', 15), apply);
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS);
    queueNpcLibrarySync('enc', entity('a', 15), entity('a', 18), apply);
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][0].armorClass).toBe(15);
    expect(apply.mock.calls[1][1].armorClass).toBe(18);
  });

  it('keeps different entities (and encounters) independent', () => {
    const apply = vi.fn();
    queueNpcLibrarySync('enc', entity('a', 13), entity('a', 14), apply);
    queueNpcLibrarySync('enc', entity('b', 10), entity('b', 11), apply);
    queueNpcLibrarySync('enc2', entity('a', 20), entity('a', 21), apply);
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS);
    expect(apply).toHaveBeenCalledTimes(3);
    const pairs = apply.mock.calls.map(([b, a]) => [
      b.armorClass,
      a.armorClass,
    ]);
    expect(pairs).toEqual(
      expect.arrayContaining([
        [13, 14],
        [10, 11],
        [20, 21],
      ])
    );
  });

  it('flush runs pending writes immediately, once', () => {
    const apply = vi.fn();
    queueNpcLibrarySync('enc', entity('a', 13), entity('a', 18), apply);
    flushNpcLibrarySync();
    expect(apply).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS * 2);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('reset drops pending writes without applying', () => {
    const apply = vi.fn();
    queueNpcLibrarySync('enc', entity('a', 13), entity('a', 18), apply);
    resetNpcLibrarySync();
    vi.advanceTimersByTime(NPC_LIBRARY_SYNC_DELAY_MS * 2);
    flushNpcLibrarySync();
    expect(apply).not.toHaveBeenCalled();
  });

  it('flushes pending writes on pagehide', () => {
    const apply = vi.fn();
    queueNpcLibrarySync('enc', entity('a', 13), entity('a', 18), apply);
    window.dispatchEvent(new Event('pagehide'));
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
