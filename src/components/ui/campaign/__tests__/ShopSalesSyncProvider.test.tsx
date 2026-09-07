// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopSalesSyncProvider } from '@/components/ui/campaign/ShopSalesSyncProvider';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';

const NOW = '2026-01-01T00:00:00.000Z';
const CAMPAIGN = 'SYNTH1';

interface ShopSalesSyncOptions {
  campaignCode: string;
  dmId: string | null | undefined;
  npcIds: string[];
}

const useDmShopSalesSyncMock = vi.fn<
  (options: ShopSalesSyncOptions) => {
    lastDrainedAt: Date | null;
    error: string | null;
    drainNow: () => void;
  }
>(() => ({
  lastDrainedAt: null,
  error: null,
  drainNow: vi.fn(),
}));

vi.mock('@/hooks/useDmShopSalesSync', () => ({
  useDmShopSalesSync: (options: ShopSalesSyncOptions) =>
    useDmShopSalesSyncMock(options),
}));

function seedNpc(
  campaignCode: string,
  id: string,
  overrides: Record<string, unknown> = {}
) {
  useNPCStore.setState(state => ({
    npcsByCampaign: {
      ...state.npcsByCampaign,
      [campaignCode]: [
        ...(state.npcsByCampaign[campaignCode] ?? []),
        {
          id,
          campaignCode,
          name: `NPC ${id}`,
          armorClass: '10',
          maxHp: 10,
          speed: '30 ft',
          createdAt: NOW,
          updatedAt: NOW,
          ...overrides,
        },
      ],
    },
  }));
}

describe('ShopSalesSyncProvider', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-1' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useNPCStore.setState({ npcsByCampaign: {}, appliedShopSaleIds: {} });
  });

  it('renders its children unconditionally — mounting never depends on any NPC dialog being open', () => {
    render(
      <ShopSalesSyncProvider campaignCode={CAMPAIGN}>
        <p>campaign route content</p>
      </ShopSalesSyncProvider>
    );

    expect(screen.getByText('campaign route content')).toBeInTheDocument();
    // No context/consumer is required for the drain to run — nothing else
    // in the tree had to opt in.
    expect(useDmShopSalesSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ campaignCode: CAMPAIGN, dmId: 'dm-1' })
    );
  });

  it('drains every NPC that has ever had a shop field, closed or open, and never a non-merchant or another campaign’s NPC', () => {
    seedNpc(CAMPAIGN, 'merchant-open', {
      shop: { open: true, updatedAt: NOW },
    });
    seedNpc(CAMPAIGN, 'merchant-closed', {
      shop: { open: false, updatedAt: NOW },
    });
    seedNpc(CAMPAIGN, 'non-merchant');
    seedNpc('OTHER-CAMPAIGN', 'other-merchant', {
      shop: { open: true, updatedAt: NOW },
    });

    render(
      <ShopSalesSyncProvider campaignCode={CAMPAIGN}>
        <p>content</p>
      </ShopSalesSyncProvider>
    );

    const [{ npcIds }] = useDmShopSalesSyncMock.mock.calls.at(-1)!;
    expect(npcIds.sort()).toEqual(['merchant-closed', 'merchant-open']);
  });

  it('is called exactly once for the whole campaign, never once per merchant NPC', () => {
    seedNpc(CAMPAIGN, 'm1', { shop: { open: true, updatedAt: NOW } });
    seedNpc(CAMPAIGN, 'm2', { shop: { open: true, updatedAt: NOW } });
    seedNpc(CAMPAIGN, 'm3', { shop: { open: false, updatedAt: NOW } });

    render(
      <ShopSalesSyncProvider campaignCode={CAMPAIGN}>
        <p>content</p>
      </ShopSalesSyncProvider>
    );

    // A per-NPC mount would call the hook 3 times (once per merchant) and
    // multiply the polling cadence against the same Redis keys.
    expect(useDmShopSalesSyncMock).toHaveBeenCalledTimes(1);
  });
});
