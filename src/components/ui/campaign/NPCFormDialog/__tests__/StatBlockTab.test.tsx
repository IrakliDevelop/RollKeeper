// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NPCFormDialog } from '@/components/ui/campaign/NPCFormDialog';
import { abilityMod } from '../npcFormDraft';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { CampaignNPC } from '@/types/encounter';
import { STAT_BLOCK_NPC } from './npcFormFixtures';

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

async function openStatBlock(editingNpc?: CampaignNPC) {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <NPCFormDialog
      open
      onOpenChange={vi.fn()}
      onSave={onSave}
      editingNpc={editingNpc}
    />
  );
  return { user, onSave };
}

async function showStatBlock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Stat block' }));
  return screen.getByRole('tabpanel');
}

describe('Stat block tab sections', () => {
  it('section order', async () => {
    const { user } = await openStatBlock();
    const panel = await showStatBlock(user);
    const headings = Array.from(panel.querySelectorAll('h3')).map(
      h => h.textContent
    );
    expect(headings).toEqual([
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
    ]);
  });

  it('ability fields are labelled with full names and show the modifier', async () => {
    const { user } = await openStatBlock(STAT_BLOCK_NPC);
    await showStatBlock(user);
    for (const name of [
      'Strength',
      'Dexterity',
      'Constitution',
      'Intelligence',
      'Wisdom',
      'Charisma',
    ]) {
      expect(screen.getByRole('textbox', { name })).toBeTruthy();
    }
    expect(
      screen.getByRole('textbox', { name: 'Dexterity' })
    ).toHaveAccessibleDescription(
      abilityMod(STAT_BLOCK_NPC.monsterStatBlock!.dex)
    );
  });

  it('proficiency bonus helper', async () => {
    const { user } = await openStatBlock();
    const panel = await showStatBlock(user);
    expect(
      screen.getByRole('textbox', { name: 'Proficiency bonus' })
    ).toHaveAccessibleDescription('Starts from CR.');
    expect(panel.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('passives', async () => {
    const { user, onSave } = await openStatBlock();
    await user.type(screen.getByPlaceholderText('Brenn Ironhand'), 'Brenn');
    const panel = await showStatBlock(user);
    expect(
      within(panel).getByText(
        'Worked out from Wisdom and Intelligence. Change one to set all three by hand.'
      )
    ).toBeTruthy();
    expect(screen.getByLabelText('Passive Insight')).toBeTruthy();
    expect(screen.getByLabelText('Passive Investigation')).toBeTruthy();
    const perception = screen.getByLabelText('Passive Perception');
    await user.clear(perception);
    await user.type(perception, '17');
    const wisdom = screen.getByRole('textbox', { name: 'Wisdom' });
    await user.clear(wisdom);
    await user.type(wisdom, '20');
    await user.click(screen.getByRole('button', { name: 'Create NPC' }));
    const payload = onSave.mock.calls[0][0];
    expect(payload.passivePerception).toBe(17);
    expect(payload.passiveInsight).toBe(10);
    expect(payload.passiveInvestigation).toBe(10);
  });

  it('hit dice names', async () => {
    const { user } = await openStatBlock();
    await showStatBlock(user);
    expect(screen.getByLabelText('Hit dice total')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Hit die' })).toBeTruthy();
    expect(screen.getByLabelText('Hit dice remaining')).toBeTruthy();
  });

  it('deleting a resource clears its cost', async () => {
    const { user } = await openStatBlock(STAT_BLOCK_NPC);
    await showStatBlock(user);
    const actions = within(screen.getByRole('region', { name: 'Actions' }));
    expect(
      actions.getByRole('combobox', { name: 'Resource cost' })
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Delete resource Ki' })
    );
    expect(
      actions.queryByRole('combobox', { name: 'Resource cost' })
    ).toBeNull();
    expect(actions.queryByRole('textbox', { name: 'Uses spent' })).toBeNull();
  });

  it('no uppercase', async () => {
    const { user } = await openStatBlock(STAT_BLOCK_NPC);
    const panel = await showStatBlock(user);
    expect(panel.querySelectorAll('.uppercase')).toHaveLength(0);
  });
});
