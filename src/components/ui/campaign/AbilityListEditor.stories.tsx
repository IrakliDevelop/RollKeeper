import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import type { NpcResourceDraft } from '@/utils/npcResources';
import type { NPCInventoryItem, StatBlockEntry } from '@/types/encounter';
import { AbilityListEditor } from './AbilityListEditor';

const VIEWPORTS = {
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
};

const RESOURCES: NpcResourceDraft[] = [
  {
    id: 'res-1',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    maxUses: 2,
    usesExpended: 0,
    shortRestReset: 1,
  },
];

const INVENTORY: NPCInventoryItem[] = [
  { id: 'inv-oil', name: 'Flask of oil', quantity: 3 },
];

const ENTRIES: StatBlockEntry[] = [
  {
    name: 'Multiattack',
    text: '<p>Two claw attacks.</p>',
    resourceCost: { resourceId: 'res-1', amount: 1 },
  },
  { name: 'Oil Flask', text: '<p>Throws a flask of oil.</p>', uses: 3 },
];

const meta: Meta<typeof AbilityListEditor> = {
  title: 'Campaign/AbilityListEditor',
  component: AbilityListEditor,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof AbilityListEditor>;

function Editable({
  section,
  initial,
  withCosts = false,
}: {
  section: 'traits' | 'actions';
  initial: StatBlockEntry[];
  withCosts?: boolean;
}) {
  const [items, setItems] = useState(initial);
  return (
    <AbilityListEditor
      section={section}
      items={items}
      onChange={setItems}
      resources={withCosts ? RESOURCES : undefined}
      inventoryItems={withCosts ? INVENTORY : undefined}
    />
  );
}

export const WithCosts: Story = {
  render: () => <Editable section="actions" initial={ENTRIES} withCosts />,
  play: async ({ canvasElement }) => {
    const region = within(
      await within(canvasElement).findByRole('region', { name: 'Actions' })
    );
    await expect(
      region.getAllByRole('combobox', { name: 'Resource cost' })
    ).toHaveLength(2);
    await expect(
      region.getAllByRole('combobox', { name: 'Inventory cost' })
    ).toHaveLength(2);
    // The icon buttons line up with the top of the inputs, not the helper text.
    const name = region.getAllByRole('textbox', { name: 'Name' })[0];
    const remove = region.getByRole('button', { name: 'Remove Multiattack' });
    await expect(
      Math.abs(
        remove.getBoundingClientRect().top - name.getBoundingClientRect().top
      )
    ).toBeLessThanOrEqual(2);
  },
};

export const Empty: Story = {
  render: () => <Editable section="traits" initial={[]} />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No traits yet.')
    ).toBeVisible();
  },
};

/** Line 1 wraps at 390: the name takes the full row. */
export const Phone: Story = {
  render: () => <Editable section="actions" initial={ENTRIES} />,
  parameters: { viewport: { options: { phone: VIEWPORTS.phone } } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const region = within(
      await within(canvasElement).findByRole('region', { name: 'Actions' })
    );
    const name = region.getAllByRole('textbox', { name: 'Name' })[0];
    const row = name.closest('li') as HTMLElement;
    const style = getComputedStyle(row);
    const content =
      row.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    await expect(
      Math.abs(name.getBoundingClientRect().width - content)
    ).toBeLessThanOrEqual(2);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  },
};
