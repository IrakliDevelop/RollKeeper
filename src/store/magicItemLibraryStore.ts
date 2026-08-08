import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSafeStorage } from '@/lib/safeStorage';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

interface MagicItemLibraryState {
  itemsByCampaign: Record<string, CustomMagicItem[]>;
  getItems: (campaignCode: string) => CustomMagicItem[];
  createItem: (
    campaignCode: string,
    item: Omit<
      CustomMagicItem,
      'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
    >
  ) => string;
  updateItem: (
    campaignCode: string,
    id: string,
    updates: Partial<CustomMagicItem>
  ) => void;
  deleteItem: (campaignCode: string, id: string) => void;
  duplicateItem: (campaignCode: string, id: string) => void;
}

const makeId = () =>
  `magic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const useMagicItemLibraryStore = create<MagicItemLibraryState>()(
  persist(
    (set, get) => ({
      itemsByCampaign: {},
      getItems: campaignCode => get().itemsByCampaign[campaignCode] ?? [],
      createItem: (campaignCode, data) => {
        const id = makeId();
        const now = new Date().toISOString();
        const item: CustomMagicItem = {
          ...data,
          id,
          campaignCode,
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({
          itemsByCampaign: {
            ...state.itemsByCampaign,
            [campaignCode]: [
              ...(state.itemsByCampaign[campaignCode] ?? []),
              item,
            ],
          },
        }));
        return id;
      },
      updateItem: (campaignCode, id, updates) =>
        set(state => ({
          itemsByCampaign: {
            ...state.itemsByCampaign,
            [campaignCode]: (state.itemsByCampaign[campaignCode] ?? []).map(
              item =>
                item.id === id
                  ? {
                      ...item,
                      ...updates,
                      id,
                      campaignCode,
                      updatedAt: new Date().toISOString(),
                    }
                  : item
            ),
          },
        })),
      deleteItem: (campaignCode, id) =>
        set(state => ({
          itemsByCampaign: {
            ...state.itemsByCampaign,
            [campaignCode]: (state.itemsByCampaign[campaignCode] ?? []).filter(
              item => item.id !== id
            ),
          },
        })),
      duplicateItem: (campaignCode, id) => {
        const source = get()
          .getItems(campaignCode)
          .find(item => item.id === id);
        if (!source) return;
        const {
          id: _id,
          campaignCode: _campaign,
          createdAt: _created,
          updatedAt: _updated,
          ...copy
        } = structuredClone(source);
        void _id;
        void _campaign;
        void _created;
        void _updated;
        get().createItem(campaignCode, {
          ...copy,
          name: `${source.name} (Copy)`,
        });
      },
    }),
    {
      name: 'rollkeeper-dm-magic-item-library',
      storage: createJSONStorage(() => createSafeStorage()),
      version: 1,
    }
  )
);
