import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BattleMap } from '@/types/battlemap';

const BATTLEMAP_STORAGE_KEY = 'rollkeeper-battlemap-data';

function generateBattleMapId(): string {
  return (
    'bm-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

type BattleMapData = Record<string, Record<string, BattleMap>>;

interface BattleMapStoreState {
  battleMaps: BattleMapData;
  addBattleMap: (campaignCode: string, battleMap: BattleMap) => void;
  updateBattleMap: (
    campaignCode: string,
    battleMapId: string,
    updates: Partial<BattleMap>
  ) => void;
  removeBattleMap: (campaignCode: string, battleMapId: string) => void;
  getBattleMap: (
    campaignCode: string,
    battleMapId: string
  ) => BattleMap | undefined;
  getBattleMaps: (campaignCode: string) => BattleMap[];
  setDmOnly: (
    campaignCode: string,
    battleMapId: string,
    elementId: string,
    dmOnly: boolean
  ) => void;
  toggleDmOnly: (
    campaignCode: string,
    battleMapId: string,
    elementId: string
  ) => void;
  linkEncounter: (
    campaignCode: string,
    mapId: string,
    encounterId: string
  ) => void;
  unlinkEncounter: (
    campaignCode: string,
    mapId: string,
    encounterId: string
  ) => void;
}

export const useBattleMapStore = create<BattleMapStoreState>()(
  persist(
    (set, get) => ({
      battleMaps: {},
      addBattleMap: (campaignCode, battleMap) => {
        set(state => ({
          battleMaps: {
            ...state.battleMaps,
            [campaignCode]: {
              ...(state.battleMaps[campaignCode] ?? {}),
              [battleMap.id]: battleMap,
            },
          },
        }));
      },
      updateBattleMap: (campaignCode, battleMapId, updates) => {
        set(state => {
          const campaignBattleMaps = state.battleMaps[campaignCode];
          if (!campaignBattleMaps || !campaignBattleMaps[battleMapId])
            return state;
          return {
            battleMaps: {
              ...state.battleMaps,
              [campaignCode]: {
                ...campaignBattleMaps,
                [battleMapId]: {
                  ...campaignBattleMaps[battleMapId],
                  ...updates,
                },
              },
            },
          };
        });
      },
      removeBattleMap: (campaignCode, battleMapId) => {
        set(state => {
          const campaignBattleMaps = state.battleMaps[campaignCode];
          if (!campaignBattleMaps) return state;
          const updated = { ...campaignBattleMaps };
          delete updated[battleMapId];
          return {
            battleMaps: { ...state.battleMaps, [campaignCode]: updated },
          };
        });
      },
      getBattleMap: (campaignCode, battleMapId) => {
        return get().battleMaps[campaignCode]?.[battleMapId];
      },
      getBattleMaps: campaignCode => {
        const campaignBattleMaps = get().battleMaps[campaignCode];
        if (!campaignBattleMaps) return [];
        return Object.values(campaignBattleMaps);
      },
      setDmOnly: (campaignCode, battleMapId, elementId, dmOnly) => {
        set(state => {
          const campaignBattleMaps = state.battleMaps[campaignCode];
          if (!campaignBattleMaps || !campaignBattleMaps[battleMapId])
            return state;
          const battleMap = campaignBattleMaps[battleMapId];
          const updatedDmOnlyElements = { ...battleMap.dmOnlyElements };
          if (dmOnly) {
            updatedDmOnlyElements[elementId] = true;
          } else {
            delete updatedDmOnlyElements[elementId];
          }
          return {
            battleMaps: {
              ...state.battleMaps,
              [campaignCode]: {
                ...campaignBattleMaps,
                [battleMapId]: {
                  ...battleMap,
                  dmOnlyElements: updatedDmOnlyElements,
                },
              },
            },
          };
        });
      },
      toggleDmOnly: (campaignCode, battleMapId, elementId) => {
        set(state => {
          const campaignBattleMaps = state.battleMaps[campaignCode];
          if (!campaignBattleMaps || !campaignBattleMaps[battleMapId])
            return state;
          const battleMap = campaignBattleMaps[battleMapId];
          const currentValue = battleMap.dmOnlyElements[elementId] ?? false;
          const updatedDmOnlyElements = { ...battleMap.dmOnlyElements };
          if (!currentValue) {
            updatedDmOnlyElements[elementId] = true;
          } else {
            delete updatedDmOnlyElements[elementId];
          }
          return {
            battleMaps: {
              ...state.battleMaps,
              [campaignCode]: {
                ...campaignBattleMaps,
                [battleMapId]: {
                  ...battleMap,
                  dmOnlyElements: updatedDmOnlyElements,
                },
              },
            },
          };
        });
      },
      linkEncounter: (campaignCode, mapId, encounterId) => {
        set(state => {
          const campaignBattleMaps = state.battleMaps[campaignCode];
          if (!campaignBattleMaps || !campaignBattleMaps[mapId]) return state;
          const battleMap = campaignBattleMaps[mapId];
          const linkedEncounterIds = battleMap.linkedEncounterIds ?? [];
          if (linkedEncounterIds.includes(encounterId)) return state;
          return {
            battleMaps: {
              ...state.battleMaps,
              [campaignCode]: {
                ...campaignBattleMaps,
                [mapId]: {
                  ...battleMap,
                  linkedEncounterIds: [...linkedEncounterIds, encounterId],
                },
              },
            },
          };
        });
      },
      unlinkEncounter: (campaignCode, mapId, encounterId) => {
        set(state => {
          const campaignBattleMaps = state.battleMaps[campaignCode];
          if (!campaignBattleMaps || !campaignBattleMaps[mapId]) return state;
          const battleMap = campaignBattleMaps[mapId];
          const linkedEncounterIds = battleMap.linkedEncounterIds ?? [];
          const updated = linkedEncounterIds.filter(id => id !== encounterId);
          return {
            battleMaps: {
              ...state.battleMaps,
              [campaignCode]: {
                ...campaignBattleMaps,
                [mapId]: { ...battleMap, linkedEncounterIds: updated },
              },
            },
          };
        });
      },
    }),
    {
      name: BATTLEMAP_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export { generateBattleMapId };
export default useBattleMapStore;
