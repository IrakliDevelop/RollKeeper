// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NPCFormDialog } from '@/components/ui/campaign/NPCFormDialog';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { CampaignNPC } from '@/types/encounter';
import { CASTER_NPC } from './npcFormFixtures';

const emptyData = {
  items: [],
  loading: false,
  error: null,
  getItemById: () => undefined,
  getItemByName: () => undefined,
};
vi.mock('@/hooks/useItemsData', () => ({ useItemsData: () => emptyData }));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => emptyData,
}));
vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({
    spells: [],
    loading: false,
    error: null,
    searchResults: () => [],
    getSpellById: () => undefined,
    getSpellByName: () => undefined,
  }),
}));
vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ conditions: [], loading: false }),
}));

beforeEach(() => {
  useEncounterStore.setState({ combatConfig: { ...DEFAULT_COMBAT_CONFIG } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TABS = ['Basic', 'Stat Block', 'Inventory', 'Spells', 'Lore'] as const;

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Ids and id references (`id`, `for`, `aria-controls`, `aria-labelledby`,
 * `aria-describedby`) are left out on purpose: `useId` values change when JSX
 * moves into a child component.
 */
function describeControl(el: Element): string {
  const field = el as HTMLInputElement;
  const isToggle = field.type === 'checkbox' || field.type === 'radio';
  const parts = [
    el.tagName.toLowerCase(),
    el.getAttribute('type'),
    el.getAttribute('role'),
    el.getAttribute('aria-label'),
    collapse(field.labels?.[0]?.textContent),
    el.getAttribute('placeholder'),
    'value' in field ? field.value : '',
    isToggle && field.checked ? 'checked' : '',
    field.disabled ? 'disabled' : '',
    el.getAttribute('aria-selected'),
  ];
  return parts.filter(part => part).join('|');
}

function describeDialog(dialog: HTMLElement): {
  title: string;
  tabs: string[];
  text: string;
  controls: string[];
} {
  return {
    title: collapse(dialog.querySelector('h1, h2, h3')?.textContent),
    tabs: Array.from(dialog.querySelectorAll('[role=tab]')).map(
      tab => `${collapse(tab.textContent)}|${tab.getAttribute('aria-selected')}`
    ),
    text: collapse(dialog.textContent),
    controls: Array.from(
      dialog.querySelectorAll('input, textarea, button, select, [role]')
    ).map(describeControl),
  };
}

interface ParityCase {
  name: string;
  tab: (typeof TABS)[number];
  editingNpc?: CampaignNPC;
  entityLabel?: 'NPC' | 'Custom Monster';
}

const CASES: ParityCase[] = [
  ...TABS.map(tab => ({ name: `create-npc / ${tab}`, tab })),
  ...TABS.map(tab => ({
    name: `edit-caster / ${tab}`,
    tab,
    editingNpc: CASTER_NPC,
  })),
  {
    name: 'create-monster / Basic',
    tab: 'Basic' as const,
    entityLabel: 'Custom Monster' as const,
  },
];

describe('NPCFormDialog DOM parity', () => {
  it.each(CASES)('$name', async ({ tab, editingNpc, entityLabel }) => {
    const user = userEvent.setup();
    render(
      <NPCFormDialog
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        editingNpc={editingNpc}
        entityLabel={entityLabel}
      />
    );
    await user.click(screen.getByRole('tab', { name: tab }));
    expect(describeDialog(screen.getByRole('dialog'))).toMatchSnapshot();
  });
});
