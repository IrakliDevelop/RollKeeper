import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { CampaignNPC } from '@/types/encounter';
import { NPCFormDialog } from './index';
import {
  CASTER_NPC,
  GOBLIN,
  STAT_BLOCK_FULL_NPC,
  STAT_BLOCK_NPC,
} from './__tests__/npcFormFixtures';

const VIEWPORTS = {
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const EMPTY_ITEMS = { items: [] };

const TWO_ITEMS: CampaignNPC = {
  ...STAT_BLOCK_NPC,
  inventory: [
    {
      id: 'inv-cutlass',
      name: 'Harbour Cutlass',
      quantity: 1,
      type: 'weapon',
      rarity: 'uncommon',
      weight: 3,
      value: 2500,
      equipped: true,
    },
    {
      id: 'inv-rope',
      name: 'Hemp rope (50 ft.)',
      quantity: 2,
      type: 'gear',
      weight: 10,
      value: 100,
    },
  ],
};

type Routes = Record<string, unknown>;

/**
 * Replaces window.fetch for one story and returns the restore function.
 * A path with no stub falls through to the real fetch.
 */
const stubFetch = (routes: Routes) => () => {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      window.location.href
    );
    if (url.pathname in routes) {
      return new Response(JSON.stringify(routes[url.pathname]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input, init);
  };
  return () => {
    window.fetch = original;
  };
};

const INVENTORY_ROUTES: Routes = {
  '/api/items': EMPTY_ITEMS,
  '/api/magic-items': EMPTY_ITEMS,
};

const meta: Meta<typeof NPCFormDialog> = {
  title: 'Campaign/NPCFormDialog',
  component: NPCFormDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onSave: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
  },
  globals: { viewport: { value: 'landscape', isRotated: false } },
};

export default meta;
type Story = StoryObj<typeof meta>;

// The dialog and the confirm both render in portals on document.body.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

/** The open form, once its fade-in has finished (opacity counts as hidden). */
async function openDialog(canvasElement: HTMLElement) {
  const dialog = await body(canvasElement).findByRole('dialog');
  await waitFor(() => expect(dialog).toBeVisible());
  return dialog;
}

export const CreateNpc: Story = {
  beforeEach: stubFetch({
    '/api/bestiary/search': { monsters: [GOBLIN], total: 1, hasMore: false },
  }),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    await expect(
      form.getByRole('button', { name: 'Create NPC' })
    ).toBeVisible();
    await userEvent.type(
      form.getByRole('textbox', { name: 'Search the bestiary' }),
      'gob'
    );
    await userEvent.click(
      await form.findByRole('button', { name: /Goblin/ }, { timeout: 3000 })
    );
    await waitFor(() => {
      expect(form.getByRole('combobox', { name: 'Size' })).toHaveTextContent(
        'Small'
      );
      expect(form.getByRole('combobox', { name: 'Type' })).toHaveTextContent(
        'Humanoid'
      );
    });
    await expect(form.getByText('Imported from Goblin')).toBeVisible();
  },
};

export const CreateCustomMonster: Story = {
  args: { kind: 'monster' },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    await expect(
      form.getByRole('tablist', { name: 'Custom monster form' })
    ).toBeVisible();
    await expect(form.getByPlaceholderText('Dire wolf')).toBeVisible();
    await expect(
      form.getByRole('button', { name: 'Create custom monster' })
    ).toBeVisible();
  },
};

export const EditWithStatBlock: Story = {
  args: { editingNpc: STAT_BLOCK_NPC },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    await expect(form.getByPlaceholderText('Brenn Ironhand')).toHaveValue(
      'Brother Oren'
    );
    await expect(
      form.getByRole('button', { name: 'Save changes' })
    ).toBeEnabled();
    await userEvent.click(form.getByRole('tab', { name: 'Stat block' }));
    await expect(form.getByRole('tab', { name: 'Stat block' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(await form.findByDisplayValue('Evasion')).toBeVisible();
  },
};

export const EditCaster: Story = {
  args: { editingNpc: CASTER_NPC },
  beforeEach: stubFetch({ '/api/spells': { spells: [] } }),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    await userEvent.click(form.getByRole('tab', { name: 'Spells' }));
    await expect(form.getByRole('tab', { name: 'Spells' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(await form.findByText('Bless')).toBeVisible();
  },
};

export const SaveDisabledReason: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    await expect(form.getByText('Add a name to save.')).toBeVisible();
    await expect(
      form.getByRole('button', { name: 'Create NPC' })
    ).toBeDisabled();
  },
};

export const DiscardConfirm: Story = {
  args: { editingNpc: STAT_BLOCK_NPC },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.type(
      within(dialog).getByPlaceholderText('Brenn Ironhand'),
      ' the Elder'
    );
    await userEvent.keyboard('{Escape}');
    const alert = await body(canvasElement).findByRole('alertdialog', {
      name: 'Discard changes to Brother Oren?',
    });
    await userEvent.click(
      within(alert).getByRole('button', { name: 'Keep editing' })
    );
    await waitFor(() =>
      expect(body(canvasElement).queryByRole('alertdialog')).toBeNull()
    );
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true)
    );
    await expect(
      within(dialog).getByPlaceholderText('Brenn Ironhand')
    ).toHaveValue('Brother Oren the Elder');
  },
};

export const Inventory: Story = {
  args: { editingNpc: TWO_ITEMS },
  beforeEach: stubFetch(INVENTORY_ROUTES),
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    await userEvent.click(form.getByRole('tab', { name: 'Inventory' }));
    await expect(
      await form.findByDisplayValue('Harbour Cutlass')
    ).toBeVisible();
    await expect(form.getByDisplayValue('Hemp rope (50 ft.)')).toBeVisible();
    await expect(
      form.getByRole('checkbox', { name: 'Equipped: Harbour Cutlass' })
    ).toBeChecked();
    await expect(
      form.getByRole('checkbox', { name: 'Equipped: Hemp rope (50 ft.)' })
    ).not.toBeChecked();
  },
};

/** Five tabs overflow the list at 390; Lore is reachable by click. */
export const Phone: Story = {
  args: { editingNpc: TWO_ITEMS },
  beforeEach: stubFetch(INVENTORY_ROUTES),
  parameters: { viewport: { options: { phone: VIEWPORTS.phone } } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const form = within(dialog);
    const tablist = form.getByRole('tablist', { name: 'NPC form' });
    await expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);
    // The tab list keeps its labels whole.
    // The 1px is the active tab's border, which overlaps the list's rule.
    await expect(tablist.clientHeight + 1).toBeGreaterThanOrEqual(
      tablist.scrollHeight
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);

    const lore = form.getByRole('tab', { name: 'Lore' });
    await userEvent.click(lore);
    await waitFor(() => expect(lore).toHaveAttribute('aria-selected', 'true'));
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  },
};

const STAT_BLOCK_HEADINGS = [
  'Ability scores',
  'Challenge',
  'Passive scores',
  'Hit dice',
  'Defenses and senses',
  'Conditions it inflicts',
  'Class resources',
  'Traits',
  'Actions',
  'Bonus actions',
  'Reactions',
  'Lair actions',
];

async function openStatBlockTab(canvasElement: HTMLElement) {
  const dialog = await openDialog(canvasElement);
  const form = within(dialog);
  await userEvent.click(form.getByRole('tab', { name: 'Stat block' }));
  await waitFor(() =>
    expect(form.getByRole('tab', { name: 'Stat block' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  );
  return { dialog, form };
}

export const StatBlockEmpty: Story = {
  play: async ({ canvasElement }) => {
    const { form } = await openStatBlockTab(canvasElement);
    for (const name of STAT_BLOCK_HEADINGS) {
      await expect(
        await form.findByRole('heading', { level: 3, name })
      ).toBeVisible();
    }
    await expect(form.getByText('No traits yet.')).toBeVisible();
  },
};

export const StatBlockFull: Story = {
  args: { editingNpc: STAT_BLOCK_FULL_NPC },
  beforeEach: stubFetch(INVENTORY_ROUTES),
  play: async ({ canvasElement }) => {
    const { form } = await openStatBlockTab(canvasElement);
    await expect((await form.findAllByText('Resource cost'))[0]).toBeVisible();
    const beadToss = form.getByDisplayValue('Bead Toss');
    await expect(beadToss).toBeVisible();
    const entryRow = beadToss.closest('li') as HTMLElement;
    await expect(
      within(entryRow).getByRole('combobox', { name: 'Inventory cost' })
    ).toHaveTextContent('Prayer beads');
    await expect(
      form.getByText('Disadvantage on attack rolls while it can see Oren.')
    ).toBeVisible();
    await expect(form.getByText('Debuff')).toBeVisible();
  },
};

export const StatBlockCreateCondition: Story = {
  args: { editingNpc: STAT_BLOCK_FULL_NPC },
  beforeEach: stubFetch(INVENTORY_ROUTES),
  play: async ({ canvasElement }) => {
    const { dialog, form } = await openStatBlockTab(canvasElement);
    await userEvent.click(
      await form.findByRole('combobox', { name: 'Add inflicted condition' })
    );
    await userEvent.click(
      await body(canvasElement).findByRole('option', {
        name: 'New condition…',
      })
    );
    await expect(
      await form.findByRole('button', { name: 'Create and add' })
    ).toBeVisible();
    // The panel's button is secondary, so Save stays the only primary.
    await expect(
      dialog.querySelectorAll('[data-variant="primary"]')
    ).toHaveLength(1);
  },
};

/** The 390 layout: three score columns, a wrapped picker, no sideways scroll. */
export const StatBlockPhone: Story = {
  args: { editingNpc: STAT_BLOCK_FULL_NPC },
  beforeEach: stubFetch(INVENTORY_ROUTES),
  parameters: { viewport: { options: { phone: VIEWPORTS.phone } } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const { form } = await openStatBlockTab(canvasElement);
    const top = (el: HTMLElement) => el.getBoundingClientRect().top;
    const scores = (
      await Promise.all(
        ['Strength', 'Dexterity', 'Constitution', 'Intelligence'].map(name =>
          form.findByLabelText(name)
        )
      )
    ).map(top);
    await expect(scores[1]).toBe(scores[0]);
    await expect(scores[2]).toBe(scores[0]);
    await expect(scores[3]).toBeGreaterThan(scores[0]);

    const panel = form.getByRole('tabpanel');
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);

    const heading = form.getByRole('heading', {
      level: 3,
      name: 'Conditions it inflicts',
    });
    const trigger = form.getByRole('combobox', {
      name: 'Add inflicted condition',
    });
    await expect(trigger.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      heading.getBoundingClientRect().bottom
    );
  },
};
