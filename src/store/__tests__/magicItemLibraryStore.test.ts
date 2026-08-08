import { beforeEach, describe, expect, it } from 'vitest';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';

const ITEM = {
  name: 'Lantern of Returning',
  category: 'wondrous' as const,
  rarity: 'rare' as const,
  description: 'Always points toward home.',
  properties: ['Sheds bright light'],
  requiresAttunement: true,
  isAttuned: false,
  tags: ['travel', 'quest'],
  group: 'Feywild',
};

describe('magicItemLibraryStore', () => {
  beforeEach(() => {
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
  });

  it('keeps reusable items isolated by campaign', () => {
    useMagicItemLibraryStore.getState().createItem('AAA111', ITEM);
    expect(useMagicItemLibraryStore.getState().getItems('AAA111')).toHaveLength(
      1
    );
    expect(useMagicItemLibraryStore.getState().getItems('BBB222')).toEqual([]);
  });

  it('updates, duplicates, and deletes templates without mutating the source copy', () => {
    const store = useMagicItemLibraryStore.getState();
    const id = store.createItem('AAA111', ITEM);
    store.updateItem('AAA111', id, { rarity: 'legendary' });
    store.duplicateItem('AAA111', id);

    const copies = useMagicItemLibraryStore.getState().getItems('AAA111');
    expect(copies).toHaveLength(2);
    expect(copies[0].rarity).toBe('legendary');
    expect(copies[1].name).toBe('Lantern of Returning (Copy)');
    expect(copies[1].id).not.toBe(id);

    useMagicItemLibraryStore.getState().deleteItem('AAA111', id);
    expect(useMagicItemLibraryStore.getState().getItems('AAA111')).toHaveLength(
      1
    );
  });
});
