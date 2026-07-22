import { describe, it, expect, vi } from 'vitest';

import { pushLinkedMapLive } from '../EncounterView';

import type { BattleMap } from '@/types/battlemap';

function makeMap(overrides: Partial<BattleMap>): BattleMap {
  return {
    id: 'map-1',
    name: 'Cave',
    linkedEncounterIds: [],
    ...overrides,
  } as BattleMap;
}

describe('pushLinkedMapLive', () => {
  it('pushes the linked map live (id + name) on start combat', () => {
    const pushActive = vi.fn().mockResolvedValue(undefined);
    const maps = [
      makeMap({ id: 'map-a', name: 'Cave A', linkedEncounterIds: ['enc-1'] }),
      makeMap({ id: 'map-b', name: 'Cave B' }),
    ];

    pushLinkedMapLive(maps, 'enc-1', pushActive);

    expect(pushActive).toHaveBeenCalledTimes(1);
    expect(pushActive).toHaveBeenCalledWith('map-a', 'Cave A');
  });

  it('does nothing when no map links the encounter — never clears a manual share', () => {
    const pushActive = vi.fn().mockResolvedValue(undefined);

    pushLinkedMapLive([makeMap({})], 'enc-1', pushActive);

    expect(pushActive).not.toHaveBeenCalled();
  });
});
