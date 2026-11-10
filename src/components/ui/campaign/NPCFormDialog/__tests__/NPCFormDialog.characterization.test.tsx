// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

type User = ReturnType<typeof userEvent.setup>;

async function fillField(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
}

async function fillLabel(user: User, label: string, text: string) {
  await fillField(user, screen.getByLabelText(label), text);
}

async function pickOption(trigger: HTMLElement, option: string | RegExp) {
  await userEvent.setup().click(trigger);
  await waitFor(() => {
    fireEvent.click(screen.getByRole('option', { name: option }));
  });
}

/** Resource and inventory ids are random on create; swap them for stable ones. */
function withStableIds<T extends { resources?: unknown; inventory?: unknown }>(
  payload: T
): T {
  const copy = structuredClone(payload) as {
    resources?: Array<{ id: string }>;
    inventory?: Array<{ id: string }>;
  };
  copy.resources?.forEach((r, i) => (r.id = `res-${i}`));
  copy.inventory?.forEach((item, i) => (item.id = `inv-${i}`));
  return copy as T;
}

describe('NPCFormDialog field wiring', () => {
  it('create with every field filled saves each value in its own key', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog();

    // Basic tab.
    await user.type(screen.getByPlaceholderText('NPC name'), 'Brenn Voss');
    await fillLabel(user, 'Description', 'Gruff caravan guard');
    await user.type(
      screen.getByPlaceholderText('e.g. Bandits, Town Guard'),
      'Caravan Guard'
    );
    await user.type(
      screen.getByPlaceholderText('Add tags (Enter or comma)'),
      'ally{Enter}'
    );
    await pickOption(screen.getByRole('combobox', { name: 'Size' }), 'Large');
    await pickOption(screen.getByRole('combobox', { name: 'Type' }), 'Beast');
    await fillLabel(user, 'Alignment', 'Chaotic Neutral');
    await fillLabel(user, 'AC', '17 (chain mail)');
    await fillLabel(user, 'HP', '41');
    await fillLabel(user, 'HP Formula', '5d8+10');
    await fillLabel(user, 'Temp HP', '6');
    await fillLabel(user, 'Temp AC', '2 (shield)');
    await fillLabel(user, 'Speed', '35 ft., climb 20 ft.');
    await fillLabel(user, 'Init Mod', '7');
    await fillLabel(user, 'XP', '450');

    // Stat Block tab.
    await user.click(screen.getByRole('tab', { name: /Stat Block/ }));
    const scoreInputs = within(
      screen.getByText('Ability Scores').parentElement as HTMLElement
    ).getAllByRole('textbox');
    const scores = ['11', '12', '13', '14', '15', '16'];
    for (const [i, score] of scores.entries()) {
      await fillField(user, scoreInputs[i], score);
    }
    await fillLabel(user, 'Saving Throws', 'Dex +4, Wis +2');
    await fillLabel(user, 'Skills', 'Perception +4');
    await fillLabel(user, 'Resistances', 'fire, cold');
    await fillLabel(user, 'Immunities', 'poison');
    await fillLabel(user, 'Vulnerabilities', 'radiant');
    await fillLabel(user, 'Condition Immunities', 'poisoned, charmed');
    await fillLabel(user, 'Senses', 'Darkvision 60 ft.');
    await fillLabel(user, 'Languages', 'Common, Sylvan');
    await fillLabel(user, 'CR', '3');
    await fillLabel(user, 'Prof Bonus', '5');
    await fillLabel(user, 'Max', '6');
    await pickOption(screen.getByRole('combobox', { name: 'Die Type' }), 'd10');
    await fillLabel(user, 'Current', '4');
    await fillLabel(user, 'Passive Perception', '17');
    await fillLabel(user, 'Passive Insight', '18');
    await fillLabel(user, 'Passive Investigation', '19');

    await user.click(screen.getByRole('button', { name: 'Create NPC' }));
    const payload = savedPayload(onSave);
    expect(payload).toMatchSnapshot();

    expect(payload.name).toBe('Brenn Voss');
    expect(payload.description).toBe('Gruff caravan guard');
    expect(payload.group).toBe('Caravan Guard');
    expect(payload.tags).toEqual(['ally']);
    expect(payload.armorClass).toBe('17 (chain mail)');
    expect(payload.maxHp).toBe(41);
    expect(payload.tempHp).toBe(6);
    expect(payload.tempAc).toBe('2 (shield)');
    expect(payload.speed).toBe('35 ft., climb 20 ft.');
    expect(payload.xp).toBe(450);
    expect(payload.initiativeModifier).toBe(7);
    expect(payload.proficiencyBonus).toBe(5);
    expect(payload.hitDice).toEqual({ max: 6, current: 4, dieType: 'd10' });
    expect(payload.passivePerception).toBe(17);
    expect(payload.passiveInsight).toBe(18);
    expect(payload.passiveInvestigation).toBe(19);
    const sb = payload.monsterStatBlock;
    expect(sb.size).toBe('Large');
    expect(sb.type).toBe('Beast');
    expect(sb.alignment).toBe('Chaotic Neutral');
    expect(sb.hpFormula).toBe('5d8+10');
    expect([sb.str, sb.dex, sb.con, sb.int, sb.wis, sb.cha]).toEqual([
      11, 12, 13, 14, 15, 16,
    ]);
    expect(sb.saves).toBe('Dex +4, Wis +2');
    expect(sb.skills).toBe('Perception +4');
    expect(sb.resistances).toBe('fire, cold');
    expect(sb.immunities).toBe('poison');
    expect(sb.vulnerabilities).toBe('radiant');
    expect(sb.conditionImmunities).toEqual(['poisoned', 'charmed']);
    expect(sb.senses).toBe('Darkvision 60 ft.');
    expect(sb.languages).toBe('Common, Sylvan');
    expect(sb.cr).toBe('3');
    expect(sb.speed).toBe('35 ft., climb 20 ft.');
    expect(sb.passivePerception).toBe(17);
  }, 20_000);

  it('create with list entries saves them', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog();
    await user.type(screen.getByPlaceholderText('NPC name'), 'Sister Vale');

    // Stat Block tab: one custom resource, one trait, one action.
    await user.click(screen.getByRole('tab', { name: /Stat Block/ }));
    await pickOption(
      screen.getByRole('combobox', { name: 'Add resource…' }),
      'Custom resource…'
    );
    await fillField(
      user,
      screen.getByRole('textbox', { name: 'Resource name' }),
      'Channel Divinity'
    );
    await fillField(
      user,
      screen.getByRole('textbox', { name: 'Resource max uses' }),
      '2'
    );
    const addFor = (label: string) =>
      within(screen.getByText(label).parentElement as HTMLElement).getByRole(
        'button',
        { name: 'Add' }
      );
    await user.click(addFor('Traits'));
    await user.type(screen.getByPlaceholderText('Trait name'), 'Keen Smell');
    await user.click(addFor('Actions'));
    await user.type(screen.getByPlaceholderText('Action name'), 'Mace Strike');
    await user.click(addFor('Bonus Actions'));
    await user.type(
      screen.getByPlaceholderText('Bonus Action name'),
      'Healing Word'
    );
    await user.click(addFor('Reactions'));
    await user.type(screen.getByPlaceholderText('Reaction name'), 'Parry');
    await user.click(addFor('Lair Actions'));
    await user.type(screen.getByPlaceholderText('Lair Action name'), 'Tremor');
    const usesInputs = screen.getAllByPlaceholderText('Uses');
    await fillField(user, usesInputs[0], '2');
    await fillField(user, usesInputs[1], '3');

    // Inventory tab: one manual item.
    await user.click(screen.getByRole('tab', { name: /Inventory/ }));
    await user.click(screen.getByRole('button', { name: 'Add Item Manually' }));
    await user.type(screen.getByPlaceholderText('Item name'), 'Hemp rope');
    await fillField(user, screen.getByTitle('Quantity'), '5');
    await user.click(screen.getByRole('checkbox', { name: 'Equipped' }));

    // Spells tab: caster level, both overrides and one slot override.
    await user.click(screen.getByRole('tab', { name: /Spells/ }));
    await user.click(
      screen.getByRole('switch', { name: 'Enable Spellcasting' })
    );
    const fieldAfter = (label: string) =>
      (screen.getByText(label).parentElement as HTMLElement).querySelector(
        'input'
      ) as HTMLElement;
    await fillField(user, fieldAfter('Caster Level'), '5');
    await fillField(user, screen.getAllByPlaceholderText('Auto')[0], '9');
    await fillField(user, screen.getAllByPlaceholderText('Auto')[1], '15');
    await pickOption(screen.getAllByRole('combobox')[0], 'Wisdom');
    const levelOneRow = screen.getByText('Level 1: 4').parentElement;
    await fillField(
      user,
      within(levelOneRow as HTMLElement).getByRole('textbox'),
      '2'
    );

    await user.click(screen.getByRole('button', { name: 'Create NPC' }));
    const payload = savedPayload(onSave);
    expect(withStableIds(payload)).toMatchSnapshot();

    expect(payload.resources).toHaveLength(1);
    expect(payload.resources[0].maxUses).toBe(2);
    expect(payload.monsterStatBlock.traits[0].uses).toBe(2);
    expect(payload.monsterStatBlock.actions[0].uses).toBe(3);
    const entryNames = (list: Array<{ name: string }>) =>
      list.map(entry => entry.name);
    expect(entryNames(payload.monsterStatBlock.bonusActions)).toEqual([
      'Healing Word',
    ]);
    expect(entryNames(payload.monsterStatBlock.reactions)).toEqual(['Parry']);
    expect(entryNames(payload.monsterStatBlock.lairActions)).toEqual([
      'Tremor',
    ]);
    expect(payload.inventory[0]).toMatchObject({
      name: 'Hemp rope',
      quantity: 5,
      equipped: true,
    });
    expect(payload.spellcasting).toMatchObject({
      casterLevel: 5,
      ability: 'wisdom',
      spellAttackBonus: 9,
      spellSaveDC: 15,
      slotOverrides: { 1: 2 },
    });
  }, 20_000);
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
