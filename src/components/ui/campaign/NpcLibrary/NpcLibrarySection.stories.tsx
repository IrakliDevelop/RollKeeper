import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignInfo } from '@/types/campaign';
import type { CampaignNPC } from '@/types/encounter';
import { NpcLibrarySection } from './NpcLibrarySection';

const CODE = 'K7QX2M';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

// A 1x1 PNG, so the portrait button has an image to show.
const PORTRAIT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const creature = (
  id: string,
  name: string,
  extra: Partial<CampaignNPC> = {}
): CampaignNPC => ({
  id,
  campaignCode: CODE,
  name,
  armorClass: '12',
  maxHp: 11,
  speed: '30 ft.',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
  ...extra,
});

const BRENN = creature('npc-1', 'Brenn Ironhand', {
  description: 'Runs the Rusty Anchor and knows every smuggler on the quay.',
  armorClass: '15',
  tempAc: '2 (shield)',
  maxHp: 44,
  avatarUrl: PORTRAIT,
  monsterStatBlock: { size: 'Medium', type: 'humanoid', cr: '2' },
  spellcasting: { casterLevel: 5 },
  passivePerception: 14,
  passiveInsight: 12,
  passiveInvestigation: 11,
  tags: ['merchant', 'quest'],
} as unknown as Partial<CampaignNPC>);

const MIRA = creature('npc-2', 'Mira Stonehollow', {
  description: 'Keeps the lighthouse.',
  armorClass: '11',
  maxHp: 9,
});

// One unbroken word on purpose: the Phone story catches a name that stops wrapping.
const BARTHOLOMEW = creature('npc-3', 'Bartholomewunderhillgreenbottle', {
  armorClass: '16 (natural armor)',
  maxHp: 27,
  passiveInsight: 13,
  tags: ['merchant', 'informant'],
});

const FIXTURES = [BRENN, MIRA, BARTHOLOMEW];

const GROUPED = [
  creature('g-1', 'Rook', { group: 'Bandits' }),
  creature('g-2', 'Sable', { group: 'Bandits' }),
  creature('g-3', 'Captain Hale', { group: 'Town guard' }),
  creature('g-4', 'Old Tam'),
];

/** Seeds the store for one story and clears it afterwards. */
const seed =
  (npcs: CampaignNPC[], dmDashboardUi?: CampaignInfo['dmDashboardUi']) =>
  () => {
    useNPCStore.setState({ npcsByCampaign: { [CODE]: npcs } });
    useDmStore.setState({
      campaigns: [
        {
          code: CODE,
          name: 'The Sunken Bell',
          createdAt: '2026-08-23T00:00:00.000Z',
          ...(dmDashboardUi ? { dmDashboardUi } : {}),
        },
      ],
    });
    return () => {
      useNPCStore.setState({ npcsByCampaign: {} });
      useDmStore.setState({ campaigns: [] });
    };
  };

const meta: Meta<typeof NpcLibrarySection> = {
  title: 'Campaign/NpcLibrarySection',
  component: NpcLibrarySection,
  args: {
    campaignCode: CODE,
    kind: 'npc',
    showLibraryExtras: false,
    players: [],
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  decorators: [
    Story => (
      <div className="max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  beforeEach: seed([]),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'NPCs' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { level: 3, name: 'No NPCs yet' })
    ).toBeInTheDocument();
    await expect(
      canvas.getAllByRole('button', { name: 'Create NPC' })
    ).toHaveLength(1);
  },
};

export const Flat: Story = {
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'NPCs (3)' })
    ).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: 'View' })).toHaveLength(
      3
    );
    await expect(
      canvas.getByText('AC 15 (+2) · 44 HP · Speed 30 ft.')
    ).toBeInTheDocument();
    await expect(
      canvasElement.querySelectorAll(
        '[class*="accent-"], [data-variant="primary"]'
      )
    ).toHaveLength(0);
  },
};

export const FlatDark: Story = {
  ...Flat,
  globals: { ...Flat.globals, theme: 'dark' },
  play: async context => {
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
    await Flat.play?.(context);
  },
};

export const FlatBlue: Story = {
  ...Flat,
  globals: { ...Flat.globals, theme: 'blue' },
};

export const Grouped: Story = {
  beforeEach: seed(GROUPED),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = canvas.getAllByRole('heading', { level: 3 });
    await expect(groups.map(h => h.textContent)).toEqual([
      'Bandits (2)',
      'Town guard (1)',
      'Ungrouped (1)',
    ]);
    const rows = canvas.getAllByRole('heading', { level: 4 });
    await expect(rows.map(h => h.textContent)).toEqual([
      'Rook',
      'Sable',
      'Captain Hale',
      'Old Tam',
    ]);
  },
};

export const Portraits: Story = {
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portrait = canvas.getByRole('button', {
      name: 'View Brenn Ironhand image full size',
    });
    await expect(portrait.querySelector('img')).toHaveAttribute('alt', '');
  },
};

export const Filtered: Story = {
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('textbox', { name: 'Search NPCs' });
    await userEvent.type(search, 'zzz');
    await expect(
      await canvas.findByText('No NPCs match these filters.')
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Clear filters' })
    );
    await waitFor(() =>
      expect(canvas.getByRole('textbox', { name: 'Search NPCs' })).toHaveFocus()
    );
    const merchant = canvas.getByRole('button', { name: 'merchant' });
    await userEvent.click(merchant);
    await expect(merchant).toHaveAttribute('aria-pressed', 'true');
  },
};

export const ReorderOn: Story = {
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Reorder' }));
    await expect(
      await canvas.findAllByRole('button', { name: 'Move down' })
    ).toHaveLength(3);
    await expect(
      canvas.getAllByRole('button', { name: 'Move up' })[0]
    ).toBeDisabled();
  },
};

/**
 * At 390px with an unbroken name, a portrait, five row controls and Reorder
 * on, nothing scrolls sideways and every control stays inside the viewport.
 */
export const Phone: Story = {
  beforeEach: seed(FIXTURES),
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
    await userEvent.click(canvas.getByRole('button', { name: 'Reorder' }));
    await canvas.findAllByRole('button', { name: 'Move down' });
    const section = canvas
      .getByRole('heading', { level: 2, name: 'NPCs (3)' })
      .closest('section')!;
    await expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth
      );
    }
    await expect(
      canvasElement.ownerDocument.documentElement.scrollWidth
    ).toBeLessThanOrEqual(390);
  },
};
