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

describe('start-combat auto-share under Table v1 (D9)', () => {
  it('never pushes the linked map live when Table v1 is required', async () => {
    const { pushLinkedMapLiveOnStart } = await import('../EncounterView');
    const pushActive = vi.fn().mockResolvedValue(undefined);
    const maps = [
      makeMap({ id: 'map-a', name: 'Cave A', linkedEncounterIds: ['enc-1'] }),
    ];
    pushLinkedMapLiveOnStart(maps, 'enc-1', pushActive, true);
    expect(pushActive).not.toHaveBeenCalled();
  });

  it('keeps the legacy auto-share when Table v1 is not required', async () => {
    const { pushLinkedMapLiveOnStart } = await import('../EncounterView');
    const pushActive = vi.fn().mockResolvedValue(undefined);
    const maps = [
      makeMap({ id: 'map-a', name: 'Cave A', linkedEncounterIds: ['enc-1'] }),
    ];
    pushLinkedMapLiveOnStart(maps, 'enc-1', pushActive, false);
    expect(pushActive).toHaveBeenCalledWith('map-a', 'Cave A');
  });

  it('reads the public Table v1 flag by default', async () => {
    const { pushLinkedMapLiveOnStart } = await import('../EncounterView');
    const previous = process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    try {
      const pushActive = vi.fn().mockResolvedValue(undefined);
      pushLinkedMapLiveOnStart(
        [makeMap({ id: 'map-a', linkedEncounterIds: ['enc-1'] })],
        'enc-1',
        pushActive
      );
      expect(pushActive).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined)
        delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
      else process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = previous;
    }
  });
});
