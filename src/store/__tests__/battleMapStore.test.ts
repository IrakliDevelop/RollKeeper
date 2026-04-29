import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

const CAMPAIGN = 'test-campaign';
const OTHER_CAMPAIGN = 'other-campaign';

const mockBattleMap: BattleMap = {
  id: 'bm-test-001',
  campaignCode: CAMPAIGN,
  name: 'Throne Room',
  mapImageUrl: 'https://example.com/map.png',
  mapImageSize: { w: 1024, h: 768 },
  canvasState: '{}',
  dmOnlyElements: {},
  gridEnabled: true,
  linkedEncounterIds: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockBattleMap2: BattleMap = {
  id: 'bm-test-002',
  campaignCode: CAMPAIGN,
  name: 'Dungeon Corridor',
  mapImageUrl: 'https://example.com/corridor.png',
  mapImageSize: { w: 800, h: 600 },
  canvasState: '{"shapes":[]}',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  createdAt: '2024-01-02T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

function resetStore() {
  useBattleMapStore.setState({ battleMaps: {} });
}

describe('battleMapStore', () => {
  beforeEach(resetStore);

  describe('addBattleMap', () => {
    it('adds a battle map to a campaign', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(1);
      expect(maps[0].name).toBe('Throne Room');
    });

    it('adds multiple battle maps to the same campaign', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap2);
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(2);
    });

    it('isolates maps per campaign', () => {
      const otherMap: BattleMap = {
        ...mockBattleMap,
        id: 'bm-other',
        campaignCode: OTHER_CAMPAIGN,
      };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().addBattleMap(OTHER_CAMPAIGN, otherMap);
      expect(useBattleMapStore.getState().getBattleMaps(CAMPAIGN)).toHaveLength(
        1
      );
      expect(
        useBattleMapStore.getState().getBattleMaps(OTHER_CAMPAIGN)
      ).toHaveLength(1);
    });

    it('overwrites existing map with same id', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      const updated: BattleMap = { ...mockBattleMap, name: 'Updated Name' };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, updated);
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(1);
      expect(maps[0].name).toBe('Updated Name');
    });
  });

  describe('getBattleMap', () => {
    it('returns the battle map by id', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map).toBeDefined();
      expect(map!.name).toBe('Throne Room');
    });

    it('returns undefined for nonexistent id', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-nonexistent');
      expect(map).toBeUndefined();
    });

    it('returns undefined for nonexistent campaign', () => {
      const map = useBattleMapStore
        .getState()
        .getBattleMap('nonexistent', 'bm-test-001');
      expect(map).toBeUndefined();
    });
  });

  describe('getBattleMaps', () => {
    it('returns empty array for unknown campaign', () => {
      const maps = useBattleMapStore
        .getState()
        .getBattleMaps('unknown-campaign');
      expect(maps).toEqual([]);
    });

    it('returns all maps for a campaign', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap2);
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(2);
      const ids = maps.map(m => m.id);
      expect(ids).toContain('bm-test-001');
      expect(ids).toContain('bm-test-002');
    });
  });

  describe('updateBattleMap', () => {
    it('updates a battle map field', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .updateBattleMap(CAMPAIGN, 'bm-test-001', { name: 'Grand Hall' });
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.name).toBe('Grand Hall');
    });

    it('merges partial updates without overwriting unrelated fields', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .updateBattleMap(CAMPAIGN, 'bm-test-001', { gridEnabled: false });
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.gridEnabled).toBe(false);
      expect(map!.name).toBe('Throne Room');
      expect(map!.mapImageUrl).toBe('https://example.com/map.png');
    });

    it('does nothing for nonexistent map id', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .updateBattleMap(CAMPAIGN, 'nonexistent', { name: 'Ghost' });
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps[0].name).toBe('Throne Room');
    });

    it('does nothing for nonexistent campaign', () => {
      useBattleMapStore
        .getState()
        .updateBattleMap('nonexistent', 'bm-test-001', { name: 'Ghost' });
      const maps = useBattleMapStore.getState().getBattleMaps('nonexistent');
      expect(maps).toEqual([]);
    });
  });

  describe('removeBattleMap', () => {
    it('removes a battle map from the campaign', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().removeBattleMap(CAMPAIGN, 'bm-test-001');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(0);
    });

    it('only removes the specified map', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap2);
      useBattleMapStore.getState().removeBattleMap(CAMPAIGN, 'bm-test-001');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(1);
      expect(maps[0].id).toBe('bm-test-002');
    });

    it('does nothing for nonexistent campaign', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .removeBattleMap('nonexistent', 'bm-test-001');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(1);
    });

    it('does nothing for nonexistent map id', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().removeBattleMap(CAMPAIGN, 'nonexistent');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(1);
    });
  });

  describe('setDmOnly', () => {
    it('marks an element as DM-only', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .setDmOnly(CAMPAIGN, 'bm-test-001', 'elem-1', true);
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.dmOnlyElements['elem-1']).toBe(true);
    });

    it('removes DM-only flag when set to false', () => {
      const mapWithDmOnly: BattleMap = {
        ...mockBattleMap,
        dmOnlyElements: { 'elem-1': true },
      };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mapWithDmOnly);
      useBattleMapStore
        .getState()
        .setDmOnly(CAMPAIGN, 'bm-test-001', 'elem-1', false);
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.dmOnlyElements['elem-1']).toBeUndefined();
    });

    it('does nothing for nonexistent map', () => {
      useBattleMapStore
        .getState()
        .setDmOnly(CAMPAIGN, 'nonexistent', 'elem-1', true);
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(0);
    });

    it('does nothing for nonexistent campaign', () => {
      useBattleMapStore
        .getState()
        .setDmOnly('nonexistent', 'bm-test-001', 'elem-1', true);
      // no crash and state unchanged
      expect(
        useBattleMapStore.getState().battleMaps['nonexistent']
      ).toBeUndefined();
    });
  });

  describe('toggleDmOnly', () => {
    it('sets element as DM-only when currently false', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'bm-test-001', 'elem-2');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.dmOnlyElements['elem-2']).toBe(true);
    });

    it('removes DM-only flag when currently true', () => {
      const mapWithDmOnly: BattleMap = {
        ...mockBattleMap,
        dmOnlyElements: { 'elem-2': true },
      };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mapWithDmOnly);
      useBattleMapStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'bm-test-001', 'elem-2');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.dmOnlyElements['elem-2']).toBeUndefined();
    });

    it('does nothing for nonexistent map', () => {
      useBattleMapStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'nonexistent', 'elem-1');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(0);
    });
  });

  describe('linkEncounter', () => {
    it('links an encounter to a battle map', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .linkEncounter(CAMPAIGN, 'bm-test-001', 'enc-abc');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.linkedEncounterIds).toContain('enc-abc');
    });

    it('links multiple encounters to the same map', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .linkEncounter(CAMPAIGN, 'bm-test-001', 'enc-abc');
      useBattleMapStore
        .getState()
        .linkEncounter(CAMPAIGN, 'bm-test-001', 'enc-def');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.linkedEncounterIds).toHaveLength(2);
      expect(map!.linkedEncounterIds).toContain('enc-abc');
      expect(map!.linkedEncounterIds).toContain('enc-def');
    });

    it('does not duplicate an already-linked encounter', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .linkEncounter(CAMPAIGN, 'bm-test-001', 'enc-abc');
      useBattleMapStore
        .getState()
        .linkEncounter(CAMPAIGN, 'bm-test-001', 'enc-abc');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.linkedEncounterIds).toHaveLength(1);
    });

    it('does nothing for nonexistent map', () => {
      useBattleMapStore
        .getState()
        .linkEncounter(CAMPAIGN, 'nonexistent', 'enc-abc');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(0);
    });

    it('does nothing for nonexistent campaign', () => {
      useBattleMapStore
        .getState()
        .linkEncounter('nonexistent', 'bm-test-001', 'enc-abc');
      expect(
        useBattleMapStore.getState().battleMaps['nonexistent']
      ).toBeUndefined();
    });
  });

  describe('unlinkEncounter', () => {
    it('removes a linked encounter from a battle map', () => {
      const mapWithEncounter: BattleMap = {
        ...mockBattleMap,
        linkedEncounterIds: ['enc-abc', 'enc-def'],
      };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mapWithEncounter);
      useBattleMapStore
        .getState()
        .unlinkEncounter(CAMPAIGN, 'bm-test-001', 'enc-abc');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.linkedEncounterIds).not.toContain('enc-abc');
      expect(map!.linkedEncounterIds).toContain('enc-def');
    });

    it('results in empty array when last encounter is unlinked', () => {
      const mapWithEncounter: BattleMap = {
        ...mockBattleMap,
        linkedEncounterIds: ['enc-abc'],
      };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mapWithEncounter);
      useBattleMapStore
        .getState()
        .unlinkEncounter(CAMPAIGN, 'bm-test-001', 'enc-abc');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.linkedEncounterIds).toHaveLength(0);
    });

    it('does nothing if encounter not linked', () => {
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore
        .getState()
        .unlinkEncounter(CAMPAIGN, 'bm-test-001', 'enc-nonexistent');
      const map = useBattleMapStore
        .getState()
        .getBattleMap(CAMPAIGN, 'bm-test-001');
      expect(map!.linkedEncounterIds).toHaveLength(0);
    });

    it('does nothing for nonexistent map', () => {
      useBattleMapStore
        .getState()
        .unlinkEncounter(CAMPAIGN, 'nonexistent', 'enc-abc');
      const maps = useBattleMapStore.getState().getBattleMaps(CAMPAIGN);
      expect(maps).toHaveLength(0);
    });

    it('does nothing for nonexistent campaign', () => {
      useBattleMapStore
        .getState()
        .unlinkEncounter('nonexistent', 'bm-test-001', 'enc-abc');
      expect(
        useBattleMapStore.getState().battleMaps['nonexistent']
      ).toBeUndefined();
    });
  });

  describe('campaign isolation', () => {
    it('operations on one campaign do not affect another', () => {
      const otherMap: BattleMap = {
        ...mockBattleMap,
        id: 'bm-other',
        campaignCode: OTHER_CAMPAIGN,
      };
      useBattleMapStore.getState().addBattleMap(CAMPAIGN, mockBattleMap);
      useBattleMapStore.getState().addBattleMap(OTHER_CAMPAIGN, otherMap);
      useBattleMapStore.getState().removeBattleMap(CAMPAIGN, 'bm-test-001');
      expect(useBattleMapStore.getState().getBattleMaps(CAMPAIGN)).toHaveLength(
        0
      );
      expect(
        useBattleMapStore.getState().getBattleMaps(OTHER_CAMPAIGN)
      ).toHaveLength(1);
    });
  });
});
