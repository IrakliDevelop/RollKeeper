import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LocationMap } from '@/types/location';

const LOCATION_STORAGE_KEY = 'rollkeeper-location-data';

function generateLocationId(): string {
  return (
    'loc-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

// campaignCode → locationId → LocationMap
type LocationData = Record<string, Record<string, LocationMap>>;

interface LocationStoreState {
  locations: LocationData;
  addLocation: (campaignCode: string, location: LocationMap) => void;
  updateLocation: (
    campaignCode: string,
    locationId: string,
    updates: Partial<LocationMap>
  ) => void;
  removeLocation: (campaignCode: string, locationId: string) => void;
  getLocation: (
    campaignCode: string,
    locationId: string
  ) => LocationMap | undefined;
  getLocations: (campaignCode: string) => LocationMap[];
  setDmOnly: (
    campaignCode: string,
    locationId: string,
    elementId: string,
    dmOnly: boolean
  ) => void;
  toggleDmOnly: (
    campaignCode: string,
    locationId: string,
    elementId: string
  ) => void;
}

export const useLocationStore = create<LocationStoreState>()(
  persist(
    (set, get) => ({
      locations: {},

      addLocation: (campaignCode, location) => {
        set(state => ({
          locations: {
            ...state.locations,
            [campaignCode]: {
              ...(state.locations[campaignCode] ?? {}),
              [location.id]: location,
            },
          },
        }));
      },

      updateLocation: (campaignCode, locationId, updates) => {
        set(state => {
          const campaignLocations = state.locations[campaignCode];
          if (!campaignLocations || !campaignLocations[locationId]) {
            return state;
          }
          return {
            locations: {
              ...state.locations,
              [campaignCode]: {
                ...campaignLocations,
                [locationId]: {
                  ...campaignLocations[locationId],
                  ...updates,
                },
              },
            },
          };
        });
      },

      removeLocation: (campaignCode, locationId) => {
        set(state => {
          const campaignLocations = state.locations[campaignCode];
          if (!campaignLocations) return state;
          const updated = { ...campaignLocations };
          delete updated[locationId];
          return {
            locations: {
              ...state.locations,
              [campaignCode]: updated,
            },
          };
        });
      },

      getLocation: (campaignCode, locationId) => {
        return get().locations[campaignCode]?.[locationId];
      },

      getLocations: campaignCode => {
        const campaignLocations = get().locations[campaignCode];
        if (!campaignLocations) return [];
        return Object.values(campaignLocations);
      },

      setDmOnly: (campaignCode, locationId, elementId, dmOnly) => {
        set(state => {
          const campaignLocations = state.locations[campaignCode];
          if (!campaignLocations || !campaignLocations[locationId]) {
            return state;
          }
          const location = campaignLocations[locationId];
          const updatedDmOnlyElements = { ...location.dmOnlyElements };
          if (dmOnly) {
            updatedDmOnlyElements[elementId] = true;
          } else {
            delete updatedDmOnlyElements[elementId];
          }
          return {
            locations: {
              ...state.locations,
              [campaignCode]: {
                ...campaignLocations,
                [locationId]: {
                  ...location,
                  dmOnlyElements: updatedDmOnlyElements,
                },
              },
            },
          };
        });
      },

      toggleDmOnly: (campaignCode, locationId, elementId) => {
        set(state => {
          const campaignLocations = state.locations[campaignCode];
          if (!campaignLocations || !campaignLocations[locationId]) {
            return state;
          }
          const location = campaignLocations[locationId];
          const currentValue = location.dmOnlyElements[elementId] ?? false;
          const updatedDmOnlyElements = { ...location.dmOnlyElements };
          if (!currentValue) {
            updatedDmOnlyElements[elementId] = true;
          } else {
            delete updatedDmOnlyElements[elementId];
          }
          return {
            locations: {
              ...state.locations,
              [campaignCode]: {
                ...campaignLocations,
                [locationId]: {
                  ...location,
                  dmOnlyElements: updatedDmOnlyElements,
                },
              },
            },
          };
        });
      },
    }),
    {
      name: LOCATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export { generateLocationId };
export default useLocationStore;
