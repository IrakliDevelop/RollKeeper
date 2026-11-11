import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type { ShopSaleLogEntry } from '@/types/shop';
import { NPCShopTab } from './index';

const CODE = 'K7QX2M';
const STAMP = '2026-09-12T00:00:00.000Z';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  desktop: { name: 'Desktop', styles: { width: '1180px', height: '820px' } },
};

const LONG_ITEM = 'Bartholomew Underhill-Greenbottle ceremonial hemp rope';

const CUTLASS: NPCInventoryItem = {
  id: 'inv-cutlass',
  name: 'Harbour Cutlass',
  quantity: 1,
  type: 'weapon',
  rarity: 'uncommon',
  weight: 3,
  value: 2500,
  forSale: true,
  priceCopper: 3000,
};
const ROPE: NPCInventoryItem = {
  id: 'inv-rope',
  name: 'Hemp rope (50 ft.)',
  quantity: 0,
  type: 'gear',
  weight: 10,
  value: 100,
  forSale: true,
  priceCopper: 100,
};
const CHARM: NPCInventoryItem = {
  id: 'inv-charm',
  name: 'Gull-bone charm',
  quantity: 4,
  type: 'gear',
  weight: 0.1,
};

const SALES: ShopSaleLogEntry[] = [
  {
    id: 'sale-1',
    entryId: ROPE.id,
    itemName: ROPE.name,
    quantity: 1,
    copper: 100,
    playerId: 'player-1',
    at: new Date().toISOString(),
    reconciled: true,
  },
  {
    id: 'sale-2',
    entryId: 'inv-gone',
    itemName: 'Potion of healing',
    quantity: 2,
    copper: 16400,
    playerId: 'player-1',
    at: new Date().toISOString(),
    reconciled: false,
  },
];

const npcOf = (extra: Partial<CampaignNPC> = {}): CampaignNPC => ({
  id: 'npc-1',
  campaignCode: CODE,
  name: 'Sella Quickfingers',
  armorClass: '12',
  maxHp: 18,
  speed: '30 ft.',
  createdAt: STAMP,
  updatedAt: STAMP,
  currency: { platinum: 0, gold: 120, electrum: 0, silver: 8, copper: 3 },
  inventory: [CUTLASS, ROPE],
  ...extra,
});

const OPEN_SHOP = {
  open: true,
  updatedAt: STAMP,
  description: 'Ironmonger of the Low Market',
};

const CLOSED = npcOf({ id: 'npc-closed' });
const WITH_SALES = npcOf({ id: 'npc-sales', shop: OPEN_SHOP });
const MISSING_PRICE = npcOf({
  id: 'npc-price',
  inventory: [CUTLASS, CHARM],
  shop: OPEN_SHOP,
});
const NARROW = npcOf({
  id: 'npc-narrow',
  inventory: [{ ...ROPE, name: LONG_ITEM, quantity: 3 }, CUTLASS],
  shop: OPEN_SHOP,
});

/**
 * Answers every request with one canned response: the publish PUT and the
 * sales log's players lookup both go through `fetch`.
 */
const stubFetch = (status: number, body: unknown) => () => {
  const prev = window.fetch;
  window.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )) as typeof fetch;
  return () => {
    window.fetch = prev;
  };
};

const OK = { success: true, shop: {} };
const PLAYERS = {
  players: [
    {
      characterId: 'player-1',
      characterName: 'Mirelle Vane',
      playerName: 'Mirelle Vane',
    },
  ],
};

/** Seeds the store and fetch for one story and clears both afterwards. */
const seed =
  (
    npc: CampaignNPC,
    { entries = [], status = 200, body = OK } = {} as {
      entries?: ShopSaleLogEntry[];
      status?: number;
      body?: unknown;
    }
  ) =>
  () => {
    useNPCStore.setState({
      npcsByCampaign: { [CODE]: [npc] },
      shopSalesLogByNpc: { [npc.id]: entries },
    });
    const restoreFetch = stubFetch(status, body)();
    return () => {
      restoreFetch();
      useNPCStore.setState({ npcsByCampaign: {}, shopSalesLogByNpc: {} });
    };
  };

/** Reads the NPC from the store so toggles and edits show at once. */
function Harness({ npcId, readOnly }: { npcId: string; readOnly?: boolean }) {
  const npc = useNPCStore(state =>
    state.npcsByCampaign[CODE]?.find(entry => entry.id === npcId)
  );
  if (!npc) return null;
  return (
    <div className="p-4" data-testid="shop-root">
      <NPCShopTab npc={npc} readOnly={readOnly} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Campaign/NPCShopTab',
  component: Harness,
  args: { npcId: CLOSED.id },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: { npcId: CLOSED.id },
  beforeEach: seed(CLOSED),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('switch', { name: 'Open for business' })
    ).not.toBeChecked();
    await expect(canvas.getByRole('heading', { name: 'Stock' })).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Sales log' })
    ).toBeVisible();
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const OpenWithSales: Story = {
  args: { npcId: WITH_SALES.id },
  beforeEach: seed(WITH_SALES, { entries: SALES, body: PLAYERS }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('switch', { name: 'Open for business' })
    ).toBeChecked();
    await expect(canvas.getByText('2 sales · 165 gp')).toBeVisible();
    await expect(canvas.getByText('Not matched to stock')).toBeVisible();
    await expect(canvas.getByText('1 sold — none left')).toBeVisible();
    await expect(await canvas.findAllByText(/Mirelle Vane/)).not.toHaveLength(
      0
    );
  },
};

export const MissingPrice: Story = {
  args: { npcId: MISSING_PRICE.id },
  beforeEach: seed(MISSING_PRICE),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Needs a price')).toBeVisible();
    await expect(
      canvas.getByText('Not listed until it has a price')
    ).toBeVisible();
    await expect(
      canvas.getByRole('switch', { name: 'List Gull-bone charm for sale' })
    ).toBeDisabled();
    await expect(
      canvas.getByRole('switch', { name: 'List Harbour Cutlass for sale' })
    ).toBeEnabled();
  },
};

export const ReadOnly: Story = {
  args: { npcId: WITH_SALES.id, readOnly: true },
  beforeEach: seed(WITH_SALES),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switches = canvas.getAllByRole('switch');
    await expect(switches.length).toBeGreaterThan(0);
    for (const control of switches) await expect(control).toBeDisabled();
    const boxes = canvas.getAllByRole('textbox');
    await expect(boxes.length).toBeGreaterThan(0);
    for (const control of boxes) await expect(control).toBeDisabled();
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const PublishFails: Story = {
  args: { npcId: CLOSED.id },
  beforeEach: seed(CLOSED, { status: 500, body: { error: 'Redis down' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('switch', { name: 'Open for business' })
    );
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      "The shop didn't open for players."
    );
    await expect(
      canvas.getByRole('button', { name: 'Try again' })
    ).toBeVisible();
  },
};

/**
 * On a phone nothing pushes the tab wider than the screen, and a long item
 * name wraps above its switch instead of squeezing beside it.
 */
export const Narrow390: Story = {
  args: { npcId: NARROW.id },
  beforeEach: seed(NARROW),
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('shop-root');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    const name = canvas.getByText(LONG_ITEM);
    const toggle = canvas.getByRole('switch', {
      name: `List ${LONG_ITEM} for sale`,
    });
    await waitFor(() =>
      expect(toggle.getBoundingClientRect().top).toBeGreaterThan(
        name.getBoundingClientRect().top
      )
    );
  },
};

export const Dark: Story = {
  args: { npcId: WITH_SALES.id },
  beforeEach: seed(WITH_SALES, { entries: SALES, body: PLAYERS }),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('2 sales · 165 gp')
    ).toBeVisible();
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
  },
};
