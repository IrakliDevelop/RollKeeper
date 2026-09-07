// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';

import { NPCDetailDialog } from '../NPCDetailDialog';

// Heavy/unrelated tab content is stubbed so this file stays focused on tab
// wiring (presence, ordering, persistence) rather than re-testing tab bodies
// that already have their own coverage (NPCShopTab.test.tsx, etc).
vi.mock('../NPCShopTab', () => ({
  NPCShopTab: ({ npc, readOnly }: { npc: CampaignNPC; readOnly?: boolean }) => (
    <div data-testid="shop-tab-stub">
      shop-tab:{npc.id}:{readOnly ? 'readonly' : 'editable'}
    </div>
  ),
}));
vi.mock('../NPCSpellTab', () => ({ NPCSpellTab: () => null }));
vi.mock('../NPCStatBlockExport', () => ({ NPCStatBlockExport: () => null }));
vi.mock('@/components/ui/encounter/MonsterStatBlockPanel', () => ({
  MonsterStatBlockPanel: () => null,
}));
vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({ items: [], loading: false }),
}));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({ items: [] }),
}));

const CAMPAIGN_CODE = 'ABCD';

function makeNpc(overrides: Partial<CampaignNPC> = {}): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: CAMPAIGN_CODE,
    name: 'Merchant Mo',
    armorClass: '10',
    maxHp: 10,
    speed: '30 ft',
    inventory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedNpc(npc: CampaignNPC) {
  useNPCStore.setState({ npcsByCampaign: { [CAMPAIGN_CODE]: [npc] } });
}

describe('NPCDetailDialog — Shop tab wiring', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it('lists Shop as a tab, positioned right after Lore', () => {
    const npc = makeNpc();
    seedNpc(npc);
    render(<NPCDetailDialog npc={npc} open={true} onOpenChange={() => {}} />);

    const tabBar = screen.getByRole('button', { name: 'Shop' }).parentElement;
    const labels = Array.from(tabBar?.querySelectorAll('button') ?? []).map(
      b => b.textContent
    );
    const loreIndex = labels.findIndex(l => l?.includes('Lore'));
    const shopIndex = labels.findIndex(l => l?.includes('Shop'));

    expect(loreIndex).toBeGreaterThanOrEqual(0);
    expect(shopIndex).toBe(loreIndex + 1);
  });

  it('selecting the Shop tab renders NPCShopTab and persists lastDetailTab through updateNPC', () => {
    const npc = makeNpc();
    seedNpc(npc);
    render(<NPCDetailDialog npc={npc} open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Shop' }));

    expect(screen.getByTestId('shop-tab-stub')).toHaveTextContent(
      'shop-tab:npc-1:editable'
    );
    expect(
      useNPCStore.getState().getNPC(CAMPAIGN_CODE, 'npc-1')?.lastDetailTab
    ).toBe('shop');
  });

  it('restores the Shop tab on open when lastDetailTab was persisted as shop (regression guard)', () => {
    // Guards against the deleted `npc.lastDetailTab !== 'shop'` bridge clause:
    // widening DetailTab alone does not fail to compile if that exclusion is
    // left in, so this asserts the actual runtime behavior instead.
    const npc = makeNpc({ lastDetailTab: 'shop' });
    seedNpc(npc);
    render(<NPCDetailDialog npc={npc} open={true} onOpenChange={() => {}} />);

    expect(screen.getByTestId('shop-tab-stub')).toBeInTheDocument();
  });

  it('does not show an Add-item-style footer button on the Shop tab', () => {
    const npc = makeNpc();
    seedNpc(npc);
    render(<NPCDetailDialog npc={npc} open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Shop' }));

    expect(screen.queryByRole('button', { name: /Add Item/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Spell/ })).toBeNull();
  });
});
