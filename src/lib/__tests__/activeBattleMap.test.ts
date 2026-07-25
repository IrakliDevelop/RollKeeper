import { describe, it, expect } from 'vitest';
import { shouldClearActiveBattleMap } from '@/lib/activeBattleMap';
import type { SharedBattleMapState } from '@/types/sharedState';

describe('shouldClearActiveBattleMap', () => {
  it('is true when the shared active id matches the deleted map (object form)', () => {
    const shared: SharedBattleMapState = {
      activeBattleMapId: 'map-1',
      updatedAt: 'now',
    };
    expect(shouldClearActiveBattleMap(shared, 'map-1')).toBe(true);
  });

  it('is true when the shared value is the raw JSON string form', () => {
    const raw = JSON.stringify({
      activeBattleMapId: 'map-1',
      updatedAt: 'now',
    });
    expect(shouldClearActiveBattleMap(raw, 'map-1')).toBe(true);
  });

  it('is false when the active id points at a different map', () => {
    const shared: SharedBattleMapState = {
      activeBattleMapId: 'map-2',
      updatedAt: 'now',
    };
    expect(shouldClearActiveBattleMap(shared, 'map-1')).toBe(false);
  });

  it('is false when nothing is shared (null/undefined) or no active id', () => {
    expect(shouldClearActiveBattleMap(null, 'map-1')).toBe(false);
    expect(shouldClearActiveBattleMap(undefined, 'map-1')).toBe(false);
    expect(
      shouldClearActiveBattleMap(
        { activeBattleMapId: null, updatedAt: 'now' },
        'map-1'
      )
    ).toBe(false);
  });

  it('is false on unparseable raw JSON (never throws)', () => {
    expect(shouldClearActiveBattleMap('{ not json', 'map-1')).toBe(false);
  });
});
