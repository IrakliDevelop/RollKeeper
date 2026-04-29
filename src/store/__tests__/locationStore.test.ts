import { describe, it, expect, beforeEach } from 'vitest';
import { useLocationStore } from '@/store/locationStore';
import type { LocationMap } from '@/types/location';

const CAMPAIGN = 'test-campaign';
const OTHER_CAMPAIGN = 'other-campaign';

const mockLocation: LocationMap = {
  id: 'loc-test-001',
  campaignCode: CAMPAIGN,
  name: 'City of Waterdeep',
  mapImageUrl: 'https://example.com/waterdeep.png',
  mapImageSize: { w: 2048, h: 1536 },
  canvasState: '{}',
  dmOnlyElements: {},
  gridEnabled: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockLocation2: LocationMap = {
  id: 'loc-test-002',
  campaignCode: CAMPAIGN,
  name: 'Underdark',
  mapImageUrl: 'https://example.com/underdark.png',
  mapImageSize: { w: 1600, h: 1200 },
  canvasState: '{"pins":[]}',
  dmOnlyElements: {},
  gridEnabled: true,
  gridSettings: {
    gridType: 'hex',
    hexOrientation: 'pointy',
    cellSize: 50,
    strokeColor: '#ffffff',
    strokeWidth: 1,
    opacity: 0.5,
  },
  createdAt: '2024-01-02T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

function resetStore() {
  useLocationStore.setState({ locations: {} });
}

describe('locationStore', () => {
  beforeEach(resetStore);

  describe('addLocation', () => {
    it('adds a location to a campaign', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(1);
      expect(locs[0].name).toBe('City of Waterdeep');
    });

    it('adds multiple locations to the same campaign', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation2);
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(2);
    });

    it('isolates locations per campaign', () => {
      const otherLoc: LocationMap = {
        ...mockLocation,
        id: 'loc-other',
        campaignCode: OTHER_CAMPAIGN,
      };
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().addLocation(OTHER_CAMPAIGN, otherLoc);
      expect(useLocationStore.getState().getLocations(CAMPAIGN)).toHaveLength(
        1
      );
      expect(
        useLocationStore.getState().getLocations(OTHER_CAMPAIGN)
      ).toHaveLength(1);
    });

    it('overwrites existing location with same id', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      const updated: LocationMap = { ...mockLocation, name: 'Updated Name' };
      useLocationStore.getState().addLocation(CAMPAIGN, updated);
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(1);
      expect(locs[0].name).toBe('Updated Name');
    });

    it('preserves gridSettings when present', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation2);
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-002');
      expect(loc!.gridSettings).toBeDefined();
      expect(loc!.gridSettings!.gridType).toBe('hex');
    });
  });

  describe('getLocation', () => {
    it('returns the location by id', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc).toBeDefined();
      expect(loc!.name).toBe('City of Waterdeep');
    });

    it('returns undefined for nonexistent id', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-nonexistent');
      expect(loc).toBeUndefined();
    });

    it('returns undefined for nonexistent campaign', () => {
      const loc = useLocationStore
        .getState()
        .getLocation('nonexistent', 'loc-test-001');
      expect(loc).toBeUndefined();
    });
  });

  describe('getLocations', () => {
    it('returns empty array for unknown campaign', () => {
      const locs = useLocationStore.getState().getLocations('unknown-campaign');
      expect(locs).toEqual([]);
    });

    it('returns all locations for a campaign', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation2);
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(2);
      const ids = locs.map(l => l.id);
      expect(ids).toContain('loc-test-001');
      expect(ids).toContain('loc-test-002');
    });
  });

  describe('updateLocation', () => {
    it('updates a location field', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .updateLocation(CAMPAIGN, 'loc-test-001', { name: "Baldur's Gate" });
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.name).toBe("Baldur's Gate");
    });

    it('merges partial updates without overwriting unrelated fields', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .updateLocation(CAMPAIGN, 'loc-test-001', { gridEnabled: true });
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.gridEnabled).toBe(true);
      expect(loc!.name).toBe('City of Waterdeep');
      expect(loc!.mapImageUrl).toBe('https://example.com/waterdeep.png');
    });

    it('can update multiple fields at once', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().updateLocation(CAMPAIGN, 'loc-test-001', {
        name: 'New Name',
        updatedAt: '2024-06-01T00:00:00Z',
      });
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.name).toBe('New Name');
      expect(loc!.updatedAt).toBe('2024-06-01T00:00:00Z');
    });

    it('does nothing for nonexistent location id', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .updateLocation(CAMPAIGN, 'nonexistent', { name: 'Ghost' });
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs[0].name).toBe('City of Waterdeep');
    });

    it('does nothing for nonexistent campaign', () => {
      useLocationStore
        .getState()
        .updateLocation('nonexistent', 'loc-test-001', { name: 'Ghost' });
      const locs = useLocationStore.getState().getLocations('nonexistent');
      expect(locs).toEqual([]);
    });
  });

  describe('removeLocation', () => {
    it('removes a location from the campaign', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().removeLocation(CAMPAIGN, 'loc-test-001');
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(0);
    });

    it('only removes the specified location', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation2);
      useLocationStore.getState().removeLocation(CAMPAIGN, 'loc-test-001');
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(1);
      expect(locs[0].id).toBe('loc-test-002');
    });

    it('does nothing for nonexistent campaign', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().removeLocation('nonexistent', 'loc-test-001');
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(1);
    });

    it('does nothing for nonexistent location id', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().removeLocation(CAMPAIGN, 'nonexistent');
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(1);
    });
  });

  describe('setDmOnly', () => {
    it('marks an element as DM-only', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .setDmOnly(CAMPAIGN, 'loc-test-001', 'pin-1', true);
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.dmOnlyElements['pin-1']).toBe(true);
    });

    it('removes DM-only flag when set to false', () => {
      const locWithDmOnly: LocationMap = {
        ...mockLocation,
        dmOnlyElements: { 'pin-1': true },
      };
      useLocationStore.getState().addLocation(CAMPAIGN, locWithDmOnly);
      useLocationStore
        .getState()
        .setDmOnly(CAMPAIGN, 'loc-test-001', 'pin-1', false);
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.dmOnlyElements['pin-1']).toBeUndefined();
    });

    it('can mark multiple elements as DM-only', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .setDmOnly(CAMPAIGN, 'loc-test-001', 'pin-1', true);
      useLocationStore
        .getState()
        .setDmOnly(CAMPAIGN, 'loc-test-001', 'pin-2', true);
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.dmOnlyElements['pin-1']).toBe(true);
      expect(loc!.dmOnlyElements['pin-2']).toBe(true);
    });

    it('does nothing for nonexistent location', () => {
      useLocationStore
        .getState()
        .setDmOnly(CAMPAIGN, 'nonexistent', 'pin-1', true);
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(0);
    });

    it('does nothing for nonexistent campaign', () => {
      useLocationStore
        .getState()
        .setDmOnly('nonexistent', 'loc-test-001', 'pin-1', true);
      expect(
        useLocationStore.getState().locations['nonexistent']
      ).toBeUndefined();
    });
  });

  describe('toggleDmOnly', () => {
    it('sets element as DM-only when currently absent', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'loc-test-001', 'pin-2');
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.dmOnlyElements['pin-2']).toBe(true);
    });

    it('removes DM-only flag when currently true', () => {
      const locWithDmOnly: LocationMap = {
        ...mockLocation,
        dmOnlyElements: { 'pin-2': true },
      };
      useLocationStore.getState().addLocation(CAMPAIGN, locWithDmOnly);
      useLocationStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'loc-test-001', 'pin-2');
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.dmOnlyElements['pin-2']).toBeUndefined();
    });

    it('calling toggle twice restores original state', () => {
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'loc-test-001', 'pin-3');
      useLocationStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'loc-test-001', 'pin-3');
      const loc = useLocationStore
        .getState()
        .getLocation(CAMPAIGN, 'loc-test-001');
      expect(loc!.dmOnlyElements['pin-3']).toBeUndefined();
    });

    it('does nothing for nonexistent location', () => {
      useLocationStore
        .getState()
        .toggleDmOnly(CAMPAIGN, 'nonexistent', 'pin-1');
      const locs = useLocationStore.getState().getLocations(CAMPAIGN);
      expect(locs).toHaveLength(0);
    });

    it('does nothing for nonexistent campaign', () => {
      useLocationStore
        .getState()
        .toggleDmOnly('nonexistent', 'loc-test-001', 'pin-1');
      expect(
        useLocationStore.getState().locations['nonexistent']
      ).toBeUndefined();
    });
  });

  describe('campaign isolation', () => {
    it('operations on one campaign do not affect another', () => {
      const otherLoc: LocationMap = {
        ...mockLocation,
        id: 'loc-other',
        campaignCode: OTHER_CAMPAIGN,
      };
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().addLocation(OTHER_CAMPAIGN, otherLoc);
      useLocationStore.getState().removeLocation(CAMPAIGN, 'loc-test-001');
      expect(useLocationStore.getState().getLocations(CAMPAIGN)).toHaveLength(
        0
      );
      expect(
        useLocationStore.getState().getLocations(OTHER_CAMPAIGN)
      ).toHaveLength(1);
    });

    it('updating one campaign leaves others unchanged', () => {
      const otherLoc: LocationMap = {
        ...mockLocation,
        id: 'loc-other',
        campaignCode: OTHER_CAMPAIGN,
      };
      useLocationStore.getState().addLocation(CAMPAIGN, mockLocation);
      useLocationStore.getState().addLocation(OTHER_CAMPAIGN, otherLoc);
      useLocationStore
        .getState()
        .updateLocation(CAMPAIGN, 'loc-test-001', { name: 'Changed' });
      const otherLocFetched = useLocationStore
        .getState()
        .getLocation(OTHER_CAMPAIGN, 'loc-other');
      expect(otherLocFetched!.name).toBe('City of Waterdeep');
    });
  });
});
