// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NPCFormDialog } from '@/components/ui/campaign/NPCFormDialog';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { CampaignNPC } from '@/types/encounter';
import {
  CASTER_NPC,
  GOBLIN,
  KI,
  QUICK_NPC_BARE,
  QUICK_NPC_WITH_SCORES,
  STAT_BLOCK_NPC,
  withoutMeta,
} from './npcFormFixtures';

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

function renderDialog(editingNpc?: CampaignNPC) {
  const onSave = vi.fn();
  render(
    <NPCFormDialog
      open
      onOpenChange={vi.fn()}
      onSave={onSave}
      editingNpc={editingNpc}
    />
  );
  return onSave;
}

function savedPayload(onSave: ReturnType<typeof vi.fn>) {
  expect(onSave).toHaveBeenCalledTimes(1);
  return onSave.mock.calls[0][0];
}

describe('NPCFormDialog payloads', () => {
  it('blank create saves the default payload', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog();
    await user.type(screen.getByPlaceholderText('NPC name'), 'Brenn');
    await user.click(screen.getByRole('button', { name: 'Create NPC' }));
    expect(savedPayload(onSave)).toMatchSnapshot();
  });

  it('bestiary import saves the imported stat block', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ monsters: [GOBLIN] }))
    );
    const user = userEvent.setup();
    const onSave = renderDialog();
    await user.type(
      screen.getByPlaceholderText('Search bestiary to import...'),
      'gob'
    );
    await user.click(await screen.findByRole('button', { name: /Goblin/ }));
    await user.click(screen.getByRole('button', { name: 'Create NPC' }));
    const payload = savedPayload(onSave);
    expect(payload).toMatchSnapshot();
    expect(payload.passivePerception).toBe(9);
    expect(payload.monsterStatBlock.passivePerception).toBe(9);
    expect(payload.bestiarySourceId).toBe('mon-goblin');
    expect(payload.hitDice).toEqual({ max: 2, current: 2, dieType: 'd6' });
    expect(payload.initiativeModifier).toBe(2);
    expect(payload.proficiencyBonus).toBe(2);
  });

  it('edit with a stat block saves it unchanged', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(STAT_BLOCK_NPC);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(savedPayload(onSave)).toEqual(withoutMeta(STAT_BLOCK_NPC));
  });

  it('edit with spellcasting keeps slot overrides and slots used', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(CASTER_NPC);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(savedPayload(onSave)).toEqual(withoutMeta(CASTER_NPC));
  });

  it('deleting a resource strips its costs', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(STAT_BLOCK_NPC);
    await user.click(screen.getByRole('tab', { name: /Stat Block/ }));
    await user.click(
      screen.getByRole('button', { name: 'Delete resource Ki' })
    );
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    const payload = savedPayload(onSave);
    expect(payload.resources).toBeUndefined();
    expect(payload.monsterStatBlock.actions[0].resourceCost).toBeUndefined();
  });

  it('a bestiary-linked NPC with default fields still saves a stat block', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog({
      ...QUICK_NPC_BARE,
      bestiarySourceId: 'mon-goblin',
    });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    const payload = savedPayload(onSave);
    expect(payload.monsterStatBlock).toBeDefined();
    expect(payload.monsterStatBlock.str).toBe(10);
  });
});

describe('V195: editing an NPC without a stat block', () => {
  // Red on the old component (the edit effect wipes these fields). Task 3 flips
  // each it.fails back to it once the split fixes V195.
  it.fails(
    'keeps resources, hit dice, proficiency and passives when it has ability scores',
    async () => {
      const user = userEvent.setup();
      const onSave = renderDialog(QUICK_NPC_WITH_SCORES);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      const payload = savedPayload(onSave);
      expect(payload.resources).toEqual([KI]);
      expect(payload.hitDice).toEqual({ max: 3, current: 2, dieType: 'd8' });
      expect(payload.proficiencyBonus).toBe(3);
      expect(payload.passivePerception).toBe(14);
      expect(payload.passiveInsight).toBe(10);
      expect(payload.passiveInvestigation).toBe(10);
      expect(payload.monsterStatBlock.wis).toBe(16);
      expect(payload.initiativeModifier).toBe(2);
    }
  );

  it.fails(
    'keeps them when it has neither ability scores nor a stat block',
    async () => {
      const user = userEvent.setup();
      const onSave = renderDialog(QUICK_NPC_BARE);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      const payload = savedPayload(onSave);
      expect(payload.resources).toEqual([KI]);
      expect(payload.hitDice).toEqual({ max: 3, current: 2, dieType: 'd8' });
      expect(payload.proficiencyBonus).toBe(3);
      expect(payload.passivePerception).toBe(14);
      expect(payload.passiveInsight).toBe(10);
      expect(payload.passiveInvestigation).toBe(10);
      expect(payload.monsterStatBlock.wis).toBe(10);
      expect(payload.initiativeModifier).toBe(0);
    }
  );
});
