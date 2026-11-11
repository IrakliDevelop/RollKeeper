// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CREATURE_TYPES, SIZES } from '@/types/bestiary';
import type { CampaignCreatureKind, NPCInventoryItem } from '@/types/encounter';
import { DetailsTab } from '../DetailsTab';
import { InventoryTab } from '../InventoryTab';
import { LoreTab } from '../LoreTab';
import { NpcFormInventoryRow } from '../NpcFormInventoryRow';
import {
  deriveAutoFields,
  emptyDraft,
  type NpcFormDraft,
  type NpcFormUpdate,
} from '../npcFormDraft';
import type { usePortraitUpload } from '../usePortraitUpload';

// The item databases are fetched on mount; they are irrelevant here.
vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({
    items: [],
    loading: false,
    error: null,
    getItemById: () => undefined,
    getItemByName: () => undefined,
  }),
}));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({
    items: [],
    loading: false,
    error: null,
    getItemById: () => undefined,
    getItemByName: () => undefined,
  }),
}));

// Radix Select needs these in jsdom.
const proto = Element.prototype as unknown as Record<string, unknown>;
const stubbed = [
  'hasPointerCapture',
  'setPointerCapture',
  'releasePointerCapture',
  'scrollIntoView',
] as const;
const originals = new Map<string, unknown>();
beforeAll(() => {
  for (const name of stubbed) originals.set(name, proto[name]);
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
});
afterAll(() => {
  for (const name of stubbed) {
    if (originals.get(name) === undefined) delete proto[name];
    else proto[name] = originals.get(name);
  }
});

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify({ monsters: [] }))
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubPortrait(): ReturnType<typeof usePortraitUpload> {
  return {
    upload: vi.fn(),
    remove: vi.fn(),
    uploading: false,
    error: null,
  } as unknown as ReturnType<typeof usePortraitUpload>;
}

/** Holds a draft in state and applies `update` the way the form does. */
function useHarnessDraft(initial: Partial<NpcFormDraft>) {
  const [draft, setDraft] = useState<NpcFormDraft>({
    ...emptyDraft(),
    ...initial,
  });
  const update: NpcFormUpdate = patch =>
    setDraft(d => ({
      ...d,
      ...(typeof patch === 'function' ? patch(d) : patch),
    }));
  return { draft, update };
}

function DetailsHarness({
  kind = 'npc',
  isEdit = false,
  initial = {},
  existingGroups = [],
  onDraft,
}: {
  kind?: CampaignCreatureKind;
  isEdit?: boolean;
  initial?: Partial<NpcFormDraft>;
  existingGroups?: string[];
  onDraft?: (draft: NpcFormDraft) => void;
}) {
  const { draft, update } = useHarnessDraft(initial);
  onDraft?.(draft);
  return (
    <DetailsTab
      kind={kind}
      isEdit={isEdit}
      draft={draft}
      update={update}
      derived={deriveAutoFields(draft)}
      existingGroups={existingGroups}
      portrait={stubPortrait()}
      onImport={vi.fn()}
      onClearImport={vi.fn()}
      onAddTag={vi.fn()}
      onRemoveTag={vi.fn()}
      onRemoveLastTag={vi.fn()}
    />
  );
}

async function openOptions(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: label }));
  return screen
    .getAllByRole('option')
    .map(option => option.textContent?.trim() ?? '');
}

describe('DetailsTab', () => {
  it('uses a kind-specific name placeholder and does not autofocus', () => {
    const { unmount } = render(<DetailsHarness kind="npc" />);
    const name = screen.getByRole('textbox', { name: /^Name/ });
    expect(name).toHaveAttribute('placeholder', 'Brenn Ironhand');
    expect(name).not.toHaveFocus();
    expect(document.activeElement).not.toBe(name);
    unmount();
    render(<DetailsHarness kind="monster" />);
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute(
      'placeholder',
      'Dire wolf'
    );
  });

  it('describes the description field', () => {
    render(<DetailsHarness />);
    const description = screen.getByRole('textbox', { name: 'Description' });
    expect(description).toHaveAttribute(
      'placeholder',
      'Gruff smith who owes the guild money'
    );
    expect(description).toHaveAccessibleDescription('Players never see this.');
  });

  it('shows the bestiary import only when creating', () => {
    const { unmount } = render(<DetailsHarness isEdit={false} />);
    expect(
      screen.getByRole('heading', { name: 'Import from the bestiary' })
    ).toBeTruthy();
    unmount();
    render(<DetailsHarness isEdit />);
    expect(
      screen.queryByRole('heading', { name: 'Import from the bestiary' })
    ).toBeNull();
  });

  it('hides the imported-from line once the import is cleared', () => {
    render(
      <DetailsHarness
        initial={{ bestiarySourceId: null, bestiarySourceName: 'Goblin' }}
      />
    );
    expect(screen.queryByText('Imported from Goblin')).toBeNull();
  });

  it('groups fields under Library and Combat headings', () => {
    render(<DetailsHarness />);
    expect(
      screen.getByRole('heading', { name: 'Library', level: 3 })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Combat', level: 3 })
    ).toBeTruthy();
  });

  it('wires Group to a datalist of existing groups', () => {
    const { container } = render(
      <DetailsHarness existingGroups={['Bandits', 'Town Guard']} />
    );
    const group = screen.getByRole('combobox', { name: 'Group' });
    expect(group).toHaveAttribute('placeholder', 'Bandits');
    expect(group).toHaveAccessibleDescription(
      'Shown as a heading in the library.'
    );
    const list = container.querySelector(
      `datalist#${group.getAttribute('list')}`
    );
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll('option')).toHaveLength(2);
  });

  it('renders no datalist without existing groups', () => {
    const { container } = render(<DetailsHarness />);
    expect(container.querySelector('datalist')).toBeNull();
  });

  it.each([
    ['HP formula', undefined],
    ['Temporary HP', 'Damage comes off these first.'],
    ['Temporary AC bonus', 'Added to AC. Put the source after the number.'],
    ['Initiative modifier', 'Starts from Dexterity.'],
    ['XP', 'Awarded when the party defeats them.'],
  ])('labels %s', (label, helper) => {
    render(<DetailsHarness />);
    const field = screen.getByRole('textbox', { name: label });
    if (helper) expect(field).toHaveAccessibleDescription(helper);
  });

  it('has no title attributes', () => {
    const { container } = render(<DetailsHarness />);
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('keeps the number fallbacks', async () => {
    const user = userEvent.setup();
    let latest = emptyDraft();
    render(<DetailsHarness onDraft={d => (latest = d)} />);
    await user.clear(screen.getByRole('textbox', { name: 'HP' }));
    await user.tab();
    expect(latest.hp).toBe(1);
    await user.clear(screen.getByRole('textbox', { name: 'XP' }));
    await user.tab();
    expect(latest.xp).toBe(0);
    await user.clear(
      screen.getByRole('textbox', { name: 'Initiative modifier' })
    );
    await user.tab();
    expect(latest.initiativeOverride).toBe(0);
  });

  it('lists the standard sizes, then an off-list size last', async () => {
    render(<DetailsHarness initial={{ size: 'Colossal' }} />);
    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveTextContent(
      'Colossal'
    );
    expect(await openOptions('Size')).toEqual([...SIZES, 'Colossal']);
  });

  it('adds no extra size when the size is standard', async () => {
    render(<DetailsHarness initial={{ size: 'Small' }} />);
    expect(await openOptions('Size')).toEqual(SIZES);
  });

  it('lists the standard types, then an off-list type last', async () => {
    render(<DetailsHarness initial={{ creatureType: 'swarm' }} />);
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent(
      'swarm'
    );
    expect(await openOptions('Type')).toEqual([...CREATURE_TYPES, 'swarm']);
  });

  it('adds no extra type when the type is standard', async () => {
    render(<DetailsHarness initial={{ creatureType: 'Beast' }} />);
    expect(await openOptions('Type')).toEqual(CREATURE_TYPES);
  });
});

function InventoryHarness({
  items = [],
  onEditItem = vi.fn(),
}: {
  items?: NPCInventoryItem[];
  onEditItem?: (id: string) => void;
}) {
  const { draft, update } = useHarnessDraft({ inventoryItems: items });
  return (
    <>
      <InventoryTab draft={draft} update={update} onEditItem={onEditItem} />
      <output data-testid="items">
        {JSON.stringify(draft.inventoryItems)}
      </output>
    </>
  );
}

function storedItems(): NPCInventoryItem[] {
  return JSON.parse(screen.getByTestId('items').textContent ?? '[]');
}

const rope: NPCInventoryItem = { id: 'a', name: 'Rope', quantity: 2 };
const lamp: NPCInventoryItem = { id: 'b', name: 'Lamp', quantity: 1 };

describe('InventoryTab', () => {
  it('shows the empty state and the database search', () => {
    render(<InventoryHarness />);
    expect(screen.getByText('No items yet.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Potion of healing')).toBeTruthy();
  });

  it('hides the empty state once there is an item', () => {
    render(<InventoryHarness items={[rope]} />);
    expect(screen.queryByText('No items yet.')).toBeNull();
  });

  it('adds a custom item and focuses its name', async () => {
    const user = userEvent.setup();
    render(<InventoryHarness />);
    await user.click(screen.getByRole('button', { name: 'Add custom item' }));
    const name = screen.getByRole('textbox', { name: 'Item name' });
    expect(name).toHaveAttribute('placeholder', 'Rope');
    expect(name).toHaveFocus();
    expect(storedItems()).toHaveLength(1);
    expect(storedItems()[0]).toMatchObject({ name: '', quantity: 1 });
  });

  it('focuses the next row after removing the first of two', async () => {
    const user = userEvent.setup();
    render(<InventoryHarness items={[rope, lamp]} />);
    await user.click(screen.getByRole('button', { name: 'Remove Rope' }));
    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue(
      'Lamp'
    );
    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveFocus();
  });

  it('focuses Add custom item after removing the last row', async () => {
    const user = userEvent.setup();
    render(<InventoryHarness items={[rope]} />);
    await user.click(screen.getByRole('button', { name: 'Remove Rope' }));
    expect(
      screen.getByRole('button', { name: 'Add custom item' })
    ).toHaveFocus();
  });

  it('keys rows by item, not position', async () => {
    const user = userEvent.setup();
    render(<InventoryHarness items={[rope, lamp]} />);
    const [, second] = screen.getAllByRole('textbox', { name: 'Item name' });
    await user.type(second, ' oil');
    await user.click(screen.getByRole('button', { name: 'Remove Rope' }));
    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue(
      'Lamp oil'
    );
  });

  it('passes the item id to onEditItem', async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(<InventoryHarness items={[rope]} onEditItem={onEditItem} />);
    await user.click(screen.getByRole('button', { name: 'Edit Rope' }));
    expect(onEditItem).toHaveBeenCalledWith('a');
  });
});

function renderRow(item: NPCInventoryItem) {
  const handlers = {
    onChange: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <ul>
      <NpcFormInventoryRow item={item} {...handlers} />
    </ul>
  );
  return handlers;
}

describe('NpcFormInventoryRow', () => {
  it('names each control after the item', () => {
    renderRow({ id: 'a', name: 'Rope', quantity: 2 });
    expect(screen.getByRole('textbox', { name: 'Quantity: Rope' })).toHaveValue(
      '2'
    );
    expect(screen.getByRole('button', { name: 'Edit Rope' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Rope' })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Equipped: Rope' })
    ).toBeTruthy();
    expect(screen.getByRole('listitem').querySelector('[title]')).toBeNull();
  });

  it('calls a blank-named item "unnamed item"', () => {
    renderRow({ id: 'a', name: '  ', quantity: 1 });
    expect(
      screen.getByRole('textbox', { name: 'Quantity: unnamed item' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit unnamed item' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove unnamed item' })
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Equipped: unnamed item' })
    ).toBeTruthy();
  });

  it('shows rarity, type, weight and value on the meta line', () => {
    renderRow({
      id: 'a',
      name: 'Rope',
      quantity: 1,
      rarity: 'uncommon',
      type: 'wondrous',
      weight: 10,
      value: 100,
    });
    expect(screen.getByText('Uncommon · Wondrous · 10 lb · 1 gp')).toBeTruthy();
  });

  it('shows no meta line for a bare item', () => {
    renderRow({ id: 'a', name: 'Rope', quantity: 1 });
    const row = screen.getByRole('listitem');
    expect(within(row).queryByText(/ lb|·/)).toBeNull();
  });

  it('edits the name', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ id: 'a', name: 'Rop', quantity: 1 });
    await user.type(screen.getByRole('textbox', { name: 'Item name' }), 'e');
    expect(onChange).toHaveBeenLastCalledWith({
      id: 'a',
      name: 'Rope',
      quantity: 1,
    });
  });

  it('keeps the quantity at 1 or more', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ id: 'a', name: 'Rope', quantity: 3 });
    const quantity = screen.getByRole('textbox', { name: 'Quantity: Rope' });
    await user.clear(quantity);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith({
      id: 'a',
      name: 'Rope',
      quantity: 1,
    });
    await user.clear(quantity);
    await user.type(quantity, '0');
    await user.tab();
    expect(quantity).toHaveValue('1');
  });

  it('toggles equipped', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ id: 'a', name: 'Rope', quantity: 1 });
    await user.click(screen.getByRole('checkbox', { name: 'Equipped: Rope' }));
    expect(onChange).toHaveBeenLastCalledWith({
      id: 'a',
      name: 'Rope',
      quantity: 1,
      equipped: true,
    });
  });

  it('calls onEdit and onRemove', async () => {
    const user = userEvent.setup();
    const { onEdit, onRemove } = renderRow({
      id: 'a',
      name: 'Rope',
      quantity: 1,
    });
    await user.click(screen.getByRole('button', { name: 'Edit Rope' }));
    await user.click(screen.getByRole('button', { name: 'Remove Rope' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('LoreTab', () => {
  it('names the editor, shows the placeholder and the DM-only note', async () => {
    render(<LoreTab loreHtml="" onChange={vi.fn()} />);
    expect(await screen.findByLabelText('Lore')).toBeTruthy();
    expect(screen.getByText('Backstory, motives, secrets')).toBeTruthy();
    expect(screen.getByText('Players never see this.')).toBeTruthy();
  });
});
