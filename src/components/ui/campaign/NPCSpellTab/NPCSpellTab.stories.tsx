import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';
import { SPELLCASTER_NPC } from '../NPCFormDialog/__tests__/npcFormFixtures';
import { NPCSpellTab } from './index';

const CODE = SPELLCASTER_NPC.campaignCode;
const STAMP = '2026-01-01T00:00:00.000Z';

const PHONE = {
  name: 'Phone',
  styles: { width: '390px', height: '844px' },
  type: 'mobile',
} as const;

const EMPTY_CASTER: CampaignNPC = {
  ...SPELLCASTER_NPC,
  spellcasting: {
    ...SPELLCASTER_NPC.spellcasting!,
    casterLevel: 1,
    slotOverrides: { 1: 0 },
    spells: [],
  },
};

const campaignOf = (tracker: boolean) => ({
  code: CODE,
  name: 'Table',
  createdAt: STAMP,
  ...(tracker && {
    dmDashboardUi: {
      npcInlineSpellSlots: false,
      npcSeparateSpellSlotTracker: true,
    },
  }),
});

/**
 * Seeds the stores for one story and clears them afterwards. The spell
 * lookup the tab starts is answered with an empty list.
 */
const seed =
  (npc: CampaignNPC, tracker = false) =>
  () => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : 'url' in input
            ? input.url
            : input.href;
      if (new URL(url, window.location.href).pathname === '/api/spells') {
        return new Response(JSON.stringify({ spells: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return original(input, init);
    };
    useNPCStore.setState({ npcsByCampaign: { [CODE]: [npc] } });
    useDmStore.setState({ campaigns: [campaignOf(tracker)] });
    return () => {
      window.fetch = original;
      useNPCStore.setState({ npcsByCampaign: {} });
      useDmStore.setState({ campaigns: [] });
    };
  };

/** Reads the NPC from the store so slot and spell edits show at once. */
function Harness({ npcId, readOnly }: { npcId: string; readOnly?: boolean }) {
  const npc = useNPCStore(state =>
    state.npcsByCampaign[CODE]?.find(entry => entry.id === npcId)
  );
  if (!npc) return null;
  return (
    <div className="bg-surface max-w-2xl p-4">
      <NPCSpellTab npc={npc} campaignCode={CODE} readOnly={readOnly} />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Campaign/NPCSpellTab',
  component: Harness,
  args: { npcId: SPELLCASTER_NPC.id },
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  beforeEach: seed(SPELLCASTER_NPC),
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement);
    const summary = await tab.findByText(/^Caster level/, { selector: 'p' });
    await expect(summary).toHaveTextContent(
      'Caster level 5 · Wisdom · Spell attack +7 · Spell save DC 15'
    );
    await expect(
      tab.getAllByRole('button', { name: 'Spend a level 1 slot' })[0]
    ).toBeVisible();
  },
};

export const Tracker: Story = {
  beforeEach: seed(SPELLCASTER_NPC, true),
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement);
    await expect(
      await tab.findByRole('heading', { level: 3, name: 'Spell slots' })
    ).toBeVisible();
  },
};

export const FiltersAndTags: Story = {
  beforeEach: seed(SPELLCASTER_NPC),
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement);
    const type = await tab.findByRole('group', { name: 'Type' });
    const tags = tab.getByRole('group', { name: 'Tags' });
    // Every type starts on; no tag does.
    for (const button of within(type).getAllByRole('button')) {
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    for (const button of within(tags).getAllByRole('button')) {
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    const control = within(tags).getByRole('button', { name: 'control' });
    await userEvent.click(control);
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(
      tab.getByRole('button', { name: 'Cast Hold Person' })
    ).toBeVisible();
    await expect(tab.queryByRole('button', { name: 'Cast Fly' })).toBeNull();
    await expect(
      within(tags).getByRole('button', { name: 'Clear tags' })
    ).toBeVisible();
  },
};

export const Empty: Story = {
  args: { npcId: EMPTY_CASTER.id },
  beforeEach: seed(EMPTY_CASTER),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No spells yet.')
    ).toBeVisible();
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true },
  beforeEach: seed(SPELLCASTER_NPC),
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement);
    await expect(
      await tab.findByRole('button', { name: 'Cast Hold Person' })
    ).toBeVisible();
    await expect(tab.queryByRole('button', { name: /^Edit / })).toBeNull();
    await expect(tab.queryByRole('button', { name: /^Remove / })).toBeNull();
    await expect(
      tab.getByRole('button', { name: 'Reset slots' })
    ).toBeVisible();
  },
};

/** At 390 the row's buttons stay inside the row and the page does not widen. */
export const Phone: Story = {
  beforeEach: seed(SPELLCASTER_NPC),
  parameters: { viewport: { options: { phone: PHONE } } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement);
    const remove = (await tab.findAllByRole('button', { name: /^Remove / }))[0];
    const row = remove.closest('li') as HTMLElement;
    await waitFor(() =>
      expect(remove.getBoundingClientRect().right).toBeLessThanOrEqual(
        row.getBoundingClientRect().right
      )
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  },
};
