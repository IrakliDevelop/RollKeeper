import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useDmStore } from '@/store/dmStore';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import type { SendItemTarget } from '../SendItemDialog';
import { MagicItemLibrarySection } from './MagicItemLibrarySection';

const CODE = 'K7QX2M';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const PLAYERS: SendItemTarget[] = [
  {
    playerId: 'p1',
    playerName: 'Alice',
    characterName: 'Aria',
    characterId: 'c1',
  },
  {
    playerId: 'p2',
    playerName: 'Sam',
    characterName: 'Thorin',
    characterId: 'c2',
  },
];

const template = (
  id: string,
  name: string,
  extra: Partial<CustomMagicItem> = {}
): CustomMagicItem => ({
  id,
  campaignCode: CODE,
  name,
  category: 'wondrous',
  rarity: 'uncommon',
  description: '',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
  isEquipped: false,
  tags: [],
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
  ...extra,
});

// One unbroken word on purpose: the Phone story catches a name that stops wrapping.
const LONG_NAME = 'Bartholomewunderhillgreenbottleofthemistyhollowamulet';

const FIXTURES = [
  template('m1', 'Moonlit Compass', {
    category: 'wondrous',
    rarity: 'uncommon',
    group: 'Feywild rewards',
    tags: ['quest', 'utility'],
  }),
  template('m2', 'Cloak of the Drowned Bell', {
    category: 'wondrous',
    rarity: 'very rare',
  }),
  template('m3', LONG_NAME, { category: 'ring', rarity: 'rare' }),
];

/** Seeds the stores for one story and clears them afterwards. */
const seed = (items: CustomMagicItem[]) => () => {
  useMagicItemLibraryStore.setState({ itemsByCampaign: { [CODE]: items } });
  useNPCStore.setState({ npcsByCampaign: { [CODE]: [] } });
  useDmStore.setState({
    campaigns: [
      {
        code: CODE,
        name: 'The Sunken Bell',
        createdAt: '2026-08-23T00:00:00.000Z',
      },
    ],
  });
  return () => {
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
    useNPCStore.setState({ npcsByCampaign: {} });
    useDmStore.setState({ campaigns: [] });
  };
};

const meta: Meta<typeof MagicItemLibrarySection> = {
  title: 'Campaign/MagicItemLibrarySection',
  component: MagicItemLibrarySection,
  args: {
    campaignCode: CODE,
    players: PLAYERS,
    onGiveToPlayer: fn(async () => {}),
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

// Dialogs render in a portal on document.body, so query the whole document.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

export const Empty: Story = {
  beforeEach: seed([]),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 3, name: 'No magic items yet' })
    ).toBeInTheDocument();
    await expect(
      canvas.getAllByRole('button', { name: 'Create magic item' })
    ).toHaveLength(1);
  },
};

export const List: Story = {
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Very rare wondrous')).toBeInTheDocument();
    await expect(
      canvasElement.querySelectorAll('[data-variant="primary"]')
    ).toHaveLength(0);
  },
};

export const ListDark: Story = {
  ...List,
  globals: { ...List.globals, theme: 'dark' },
  play: async context => {
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
    await List.play?.(context);
  },
};

export const GiveCopy: Story = {
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Give copy' })[0]
    );
    const dialog = await body(canvasElement).findByRole('dialog', {
      name: /^Give a copy of /,
    });
    await expect(
      within(dialog).getByRole('combobox', { name: 'Give to' })
    ).toHaveTextContent('Choose a player or NPC');
  },
};

export const NoRecipients: Story = {
  args: { players: [] },
  beforeEach: seed(FIXTURES),
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Give copy' })[0]
    );
    const dialog = await body(canvasElement).findByRole('dialog', {
      name: /^Give a copy of /,
    });
    await expect(
      within(dialog).getByText('No players or NPCs in this campaign yet.')
    ).toBeInTheDocument();
    await expect(
      within(dialog).getByRole('button', { name: 'Give copy' })
    ).toBeDisabled();
  },
};

/**
 * At 390px with an unbroken name and four row controls, nothing scrolls
 * sideways and every control stays inside the viewport.
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
    const section = canvas
      .getByRole('heading', { level: 2, name: 'Magic items (3)' })
      .closest('section')!;
    await expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
    const name = canvas.getByRole('heading', { level: 3, name: LONG_NAME });
    await expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
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
