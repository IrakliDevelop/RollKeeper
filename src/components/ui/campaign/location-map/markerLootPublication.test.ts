import { describe, expect, it } from 'vitest';

import { buildMarkerLootLedger } from './markerLootPublication';
import type { MarkerDetail, PublicMarkerDetail } from '@/types/battlemap';

const lootMarker = (id: string): MarkerDetail => ({
  id,
  title: 'Chest',
  body: '',
  dmNotes: 'private',
  loot: [
    {
      id: 'potion',
      itemKind: 'inventory',
      item: {
        id: 'source-item',
        name: 'Potion',
        category: 'consumable',
        quantity: 4,
        location: 'Backpack',
        tags: [],
        createdAt: '2026-08-12T00:00:00Z',
        updatedAt: '2026-08-12T00:00:00Z',
      },
      quantity: 2,
      claimedQuantity: 0,
    },
  ],
});

describe('buildMarkerLootLedger', () => {
  it('seeds full item definitions only for explicitly public markers', () => {
    const publicMarkers: PublicMarkerDetail[] = [
      { id: 'public', title: 'Chest', body: '' },
    ];
    const result = buildMarkerLootLedger(
      [lootMarker('public'), lootMarker('hidden')],
      publicMarkers
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      markerId: 'public',
      id: 'potion',
      item: { name: 'Potion' },
    });
  });

  it('does not publish tombstoned containers', () => {
    const marker = { ...lootMarker('gone'), deletedAt: '2026-08-12T00:00:00Z' };
    expect(
      buildMarkerLootLedger([marker], [{ id: 'gone', title: '', body: '' }])
    ).toEqual([]);
  });
});
