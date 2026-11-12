// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useState } from 'react';

import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import {
  queryConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { creatureMetaLine } from '../NpcLibrary/NpcLibrary.utils';

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
vi.mock('../NPCSpellTab', () => ({
  NPCSpellTab: ({
    readOnly,
    addSpellButtonRef,
  }: {
    readOnly?: boolean;
    addSpellButtonRef?: { current: HTMLButtonElement | null };
  }) => (
    <div data-testid="spell-tab-stub">
      spell-tab:{readOnly ? 'readonly' : 'editable'}:
      {addSpellButtonRef ? 'focus-ref' : 'no-focus-ref'}
    </div>
  ),
}));
vi.mock('../NPCStatBlockExport', () => ({ NPCStatBlockExport: () => null }));
vi.mock('@/components/ui/encounter/MonsterStatBlockPanel', () => ({
  MonsterStatBlockPanel: () => <div data-testid="stat-block-panel-stub" />,
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

const NOW = '2026-01-01T00:00:00.000Z';

const STAT_BLOCK = {
  size: 'Medium',
  type: 'humanoid',
  cr: '1',
  dex: 14,
} as unknown as NonNullable<CampaignNPC['monsterStatBlock']>;

function setup(
  npc: CampaignNPC,
  props: Partial<React.ComponentProps<typeof NPCDetailDialog>> = {}
) {
  seedNpc(npc);
  const onOpenChange = vi.fn();
  const view = render(
    <NPCDetailDialog
      npc={npc}
      open={true}
      onOpenChange={onOpenChange}
      {...props}
    />
  );
  return { onOpenChange, ...view };
}

function storedTab() {
  return useNPCStore.getState().getNPC(CAMPAIGN_CODE, 'npc-1')?.lastDetailTab;
}

describe('NPCDetailDialog — tabs', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('puts Shop last and names the tab list after the kind', () => {
    setup(makeNpc({ spellcasting: { casterLevel: 3 } as never }));
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual(['Stat block', 'Spells', 'Inventory', 'Lore', 'Shop']);
    expect(
      screen.getByRole('tablist', { name: 'NPC sheet' })
    ).toBeInTheDocument();
    cleanup();
    setup(makeNpc({ kind: 'monster' }));
    expect(
      screen.getByRole('tablist', { name: 'Custom monster sheet' })
    ).toBeInTheDocument();
  });

  it('selecting Shop renders the stub and persists lastDetailTab', async () => {
    const user = userEvent.setup();
    setup(makeNpc());
    await user.click(screen.getByRole('tab', { name: 'Shop' }));
    expect(screen.getByTestId('shop-tab-stub')).toHaveTextContent(
      'shop-tab:npc-1:editable'
    );
    expect(storedTab()).toBe('shop');
  });

  it('writes lastDetailTab on every change, readOnly included', async () => {
    const user = userEvent.setup();
    setup(makeNpc(), { readOnly: true });
    await user.click(screen.getByRole('tab', { name: 'Lore' }));
    expect(storedTab()).toBe('lore');
  });

  it('opens on a persisted Shop tab', () => {
    setup(makeNpc({ lastDetailTab: 'shop' }));
    expect(screen.getByTestId('shop-tab-stub')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Shop' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('opens a persisted Spells tab on Stat block when the NPC is not a caster', () => {
    setup(makeNpc({ lastDetailTab: 'spells' }));
    expect(screen.getByRole('tab', { name: 'Stat block' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByTestId('spell-tab-stub')).toBeNull();
  });

  it('initialTab wins over the persisted tab', () => {
    setup(makeNpc({ lastDetailTab: 'shop' }), { initialTab: 'lore' });
    expect(screen.getByRole('tab', { name: 'Lore' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

describe('NPCDetailDialog — header', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a neutral "Shop open" badge only when the shop is open', () => {
    setup(makeNpc());
    expect(screen.queryByText('Shop open')).toBeNull();
    cleanup();
    setup(makeNpc({ shop: { open: false, updatedAt: NOW } }));
    expect(screen.queryByText('Shop open')).toBeNull();
    cleanup();
    setup(makeNpc({ shop: { open: true, updatedAt: NOW } }));
    expect(screen.getByText('Shop open')).toHaveAttribute(
      'data-variant',
      'neutral'
    );
  });

  it('has one Edit and one Delete button, both in the footer', () => {
    setup(makeNpc(), { onEdit: vi.fn(), onDelete: vi.fn() });
    expect(
      screen.getAllByRole('button', { name: /^(Edit|Delete) NPC$/ })
    ).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Edit NPC' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Delete NPC' })).toHaveLength(
      1
    );
    const header = screen
      .getByRole('heading', { name: 'Merchant Mo' })
      .closest('[class*="pr-10"]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(
      within(header).queryByRole('button', { name: /Edit|Delete/ })
    ).toBeNull();
  });

  it('describes the dialog with the meta line and prints the private note apart', () => {
    const npc = makeNpc({
      monsterStatBlock: STAT_BLOCK,
      description: 'Owes the DM a favour.',
    });
    setup(npc);
    const dialog = screen.getByRole('dialog');
    const described = document.getElementById(
      dialog.getAttribute('aria-describedby') ?? ''
    );
    expect(described).toHaveTextContent(creatureMetaLine(npc));
    expect(described).not.toHaveTextContent('Owes the DM a favour.');
    expect(screen.getByText('Owes the DM a favour.').tagName).toBe('P');
  });

  it('describes the dialog with the note when there is no meta line', () => {
    setup(makeNpc({ description: 'Owes the DM a favour.' }));
    const dialog = screen.getByRole('dialog');
    const described = document.getElementById(
      dialog.getAttribute('aria-describedby') ?? ''
    );
    expect(described).toHaveTextContent('Owes the DM a favour.');
  });

  it('has no description when both the meta line and the note are empty', () => {
    setup(makeNpc());
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('shows the portrait button only with an avatar', () => {
    setup(makeNpc());
    expect(
      screen.queryByRole('button', { name: /image full size/ })
    ).toBeNull();
    cleanup();
    setup(makeNpc({ avatarUrl: 'data:image/png;base64,AAAA' }));
    expect(
      screen.getByRole('button', { name: 'View Merchant Mo image full size' })
    ).toBeInTheDocument();
  });
});

describe('NPCDetailDialog — Stat block tab', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reads HP through HpReadout: heading while healthy, ember while bloodied', () => {
    setup(makeNpc({ currentHp: 8 }));
    expect(screen.getByText('8')).toHaveClass('text-heading');
    expect(screen.getByText('/ 10 HP')).toBeInTheDocument();
    cleanup();
    setup(makeNpc({ currentHp: 7 }));
    expect(screen.getByText('7')).toHaveClass('text-ember-text');
  });

  it('lists AC, Speed and Initiative as a definition list', () => {
    setup(makeNpc({ initiativeModifier: 2 }));
    expect(screen.getByText('AC').nextElementSibling).toHaveTextContent('10');
    expect(screen.getByText('Speed').nextElementSibling).toHaveTextContent(
      '30 ft'
    );
    expect(screen.getByText('Initiative').nextElementSibling).toHaveTextContent(
      '+2'
    );
  });

  it('falls back to the DEX modifier for Initiative', () => {
    setup(
      makeNpc({
        abilityScores: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
      })
    );
    expect(screen.getByText('Initiative').nextElementSibling).toHaveTextContent(
      '-1'
    );
  });

  it('lists the extras that are set and omits the list when none are', () => {
    setup(
      makeNpc({
        xp: 1100,
        proficiencyBonus: 3,
        hitDice: { current: 2, max: 3, dieType: 'd8' },
        passivePerception: 14,
      })
    );
    expect(screen.getByText('XP').nextElementSibling).toHaveTextContent(
      (1100).toLocaleString()
    );
    expect(
      screen.getByText('Proficiency bonus').nextElementSibling
    ).toHaveTextContent('+3');
    expect(screen.getByText('Hit dice').nextElementSibling).toHaveTextContent(
      '2 of 3 (d8)'
    );
    expect(
      screen.getByText('Passive Perception').nextElementSibling
    ).toHaveTextContent('14');
    cleanup();
    setup(makeNpc());
    expect(screen.queryByText('Proficiency bonus')).toBeNull();
    expect(screen.queryByText('XP')).toBeNull();
    expect(screen.queryByText('Hit dice')).toBeNull();
    expect(screen.queryByText(/^Passive /)).toBeNull();
  });

  it('prints each tag once and no list when there are none', () => {
    setup(makeNpc({ tags: ['merchant', 'town', 'merchant'] }));
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    cleanup();
    setup(makeNpc());
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull();
  });

  it('rests the NPC from the two rest buttons and hides them when read-only', () => {
    const short = vi.spyOn(useNPCStore.getState(), 'shortRestNPC');
    const long = vi.spyOn(useNPCStore.getState(), 'longRestNPC');
    setup(makeNpc());
    fireEvent.click(screen.getByRole('button', { name: 'Take a short rest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take a long rest' }));
    expect(short).toHaveBeenCalledWith(CAMPAIGN_CODE, 'npc-1');
    expect(long).toHaveBeenCalledWith(CAMPAIGN_CODE, 'npc-1');
    cleanup();
    setup(makeNpc(), { readOnly: true });
    expect(screen.queryByRole('button', { name: /rest/ })).toBeNull();
  });

  it('mounts the stat block panel when there is one', () => {
    setup(makeNpc({ monsterStatBlock: STAT_BLOCK }));
    expect(screen.getByTestId('stat-block-panel-stub')).toBeInTheDocument();
  });

  it('shows the ability scores when there is no stat block', () => {
    setup(
      makeNpc({
        abilityScores: { str: 16, dex: 12, con: 10, int: 8, wis: 10, cha: 14 },
      })
    );
    expect(screen.getByText('STR').nextElementSibling).toHaveTextContent('16');
    expect(screen.getByText('STR').nextElementSibling).toHaveTextContent('+3');
    expect(screen.getByText('CHA')).toBeInTheDocument();
  });
});

describe('NPCDetailDialog — Lore tab', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('offers "Add lore" when the lore is empty; it edits and closes', () => {
    const onEdit = vi.fn();
    const npc = makeNpc();
    const { onOpenChange } = setup(npc, { onEdit, initialTab: 'lore' });
    expect(screen.getByText('No lore yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add lore' }));
    expect(onEdit).toHaveBeenCalledWith(npc);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the heading only when read-only', () => {
    setup(makeNpc(), { onEdit: vi.fn(), readOnly: true, initialTab: 'lore' });
    expect(screen.getByText('No lore yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add lore' })).toBeNull();
  });
});

describe('NPCDetailDialog — footer', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('names Edit and Delete by kind (kind undefined reads as NPC)', () => {
    setup(makeNpc(), { onEdit: vi.fn(), onDelete: vi.fn() });
    expect(
      screen.getByRole('button', { name: 'Edit NPC' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete NPC' })
    ).toBeInTheDocument();
    cleanup();
    setup(makeNpc({ kind: 'monster' }), {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(
      screen.getByRole('button', { name: 'Edit custom monster' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete custom monster' })
    ).toBeInTheDocument();
  });

  it('Edit hands over the NPC and closes', () => {
    const onEdit = vi.fn();
    const npc = makeNpc();
    const { onOpenChange } = setup(npc, { onEdit, onDelete: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Edit NPC' }));
    expect(onEdit).toHaveBeenCalledWith(npc);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Delete calls onDelete once and opens no confirmation', () => {
    const onDelete = vi.fn();
    const npc = makeNpc();
    seedNpc(npc);
    renderConfirmDialogHost();
    render(
      <NPCDetailDialog
        npc={npc}
        open={true}
        onOpenChange={() => {}}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete NPC' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(npc);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(queryConfirmDialog()).toBeNull();
  });

  it('hides rests, Edit and Delete when read-only', () => {
    setup(makeNpc(), { onEdit: vi.fn(), onDelete: vi.fn(), readOnly: true });
    expect(screen.queryByRole('button', { name: 'Edit NPC' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete NPC' })).toBeNull();
    expect(screen.queryByRole('button', { name: /rest/ })).toBeNull();
  });

  it('shows Add spell only on the Spells tab', async () => {
    const user = userEvent.setup();
    setup(makeNpc({ spellcasting: { casterLevel: 3 } as never }));
    expect(screen.queryByRole('button', { name: 'Add spell' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Spells' }));
    expect(
      screen.getByRole('button', { name: 'Add spell' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Shop' }));
    expect(screen.queryByRole('button', { name: 'Add spell' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
  });

  it('hides the footer Add spell on the Spells tab when read-only', () => {
    setup(makeNpc({ spellcasting: { casterLevel: 3 } as never }), {
      initialTab: 'spells',
      readOnly: true,
    });
    expect(screen.getByTestId('spell-tab-stub')).toHaveTextContent(
      'spell-tab:readonly'
    );
    expect(screen.queryByRole('button', { name: 'Add spell' })).toBeNull();
  });

  it('shows the footer Add spell on the Spells tab when not read-only', () => {
    setup(makeNpc({ spellcasting: { casterLevel: 3 } as never }), {
      initialTab: 'spells',
    });
    const addSpell = screen.getByRole('button', { name: 'Add spell' });
    expect(screen.getByTestId('spell-tab-stub')).toHaveTextContent(
      'spell-tab:editable:focus-ref'
    );
    // The tab focuses this button after removing its last spell.
    expect(addSpell).toBeInTheDocument();
  });
});

const ROPE: NPCInventoryItem = {
  id: 'rope',
  name: 'Rope',
  quantity: 2,
  rarity: 'rare',
  type: 'wondrous',
  weight: 2,
  value: 500,
  equipped: true,
};
const LAMP: NPCInventoryItem = { id: 'lamp', name: 'Lamp', quantity: 1 };
const KEY: NPCInventoryItem = { id: 'key', name: 'Key', quantity: 1 };

function itemRow(name: string): HTMLElement {
  return screen.getByRole('button', { name }).closest('li') as HTMLElement;
}

/** Applies inventory updates to the NPC it renders, as the store would. */
function InventoryHarness({ initial }: { initial: CampaignNPC }) {
  const [npc, setNpc] = useState(initial);
  return (
    <NPCDetailDialog
      npc={npc}
      open={true}
      onOpenChange={() => {}}
      initialTab="inventory"
      onUpdateInventory={(_id, inventory) =>
        setNpc(prev => ({ ...prev, inventory }))
      }
    />
  );
}

describe('NPCDetailDialog — footer presence', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
  });

  it('renders no footer when it would be empty', () => {
    setup(makeNpc(), { readOnly: true });
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[class*="justify-between"]')).toBeNull();
    cleanup();
    setup(makeNpc(), { onEdit: vi.fn(), onDelete: vi.fn() });
    expect(
      screen.getByRole('dialog').querySelector('[class*="justify-between"]')
    ).not.toBeNull();
  });
});

describe('NPCDetailDialog — quantity without a stepper', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows ×n for a stack when only Send is offered', () => {
    setup(makeNpc({ inventory: [ROPE] }), {
      initialTab: 'inventory',
      onSendItemToPlayer: vi.fn(),
    });
    const row = itemRow('Rope');
    expect(row).toHaveTextContent('×2');
    expect(
      within(row).getByRole('button', { name: 'Send Rope to a player' })
    ).toBeInTheDocument();
  });
});

describe('NPCDetailDialog — Inventory tab', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens the shared inventory form from an NPC inventory', () => {
    setup(makeNpc(), { onUpdateInventory: () => {}, initialTab: 'inventory' });

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    const form = screen.getByRole('dialog', { name: 'Add item' });
    expect(form).toBeInTheDocument();
    expect(screen.getByText('Basic information')).toBeInTheDocument();
    expect(
      within(form).getByRole('button', { name: 'Add item' })
    ).toBeDisabled();
  });

  it('lists items as rows inside the Items section', () => {
    setup(makeNpc({ inventory: [ROPE, LAMP] }), { initialTab: 'inventory' });
    const section = screen.getByRole('region', { name: 'Items' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    const name = within(section).getByRole('button', { name: 'Rope' });
    expect(name).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('prints Equipped as a neutral badge and the meta line without a none rarity', () => {
    setup(
      makeNpc({
        inventory: [
          ROPE,
          {
            id: 'sword',
            name: 'Sword',
            quantity: 1,
            rarity: 'none',
            type: 'weapon',
          },
        ],
      }),
      { initialTab: 'inventory' }
    );
    const rope = itemRow('Rope');
    expect(within(rope).getByText('Equipped')).toHaveAttribute(
      'data-variant',
      'neutral'
    );
    expect(rope).toHaveTextContent('Rare · Wondrous · 2 lb · 5 gp');
    const sword = itemRow('Sword');
    expect(within(sword).queryByText('Equipped')).toBeNull();
    expect(within(sword).getByText('Weapon')).toBeInTheDocument();
  });

  it('names every row control after the item', () => {
    setup(makeNpc({ inventory: [ROPE] }), {
      initialTab: 'inventory',
      onUpdateInventory: vi.fn(),
      onSendItemToPlayer: vi.fn(),
    });
    for (const name of [
      'Decrease quantity: Rope',
      'Increase quantity: Rope',
      'Send Rope to a player',
      'Edit Rope',
      'Remove Rope',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('offers Send only with a send handler', () => {
    setup(makeNpc({ inventory: [ROPE] }), {
      initialTab: 'inventory',
      onUpdateInventory: vi.fn(),
    });
    expect(screen.queryByRole('button', { name: /^Send / })).toBeNull();
  });

  it('changes the quantity at once and disables Decrease at 0', () => {
    const onUpdateInventory = vi.fn();
    setup(makeNpc({ inventory: [ROPE] }), {
      initialTab: 'inventory',
      onUpdateInventory,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase quantity: Rope' })
    );
    expect(onUpdateInventory).toHaveBeenCalledWith('npc-1', [
      { ...ROPE, quantity: 3 },
    ]);
    cleanup();
    setup(makeNpc({ inventory: [{ ...ROPE, quantity: 0 }] }), {
      initialTab: 'inventory',
      onUpdateInventory,
    });
    expect(
      screen.getByRole('button', { name: 'Decrease quantity: Rope' })
    ).toBeDisabled();
  });

  it('shows no controls when read-only, and ×n only above 1', () => {
    setup(makeNpc({ inventory: [{ ...ROPE, quantity: 3 }, LAMP] }), {
      initialTab: 'inventory',
      readOnly: true,
      onUpdateInventory: vi.fn(),
      onSendItemToPlayer: vi.fn(),
    });
    expect(
      screen.queryByRole('button', {
        name: /^(Decrease|Increase|Send|Edit|Remove)/,
      })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
    expect(itemRow('Rope')).toHaveTextContent('×3');
    expect(itemRow('Lamp')).not.toHaveTextContent('×');
  });

  it('puts Add item in the Items heading row once there are items', () => {
    setup(makeNpc({ inventory: [LAMP] }), {
      initialTab: 'inventory',
      onUpdateInventory: vi.fn(),
    });
    const section = screen.getByRole('region', { name: 'Items' });
    expect(
      within(section).getAllByRole('button', { name: 'Add item' })
    ).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Add item' })).toHaveLength(1);
  });

  it('shows the empty state with one Add item, and the heading only when read-only', () => {
    setup(makeNpc(), { initialTab: 'inventory', onUpdateInventory: vi.fn() });
    expect(
      screen.getByText('Merchant Mo carries nothing yet')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add item' })).toHaveLength(1);
    cleanup();
    setup(makeNpc(), {
      initialTab: 'inventory',
      onUpdateInventory: vi.fn(),
      readOnly: true,
    });
    expect(
      screen.getByText('Merchant Mo carries nothing yet')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
  });

  describe('removing', () => {
    beforeEach(() => {
      renderConfirmDialogHost();
    });

    it('asks first, keeps the item on Cancel and removes it on Remove item', async () => {
      const onUpdateInventory = vi.fn();
      setup(makeNpc({ inventory: [ROPE, LAMP] }), {
        initialTab: 'inventory',
        onUpdateInventory,
      });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Rope' }));
      const alert = await screen.findByRole('alertdialog', {
        name: 'Remove Rope?',
      });
      expect(alert).toHaveTextContent('Merchant Mo no longer carries it.');
      expect(onUpdateInventory).not.toHaveBeenCalled();
      fireEvent.click(within(alert).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(onUpdateInventory).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Remove Rope' }));
      const again = await screen.findByRole('alertdialog');
      fireEvent.click(
        within(again).getByRole('button', { name: 'Remove item' })
      );
      await waitFor(() =>
        expect(onUpdateInventory).toHaveBeenCalledWith('npc-1', [LAMP])
      );
    });

    it('removes from the latest inventory when it changed while the confirm was open', async () => {
      const onUpdateInventory = vi.fn();
      const npc = makeNpc({ inventory: [ROPE, LAMP] });
      const { rerender } = setup(npc, {
        initialTab: 'inventory',
        onUpdateInventory,
      });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Rope' }));
      const alert = await screen.findByRole('alertdialog', {
        name: 'Remove Rope?',
      });
      rerender(
        <NPCDetailDialog
          npc={{ ...npc, inventory: [ROPE, LAMP, KEY] }}
          open={true}
          onOpenChange={vi.fn()}
          initialTab="inventory"
          onUpdateInventory={onUpdateInventory}
        />
      );
      fireEvent.click(
        within(alert).getByRole('button', { name: 'Remove item' })
      );
      await waitFor(() =>
        expect(onUpdateInventory).toHaveBeenCalledWith('npc-1', [LAMP, KEY])
      );
    });

    it('moves focus to the next row, then the previous, then Add item', async () => {
      vi.useFakeTimers();
      const npc = makeNpc({ inventory: [ROPE, LAMP, KEY] });
      seedNpc(npc);
      render(<InventoryHarness initial={npc} />);

      const remove = async (name: string) => {
        fireEvent.click(screen.getByRole('button', { name: `Remove ${name}` }));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        const alert = screen.getByRole('alertdialog');
        fireEvent.click(
          within(alert).getByRole('button', { name: 'Remove item' })
        );
        await act(async () => {
          await vi.advanceTimersByTimeAsync(250);
        });
      };

      await remove('Lamp');
      expect(screen.getByRole('button', { name: 'Key' })).toHaveFocus();
      await remove('Key');
      expect(screen.getByRole('button', { name: 'Rope' })).toHaveFocus();
      await remove('Rope');
      expect(screen.getByRole('button', { name: 'Add item' })).toHaveFocus();
    });
  });

  describe('item view', () => {
    const THREE: NPCInventoryItem = {
      ...ROPE,
      quantity: 3,
      category: 'treasure',
      description: '<p>Never frays.</p>',
    };

    it('opens from the name, titled with the item, described by rarity, type and Equipped', () => {
      setup(makeNpc({ inventory: [THREE] }), { initialTab: 'inventory' });
      fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
      const view = screen.getByRole('dialog', { name: 'Rope' });
      const described = document.getElementById(
        view.getAttribute('aria-describedby') ?? ''
      );
      expect(described).toHaveTextContent('Rare · Wondrous · Equipped');
      expect(within(view).getByText('Never frays.')).toBeInTheDocument();
      expect(
        within(view).getByRole('heading', { level: 3, name: 'Description' })
      ).toBeInTheDocument();
    });

    it('lists the facts with each and total figures', () => {
      setup(makeNpc({ inventory: [THREE] }), { initialTab: 'inventory' });
      fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
      const view = screen.getByRole('dialog', { name: 'Rope' });
      expect(
        within(view).getByText('Category').nextElementSibling
      ).toHaveTextContent('Treasure');
      expect(
        within(view).getByText('Quantity').nextElementSibling
      ).toHaveTextContent('3');
      const weight = within(view).getByText('Weight').nextElementSibling;
      expect(weight).toHaveTextContent('2 lb each');
      expect(weight).toHaveTextContent('(6 lb total)');
      const value = within(view).getByText('Value').nextElementSibling;
      expect(value).toHaveTextContent('5 gp each');
      expect(value).toHaveTextContent('(15 gp total)');
    });

    it('omits the total for a single item and the description when nothing is set', () => {
      setup(makeNpc({ inventory: [KEY] }), { initialTab: 'inventory' });
      fireEvent.click(screen.getByRole('button', { name: 'Key' }));
      const view = screen.getByRole('dialog', { name: 'Key' });
      expect(view).not.toHaveAttribute('aria-describedby');
      expect(within(view).queryByText(/total/)).toBeNull();
      expect(
        within(view).queryByRole('heading', { name: 'Description' })
      ).toBeNull();
    });

    it('has Edit item (secondary) only with an update handler, and Close (outline)', () => {
      setup(makeNpc({ inventory: [THREE] }), {
        initialTab: 'inventory',
        onUpdateInventory: vi.fn(),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
      const view = screen.getByRole('dialog', { name: 'Rope' });
      expect(
        within(view).getByRole('button', { name: 'Edit item' })
      ).toHaveAttribute('data-variant', 'secondary');
      const closes = within(view).getAllByRole('button', { name: 'Close' });
      expect(
        closes.some(b => b.getAttribute('data-variant') === 'outline')
      ).toBe(true);
      cleanup();
      setup(makeNpc({ inventory: [THREE] }), { initialTab: 'inventory' });
      fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
      expect(screen.queryByRole('button', { name: 'Edit item' })).toBeNull();
    });

    it('Edit item swaps to the item form', () => {
      setup(makeNpc({ inventory: [THREE] }), {
        initialTab: 'inventory',
        onUpdateInventory: vi.fn(),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
      expect(
        screen.getByRole('dialog', { name: 'Edit item' })
      ).toBeInTheDocument();
    });

    it('Escape closes only the item view', async () => {
      const { onOpenChange } = setup(makeNpc({ inventory: [THREE] }), {
        initialTab: 'inventory',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
      expect(screen.getByRole('dialog', { name: 'Rope' })).toBeInTheDocument();
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      });
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Rope' })).toBeNull()
      );
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(
        screen.getByRole('dialog', { name: 'Merchant Mo' })
      ).toBeInTheDocument();
    });

    it('Escape closes only the Add item form', async () => {
      const { onOpenChange } = setup(makeNpc({ inventory: [KEY] }), {
        initialTab: 'inventory',
        onUpdateInventory: vi.fn(),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
      expect(
        screen.getByRole('dialog', { name: 'Add item' })
      ).toBeInTheDocument();
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      });
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Add item' })).toBeNull()
      );
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(
        screen.getByRole('dialog', { name: 'Merchant Mo' })
      ).toBeInTheDocument();
    });
  });
});
