import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TableWorkspaceSnapshotV1 } from '@/lib/table/schema';
import type { CampaignNPC } from '@/types/encounter';

import { useTableShopRepublish } from './useTableShopRepublish';

let npcs: CampaignNPC[] = [];
vi.mock('@/store/npcStore', () => ({
  useNPCStore: {
    getState: () => ({ npcsByCampaign: { CAMP: npcs } }),
  },
}));
vi.mock('@/store/encounterStore', () => ({
  useEncounterStore: {
    getState: () => ({ getEncountersByCampaign: () => [] }),
  },
}));

const workspaceKey = 'guest/workspace:republish';

function snapshotWith(
  members: TableWorkspaceSnapshotV1['scenes'][number]['members']
): TableWorkspaceSnapshotV1 {
  return {
    workspaceKey,
    campaign: null,
    scenes: [
      {
        schemaVersion: 1,
        workspaceKey,
        sceneId: 'scene-1',
        originalMapId: null,
        map: {
          name: 'Market',
          mapImageUrl: '',
          mapImageSize: { w: 1, h: 1 },
          gridEnabled: false,
          gridSettings: null,
          markers: [],
          dmOnlyElements: {},
        },
        canvasCheckpoint: null,
        members,
        arrivalPoint: null,
        createdAt: '2026-10-15T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
    ],
    actors: [
      {
        schemaVersion: 1,
        workspaceKey,
        actorId: 'actor-1',
        actorKind: 'dm-managed',
        liveStats: {
          name: 'Merchant',
          currentHp: 10,
          maxHp: 10,
          tempHp: 0,
          armorClass: 12,
          conditions: [],
        },
        playerReference: null,
        cachedPlayerData: null,
        playerConditionOverlay: null,
        profile: {
          category: 'npc',
          sourceKind: 'campaign-npc',
          sourceId: 'npc-1',
        },
        createdAt: '2026-10-15T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
    ],
    encounters: [],
    logs: [],
    sources: [],
    tombstones: [],
  };
}

const merchant = (open: boolean): CampaignNPC =>
  ({
    id: 'npc-1',
    campaignCode: 'CAMP',
    name: 'Merchant',
    inventory: [],
    shop: { open, updatedAt: '2026-10-15T00:00:00.000Z' },
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  }) as unknown as CampaignNPC;

function mockShops(indexIds: string[] | null) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.method)
      return Response.json({
        shops:
          indexIds === null
            ? []
            : [
                {
                  npcId: 'npc-1',
                  merchantName: 'Merchant',
                  entityIds: indexIds,
                },
              ],
      });
    return Response.json({ success: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const puts = (fetchMock: ReturnType<typeof mockShops>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([url, init]) => ({
      url,
      body: JSON.parse(String(init!.body)) as {
        dmId: string;
        entityIds: string[];
        npc: CampaignNPC;
      },
    }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useTableShopRepublish (repair 09 D2)', () => {
  const member = {
    actorId: 'actor-1',
    tokenIds: [],
    sceneMemberId: 'member-1',
  };

  it('republishes an open shop that does not list a newly added Table member yet', async () => {
    npcs = [merchant(true)];
    const fetchMock = mockShops([]);
    renderHook(() =>
      useTableShopRepublish({
        snapshot: snapshotWith([member]),
        revision: 1,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
      })
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock)).toEqual([
      expect.objectContaining({
        url: '/api/campaign/CAMP/shops/npc-1',
        body: expect.objectContaining({
          dmId: 'dm-1',
          entityIds: ['member-1'],
        }),
      }),
    ]);
  });

  it('drops a removed member from the open shop', async () => {
    npcs = [merchant(true)];
    const fetchMock = mockShops(['member-1']);
    renderHook(() =>
      useTableShopRepublish({
        snapshot: snapshotWith([
          { ...member, removedAt: '2026-10-15T01:00:00.000Z' },
        ]),
        revision: 1,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
      })
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock).map(put => put.body.entityIds)).toEqual([[]]);
  });

  it('sends nothing when the published shop already lists the members', async () => {
    npcs = [merchant(true)];
    const fetchMock = mockShops(['member-1']);
    renderHook(() =>
      useTableShopRepublish({
        snapshot: snapshotWith([member]),
        revision: 1,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
      })
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock)).toEqual([]);
  });

  it('never publishes a closed or unpublished shop', async () => {
    npcs = [merchant(false)];
    let fetchMock = mockShops([]);
    const { rerender } = renderHook(
      (props: { revision: number }) =>
        useTableShopRepublish({
          snapshot: snapshotWith([member]),
          revision: props.revision,
          campaignCode: 'CAMP',
          dmId: 'dm-1',
        }),
      { initialProps: { revision: 1 } }
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).not.toHaveBeenCalled();
    // Open locally but not on the server (no index entry): left alone.
    npcs = [merchant(true)];
    fetchMock = mockShops(null);
    rerender({ revision: 2 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(puts(fetchMock)).toEqual([]);
  });
});
