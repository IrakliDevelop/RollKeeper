import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useNPCStore } from '@/store/npcStore';
import type {
  CampaignNPC,
  MonsterStatBlock,
  NPCInventoryItem,
  NpcResource,
} from '@/types/encounter';
import { NPCDetailDialog, type NPCDetailDialogProps } from './index';

const CODE = 'K7QX2M';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const STAMP = '2026-09-12T00:00:00.000Z';

const STAT_BLOCK: MonsterStatBlock = {
  str: 12,
  dex: 14,
  con: 13,
  int: 10,
  wis: 15,
  cha: 11,
  saves: 'Wis +4',
  skills: 'Insight +4, Perception +4',
  speed: '30 ft.',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  conditionImmunities: [],
  senses: 'passive Perception 14',
  passivePerception: 14,
  traits: [
    {
      id: 'trait-keen',
      name: 'Keen Ear',
      text: 'Advantage on Perception checks that rely on hearing.',
    },
  ],
  actions: [
    {
      id: 'act-mace',
      name: 'Mace',
      text: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage.',
    },
  ],
  reactions: [],
  bonusActions: [],
  lairActions: [],
  cr: '2',
  type: 'humanoid',
  size: 'Medium',
  languages: 'Common, Dwarvish',
  alignment: 'neutral good',
  hpFormula: '8d8 + 8',
};

const RESOURCES: NpcResource[] = [
  {
    id: 'res-channel',
    name: 'Channel Divinity',
    icon: 'sun',
    color: 'amber',
    displayStyle: 'pips',
    maxUses: 2,
    usesExpended: 1,
    shortRestReset: 'all',
  } as NpcResource,
];

const SWORD: NPCInventoryItem = {
  id: 'inv-sword',
  name: 'Harbour Cutlass',
  quantity: 1,
  type: 'weapon',
  rarity: 'uncommon',
  weight: 3,
  value: 2500,
  equipped: true,
  forSale: true,
  priceCopper: 3000,
};
const ROPE: NPCInventoryItem = {
  id: 'inv-rope',
  name: 'Hemp rope (50 ft.)',
  quantity: 2,
  type: 'gear',
  weight: 10,
  value: 100,
  forSale: true,
  priceCopper: 100,
};
const POTION: NPCInventoryItem = {
  id: 'inv-potion',
  name: 'Potion of healing',
  quantity: 3,
  type: 'potion',
  rarity: 'common',
  weight: 0.5,
  value: 5000,
  description: 'Restores 2d4 + 2 hit points when drunk.',
};

const npcOf = (extra: Partial<CampaignNPC> = {}): CampaignNPC => ({
  id: 'npc-1',
  campaignCode: CODE,
  name: 'Brenn Ironhand',
  armorClass: '15',
  maxHp: 44,
  speed: '30 ft.',
  createdAt: STAMP,
  updatedAt: STAMP,
  ...extra,
});

const BRENN = npcOf({
  description: 'Runs the Rusty Anchor and knows every smuggler on the quay.',
  currentHp: 31,
  tempHp: 6,
  tempAc: '2 (shield)',
  xp: 450,
  proficiencyBonus: 2,
  hitDice: { current: 5, max: 8, dieType: 'd8' },
  passivePerception: 14,
  passiveInsight: 12,
  passiveInvestigation: 11,
  tags: ['merchant', 'quest', 'quest'],
  monsterStatBlock: STAT_BLOCK,
  resources: RESOURCES,
  inventory: [SWORD, ROPE, POTION],
  currency: { platinum: 0, gold: 120, electrum: 0, silver: 8, copper: 3 },
  loreHtml:
    '<p>Brenn lost the left half of his hearing to a cannon at the Siege of Varn.</p>',
  lastDetailTab: 'stats',
});

const MIRA = npcOf({
  id: 'npc-2',
  name: 'Mira Stonehollow',
  description: 'Keeps the lighthouse.',
  armorClass: '11',
  maxHp: 9,
  abilityScores: { str: 8, dex: 12, con: 10, int: 13, wis: 14, cha: 9 },
});

const WOLF = npcOf({
  id: 'npc-3',
  kind: 'monster',
  name: 'Dire wolf',
  armorClass: '14 (natural armor)',
  maxHp: 37,
  speed: '50 ft.',
  monsterStatBlock: { ...STAT_BLOCK, size: 'Large', type: 'beast', cr: '1' },
});

const LONG_NAME = 'Bartholomew Underhill-Greenbottle of the Misty Hollows';

const SHOPKEEPER = npcOf({
  id: 'npc-4',
  name: 'Sella Quickfingers',
  description: 'Sells rope, lamp oil and the odd cutlass.',
  inventory: [SWORD, ROPE],
  shop: {
    open: true,
    updatedAt: STAMP,
    description: 'Ironmonger of the Low Market',
  },
});

const NARROW = npcOf({
  ...BRENN,
  id: 'npc-5',
  name: LONG_NAME,
  shop: { open: true, updatedAt: STAMP },
  lastDetailTab: 'stats',
});

const CARRIER = npcOf({ id: 'npc-6', inventory: [SWORD, ROPE, POTION] });
const EMPTY_HANDED = npcOf({ id: 'npc-7', name: 'Old Tam', inventory: [] });
const LORELESS = npcOf({ id: 'npc-8', name: 'Mira Stonehollow' });

/** Seeds the store for one story and clears it afterwards. */
const seed = (npc: CampaignNPC) => () => {
  useNPCStore.setState({ npcsByCampaign: { [CODE]: [npc] } });
  return () => useNPCStore.setState({ npcsByCampaign: {} });
};

/** Reads the NPC from the store so inventory and purse edits show at once. */
function Harness(props: Omit<NPCDetailDialogProps, 'npc'> & { npcId: string }) {
  const { npcId, ...rest } = props;
  const npc = useNPCStore(state =>
    state.npcsByCampaign[CODE]?.find(entry => entry.id === npcId)
  );
  return (
    <NPCDetailDialog
      {...rest}
      npc={npc ?? null}
      onUpdateInventory={(id, inventory) =>
        useNPCStore.getState().updateNPC(CODE, id, { inventory })
      }
    />
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Campaign/NPCDetailDialog',
  component: Harness,
  args: {
    npcId: BRENN.id,
    open: true,
    onOpenChange: fn(),
    onEdit: fn(),
    onDelete: fn(),
    onSendItemToPlayer: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
  },
  globals: { viewport: { value: 'landscape', isRotated: false } },
};

export default meta;
type Story = StoryObj<typeof meta>;

// The dialog renders in a portal on document.body.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

/** The open dialog, once its fade-in has finished (opacity counts as hidden). */
async function openDialog(canvasElement: HTMLElement) {
  const dialog = await body(canvasElement).findByRole('dialog');
  await waitFor(() => expect(dialog).toBeVisible());
  return dialog;
}

export const StatBlock: Story = {
  beforeEach: seed(BRENN),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('heading', { name: 'Brenn Ironhand' })
    ).toBeVisible();
    // The meta line is the dialog's one description; the note is plain text.
    const describedBy = (dialog.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    await expect(describedBy).toHaveLength(1);
    const description = canvasElement.ownerDocument.getElementById(
      describedBy[0]
    );
    await expect(description).not.toBeNull();
    await expect(description).toHaveTextContent('Medium humanoid · CR 2');
    await expect(
      within(dialog).getByText(
        'Runs the Rusty Anchor and knows every smuggler on the quay.'
      )
    ).toBeVisible();
    // A repeated tag prints once.
    const tags = within(within(dialog).getByRole('list', { name: 'Tags' }));
    await expect(tags.getAllByRole('listitem')).toHaveLength(2);
    await expect(within(dialog).getByText('Channel Divinity')).toBeVisible();
    await expect(
      within(dialog).getByRole('button', { name: 'Take a short rest' })
    ).toBeVisible();
  },
};

export const NoStatBlock: Story = {
  args: { npcId: MIRA.id },
  beforeEach: seed(MIRA),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(within(dialog).getByText('STR')).toBeVisible();
    await expect(within(dialog).getByText('+2')).toBeVisible(); // WIS 14
  },
};

export const Monster: Story = {
  args: { npcId: WOLF.id },
  beforeEach: seed(WOLF),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('heading', { name: 'Dire wolf' })
    ).toBeVisible();
    await expect(within(dialog).getByText('Large beast · CR 1')).toBeVisible();
  },
};

export const InventoryEditable: Story = {
  args: { npcId: CARRIER.id, initialTab: 'inventory' },
  beforeEach: seed(CARRIER),
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    const dialog = await openDialog(canvasElement);
    await expect(
      await within(dialog).findByRole('button', { name: 'Harbour Cutlass' })
    ).toBeVisible();
    await expect(
      within(dialog).getAllByRole('button', { name: /^Remove / })
    ).toHaveLength(3);

    // Remove asks first; Cancel keeps the row.
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove Potion of healing' })
    );
    const confirm = await screen.findByRole('alertdialog');
    await waitFor(() =>
      expect(
        within(confirm).getByText('Remove Potion of healing?')
      ).toBeVisible()
    );
    await expect(
      within(confirm).getByText('Brenn Ironhand no longer carries it.')
    ).toBeInTheDocument();
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Cancel' })
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
    await expect(
      within(dialog).getByRole('button', { name: 'Potion of healing' })
    ).toBeVisible();
    await expect(
      useNPCStore.getState().npcsByCampaign[CODE][0].inventory
    ).toHaveLength(3);

    // Confirming removes it.
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove Potion of healing' })
    );
    const again = await screen.findByRole('alertdialog');
    await userEvent.click(
      within(again).getByRole('button', { name: 'Remove item' })
    );
    await waitFor(() =>
      expect(
        within(dialog).queryByRole('button', { name: 'Potion of healing' })
      ).not.toBeInTheDocument()
    );
    await expect(
      useNPCStore.getState().npcsByCampaign[CODE][0].inventory
    ).toHaveLength(2);
  },
};

export const InventoryReadOnly: Story = {
  args: { npcId: CARRIER.id, initialTab: 'inventory', readOnly: true },
  beforeEach: seed(CARRIER),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      await within(dialog).findByRole('button', { name: 'Harbour Cutlass' })
    ).toBeVisible();
    await expect(
      within(dialog).queryByRole('button', { name: /^Remove / })
    ).not.toBeInTheDocument();
    await expect(
      within(dialog).queryByRole('button', { name: 'Add item' })
    ).not.toBeInTheDocument();
  },
};

export const InventoryEmpty: Story = {
  args: { npcId: EMPTY_HANDED.id, initialTab: 'inventory' },
  beforeEach: seed(EMPTY_HANDED),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      await within(dialog).findByText('Old Tam carries nothing yet')
    ).toBeVisible();
    await expect(
      within(dialog).getAllByRole('button', { name: 'Add item' })
    ).toHaveLength(1);
  },
};

export const LoreEmpty: Story = {
  args: { npcId: LORELESS.id, initialTab: 'lore' },
  beforeEach: seed(LORELESS),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(await within(dialog).findByText('No lore yet')).toBeVisible();
    await expect(
      within(dialog).getByRole('button', { name: 'Add lore' })
    ).toBeVisible();
  },
};

export const Shop: Story = {
  args: { npcId: SHOPKEEPER.id, initialTab: 'shop' },
  beforeEach: seed(SHOPKEEPER),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('tab', { name: 'Shop', selected: true })
    ).toBeVisible();
    await expect(within(dialog).getByText('Shop open')).toBeVisible();
  },
};

/**
 * On a phone the tab list stays whole (every tab, Shop included, inside its
 * box), a long name wraps inside the title, and nothing pushes the page wider
 * than the screen. A spellcaster adds a fifth tab; see the task report.
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
    const dialog = await openDialog(canvasElement);
    const dialogRect = dialog.getBoundingClientRect();
    const tablist = within(dialog).getByRole('tablist');
    // The tab list keeps its labels whole.
    // The 1px is the active tab's border, which overlaps the list's rule.
    await expect(tablist.clientHeight + 1).toBeGreaterThanOrEqual(
      tablist.scrollHeight
    );
    const tabsRect = tablist.getBoundingClientRect();
    await expect(tabsRect.top).toBeGreaterThanOrEqual(dialogRect.top);
    await expect(tabsRect.bottom).toBeLessThanOrEqual(dialogRect.bottom);
    await expect(tabsRect.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);

    const title = within(dialog).getByRole('heading', { name: LONG_NAME });
    await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);

    const shop = within(dialog).getByRole('tab', { name: 'Shop' });
    shop.focus();
    await waitFor(
      () => {
        const listRect = tablist.getBoundingClientRect();
        const shopRect = shop.getBoundingClientRect();
        expect(shopRect.left).toBeGreaterThanOrEqual(listRect.left - 1);
        expect(shopRect.right).toBeLessThanOrEqual(listRect.right + 1);
      },
      { timeout: 3000 }
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  },
};

export const Dark: Story = {
  args: { npcId: BRENN.id },
  beforeEach: seed(BRENN),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Lore' }));
    await expect(
      within(dialog).getByText(/lost the left half of his hearing/)
    ).toBeVisible();
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
  },
};
