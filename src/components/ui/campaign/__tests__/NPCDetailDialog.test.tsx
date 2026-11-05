// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';
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
  NPCSpellTab: () => <div data-testid="spell-tab-stub" />,
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

  it('has no Edit or Delete buttons in the header', () => {
    setup(makeNpc(), { onEdit: vi.fn(), onDelete: vi.fn() });
    const header = screen.getByRole('heading', { name: 'Merchant Mo' })
      .parentElement as HTMLElement;
    expect(header.querySelector('button')).toBeNull();
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
});

describe('NPCDetailDialog — Inventory tab', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });
  afterEach(() => {
    cleanup();
  });

  it('opens the shared inventory form from an NPC inventory', () => {
    setup(makeNpc(), { onUpdateInventory: () => {}, initialTab: 'inventory' });

    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    expect(
      screen.getByRole('dialog', { name: 'Add item' })
    ).toBeInTheDocument();
    expect(screen.getByText('Basic information')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
  });
});
