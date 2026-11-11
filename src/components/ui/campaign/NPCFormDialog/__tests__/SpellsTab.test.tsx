// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NPCFormDialog } from '@/components/ui/campaign/NPCFormDialog';
import type { CampaignNPC } from '@/types/encounter';
import { CASTER_NPC, STAT_BLOCK_NPC } from './npcFormFixtures';

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

afterEach(cleanup);

async function openSpellsTab(editingNpc: CampaignNPC) {
  const user = userEvent.setup();
  render(
    <NPCFormDialog
      open
      onOpenChange={vi.fn()}
      onSave={vi.fn()}
      editingNpc={editingNpc}
    />
  );
  await user.click(screen.getByRole('tab', { name: 'Spells' }));
  return user;
}

describe('form Spells tab', () => {
  it('turns spellcasting on and off with a labelled switch', async () => {
    const user = await openSpellsTab(STAT_BLOCK_NPC);
    const toggle = screen.getByRole('switch', { name: 'Spellcasting' });
    expect(toggle).toHaveAccessibleDescription(
      'Adds a Spells tab to this NPC.'
    );
    expect(screen.queryByLabelText('Caster level')).toBeNull();
    await user.click(toggle);
    expect(screen.getByLabelText('Caster level')).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByLabelText('Caster level')).toBeNull();
  });

  it('works out the attack bonus and save DC and offers them as placeholders', async () => {
    await openSpellsTab(CASTER_NPC);
    expect(
      screen.getByText(
        'Worked out: spell attack +4, spell save DC 12 (Wisdom 14, proficiency bonus +2).'
      )
    ).toBeInTheDocument();
    const attack = screen.getByLabelText('Spell attack bonus');
    const dc = screen.getByLabelText('Spell save DC');
    expect(attack).toHaveDisplayValue('7');
    expect(attack).toHaveAttribute('placeholder', '+4');
    expect(dc).toHaveDisplayValue('');
    expect(dc).toHaveAttribute('placeholder', '12');
    for (const field of [attack, dc]) {
      expect(field).toHaveAccessibleDescription(
        'Leave empty to use the worked-out value.'
      );
    }
  });

  it('labels each slot field and shows the base count as the placeholder', async () => {
    await openSpellsTab(CASTER_NPC);
    const expected: Array<[string, string, string]> = [
      ['Level 1 slots', '2', '4'],
      ['Level 2 slots', '', '3'],
      ['Level 3 slots', '0', '2'],
    ];
    for (const [label, value, placeholder] of expected) {
      const field = screen.getByRole('textbox', { name: label });
      expect(field).toHaveDisplayValue(value);
      expect(field).toHaveAttribute('placeholder', placeholder);
    }
    expect(screen.queryByText(/override/i)).toBeNull();
    expect(
      screen.queryByText('No spell slots at this caster level.')
    ).toBeNull();
  });

  it('groups the tab as slots and spells sections', async () => {
    await openSpellsTab(CASTER_NPC);
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map(heading => heading.textContent);
    expect(headings).toContain('Spell slots at caster level 5');
    expect(headings).toContain('Spells');
    expect(headings).not.toContain('Spellcasting');
    expect(screen.queryByText('Spell list')).toBeNull();
    const spells = within(screen.getByRole('region', { name: 'Spells' }));
    expect(
      spells.getByRole('button', { name: 'Add spell' })
    ).toBeInTheDocument();
  });
});
