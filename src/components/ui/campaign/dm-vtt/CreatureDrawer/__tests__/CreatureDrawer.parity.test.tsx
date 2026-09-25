import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreatureDrawer } from '..';
import {
  FULL_CREATURE,
  FULL_CREATURE_STANDING,
  LAIR,
  SUMMON,
  makeCreatureStatBlock,
} from '../CreatureDrawer.fixtures';
import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounter } from '@/test/helpers';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ conditions: [], loading: false }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ effects: [], loading: false }),
}));

// Parity checklist: every control today's CombatantDetail exposes (spec
// "Parity checklist" table) must be reachable in the drawer and call the
// same EntityActions member.

const ID = FULL_CREATURE.id;

const SPIDER: EncounterEntity = {
  ...FULL_CREATURE_STANDING,
  id: 'spider-1',
  type: 'monster',
  name: 'Giant Spider',
  npcSourceId: undefined,
  monsterStatBlock: makeCreatureStatBlock({
    inflictableConditions: [
      {
        id: 'cc-web',
        name: 'Webbed',
        description: 'Restrained by sticky webbing.',
        icon: 'link',
        kind: 'debuff',
      },
    ],
  }),
};

function makeActions(): EntityActions {
  return {
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onAddTempHp: vi.fn(),
    onSetMaxHp: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onSetConditionRounds: vi.fn(),
    onUseAbility: vi.fn(),
    onUseInventoryEntry: vi.fn(() => true),
    onRestoreAbility: vi.fn(),
    onSpendResource: vi.fn(() => true),
    onRestoreResource: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onShortRest: vi.fn(),
    onViewNPC: vi.fn(),
  };
}

function renderDrawer(entity: EncounterEntity = FULL_CREATURE) {
  const actions = makeActions();
  const onTokenIdentityChange = vi.fn();
  const user = userEvent.setup();
  render(
    <CreatureDrawer
      entity={entity}
      actions={actions}
      isTurn={false}
      onClose={vi.fn()}
      onTokenIdentityChange={onTokenIdentityChange}
    />
  );
  return { actions, onTokenIdentityChange, user };
}

async function startEditing(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^play$/i }));
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('tab', { name }));
}

/** The row that contains a piece of text — used to scope generic "Use" buttons. */
function rowOf(text: string, depth: number): HTMLElement {
  let el: HTMLElement = screen.getByText(text);
  for (let i = 0; i < depth; i++) el = el.parentElement as HTMLElement;
  return el;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  useEncounterStore.setState({
    encounters: [
      createMockEncounter({
        id: 'enc-1',
        entities: [FULL_CREATURE, SPIDER],
      }),
    ],
    activeEncounterId: 'enc-1',
    combatConfig: DEFAULT_COMBAT_CONFIG,
  });
});

describe('CreatureDrawer parity — header', () => {
  it('renames the creature', async () => {
    const { actions, user } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Combatant name');
    await user.clear(input);
    await user.type(input, 'Vex the Bold{Enter}');
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      name: 'Vex the Bold',
    });
  });

  it('removes from combat after the confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { actions, user } = renderDrawer();
    await user.click(
      screen.getByRole('button', { name: 'Remove from combat' })
    );
    expect(actions.onRemove).toHaveBeenCalledWith(ID);
  });

  it('opens the NPC library record', async () => {
    const { actions, user } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'View NPC details' }));
    expect(actions.onViewNPC).toHaveBeenCalledWith('npc-vex', ID);
  });
});

describe('CreatureDrawer parity — players row', () => {
  it('sets disposition, hidden name, exact HP, and alias', async () => {
    const { actions, user } = renderDrawer();

    await user.click(screen.getByRole('button', { name: 'Ally' }));
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      playerDisposition: 'ally',
    });

    await user.click(
      screen.getByTitle('Name visible to players — click to hide')
    );
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, { isHidden: true });

    await user.click(
      screen.getByRole('button', { name: 'Show exact HP to players' })
    );
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      hpVisibleToPlayers: true,
    });

    await user.type(
      screen.getByLabelText('Alias players see'),
      'Stranger{Enter}'
    );
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      playerAlias: 'Stranger',
    });
    expect(screen.getByText(/players see:/i)).toBeInTheDocument();
  });

  it('previews the alias in "Players see"', () => {
    renderDrawer({ ...FULL_CREATURE, playerAlias: 'Hooded Stranger' });
    expect(screen.getByText(/players see:/i)).toHaveTextContent(
      'Players see: Hooded Stranger'
    );
  });
});

describe('CreatureDrawer parity — vitals', () => {
  it('damages, heals, and adds temp HP with ½× / 2×', async () => {
    const { actions, user } = renderDrawer();
    const amount = screen.getByLabelText('Amount');

    fireEvent.change(amount, { target: { value: '10' } });
    await user.click(screen.getByRole('button', { name: '½×' }));
    await user.click(screen.getByRole('button', { name: /^damage$/i }));
    expect(actions.onDamage).toHaveBeenCalledWith(ID, 5);

    fireEvent.change(amount, { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: '2×' }));
    await user.click(screen.getByRole('button', { name: /^heal$/i }));
    expect(actions.onHeal).toHaveBeenCalledWith(ID, 6);

    fireEvent.change(amount, { target: { value: '4' } });
    await user.click(screen.getByRole('button', { name: /\+ temp/i }));
    expect(actions.onAddTempHp).toHaveBeenCalledWith(ID, 4);
  });

  it('edits max HP, AC, temp AC, init modifier, and PB in Editing mode', async () => {
    const { actions, user } = renderDrawer();
    await startEditing(user);

    fireEvent.change(screen.getByLabelText('Max HP'), {
      target: { value: '50' },
    });
    expect(actions.onSetMaxHp).toHaveBeenCalledWith(ID, 50);

    fireEvent.change(screen.getByLabelText('Armor class'), {
      target: { value: '17' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, { armorClass: 17 });

    fireEvent.change(screen.getByLabelText('Temporary AC bonus'), {
      target: { value: '3' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, { tempAc: 3 });

    fireEvent.change(screen.getByLabelText('Initiative Mod'), {
      target: { value: '5' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      initiativeModifier: 5,
    });

    fireEvent.change(screen.getByLabelText('Proficiency Bonus'), {
      target: { value: '4' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, { proficiencyBonus: 4 });
  });

  it('spends a hit die (heal + hitDice update) when standing', async () => {
    const { actions, user } = renderDrawer(FULL_CREATURE_STANDING);
    await user.click(screen.getByRole('button', { name: /spend hit die/i }));
    expect(actions.onHeal).toHaveBeenCalledWith(ID, expect.any(Number));
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      hitDice: expect.objectContaining({ current: 2 }),
    });
  });

  it('marks NPC death saves at 0 HP', async () => {
    const { actions, user } = renderDrawer();
    await user.click(screen.getByLabelText('Death save success 1'));
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      deathSaves: { successes: 1, failures: 0, isStabilized: false },
    });
    await user.click(screen.getByLabelText('Death save failure 1'));
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      deathSaves: { successes: 0, failures: 1, isStabilized: false },
    });
  });

  it('edits and drops concentration, and toggles the reaction', async () => {
    const { actions, user } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('Hold Person'), {
      target: { value: 'Bless' },
    });
    expect(actions.onSetConcentration).toHaveBeenCalledWith(ID, 'Bless');

    await user.click(screen.getByRole('button', { name: 'Drop' }));
    expect(actions.onSetConcentration).toHaveBeenCalledWith(ID, null);

    await user.click(screen.getByRole('button', { name: 'Available' }));
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      hasUsedReaction: true,
    });
  });
});

describe('CreatureDrawer parity — abilities', () => {
  it('edits scores, toggles save proficiency, and resets a save override', async () => {
    const { actions, user } = renderDrawer();
    await startEditing(user);

    fireEvent.change(screen.getByLabelText('STR score'), {
      target: { value: '18' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      monsterStatBlock: expect.objectContaining({ str: 18 }),
    });

    await user.click(
      screen.getByRole('button', { name: 'WIS save proficiency' })
    );
    expect(actions.onUpdate).toHaveBeenLastCalledWith(ID, {
      monsterStatBlock: expect.objectContaining({
        saveProficiencies: expect.arrayContaining(['wis']),
      }),
    });

    await user.click(
      screen.getByRole('button', { name: 'Reset DEX saving throw' })
    );
    expect(actions.onUpdate).toHaveBeenLastCalledWith(ID, {
      monsterStatBlock: expect.objectContaining({ saves: '' }),
    });
  });
});

describe('CreatureDrawer parity — Actions tab', () => {
  it('uses and resets legendary actions', async () => {
    const { actions, user } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Use Quick Step' }));
    expect(actions.onUseLegendaryAction).toHaveBeenCalledWith(ID, 'leg-dash');
    await user.click(
      screen.getByRole('button', { name: 'Reset legendary actions' })
    );
    expect(actions.onResetLegendaryActions).toHaveBeenCalledWith(ID);
  });

  it('uses a lair action', async () => {
    const { actions, user } = renderDrawer();
    await user.click(
      within(rowOf('Smoke Bomb', 2)).getByRole('button', { name: 'Use' })
    );
    expect(actions.onUseLairAction).toHaveBeenCalledWith(ID, 'lair-smoke');
  });

  it('spends and restores pip and pool resources', async () => {
    const { actions, user } = renderDrawer();
    await user.click(
      screen.getByRole('button', { name: 'Rally use 1 (available)' })
    );
    expect(actions.onSpendResource).toHaveBeenCalledWith(ID, 'res-pips', 1);
    await user.click(screen.getByRole('button', { name: 'Spend Grit' }));
    expect(actions.onSpendResource).toHaveBeenCalledWith(ID, 'res-pool', 1);
    await user.click(screen.getByRole('button', { name: 'Restore Grit' }));
    expect(actions.onRestoreResource).toHaveBeenCalledWith(ID, 'res-pool', 1);
  });

  it('uses and restores entry uses, and spends inventory/resource costs', async () => {
    const { actions, user } = renderDrawer();
    await user.click(
      screen.getByRole('button', { name: 'Volley use 2 (available)' })
    );
    expect(actions.onUseAbility).toHaveBeenCalledWith(ID, 'act-volley');
    await user.click(
      screen.getByRole('button', { name: 'Volley use 1 (used)' })
    );
    expect(actions.onRestoreAbility).toHaveBeenCalledWith(ID, 'act-volley');

    await user.click(
      within(rowOf('Quaff Potion', 1)).getByRole('button', { name: 'Use' })
    );
    expect(actions.onUseInventoryEntry).toHaveBeenCalledWith(ID, 'act-potion');

    await user.click(
      within(rowOf('Battle Surge', 1)).getByRole('button', { name: 'Use' })
    );
    expect(actions.onSpendResource).toHaveBeenCalledWith(ID, 'res-pool', 1);
  });

  it('shows the spellcasting block read-only', () => {
    renderDrawer();
    expect(screen.getByText('Spellcasting')).toBeInTheDocument();
    expect(screen.getByText('minor illusion')).toBeInTheDocument();
  });
});

describe('CreatureDrawer parity — Stat block tab', () => {
  it('edits every combat details row in Editing mode', async () => {
    const { actions, user } = renderDrawer();
    await startEditing(user);
    await openTab(user, /stat block/i);

    const rows: Array<[string, string, Record<string, unknown>]> = [
      ['Saving Throws', 'Dex +7', { saves: 'Dex +7' }],
      ['Skills', 'Stealth +6', { skills: 'Stealth +6' }],
      ['Resistances', 'Fire', { resistances: 'Fire' }],
      ['Immunities', 'Acid', { immunities: 'Acid' }],
      ['Vulnerabilities', 'Cold', { vulnerabilities: 'Cold' }],
      [
        'Condition Immunities',
        'Charmed, Frightened',
        { conditionImmunities: ['Charmed', 'Frightened'] },
      ],
      ['Senses', 'Blindsight 10 ft.', { senses: 'Blindsight 10 ft.' }],
      ['Languages', 'Elvish', { languages: 'Elvish' }],
      ['Passive Perception', '16', { passivePerception: 16 }],
    ];
    for (const [label, value, patch] of rows) {
      const input = screen.getByLabelText(label);
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
      expect(actions.onUpdate).toHaveBeenLastCalledWith(ID, {
        monsterStatBlock: expect.objectContaining(patch),
      });
    }
  });

  it('opens the full stat block editor from the tab and saves', async () => {
    const { actions, user } = renderDrawer();
    await openTab(user, /stat block/i);
    await user.click(
      screen.getByRole('button', { name: 'Full stat block editor' })
    );
    await user.click(screen.getByRole('button', { name: 'Save stat block' }));
    expect(actions.onUpdate).toHaveBeenCalledWith(ID, {
      monsterStatBlock: expect.objectContaining({ cr: '5' }),
      initiativeModifier: 3,
      proficiencyBonus: 3,
    });
  });

  it('opens the same editor from the editing banner', async () => {
    const { user } = renderDrawer();
    await startEditing(user);
    const banner = screen.getByText(/editing this combatant/i)
      .parentElement as HTMLElement;
    await user.click(
      within(banner).getByRole('button', { name: 'Full stat block editor' })
    );
    expect(
      screen.getByRole('dialog', { name: 'Edit Captain Vex' })
    ).toBeInTheDocument();
  });

  it('changes token portrait, chess piece, color, and size', async () => {
    const { onTokenIdentityChange, user } = renderDrawer();
    await openTab(user, /stat block/i);

    const url = screen.getByLabelText('Portrait URL');
    await user.type(url, 'https://example.test/vex.png');
    fireEvent.blur(url);
    expect(onTokenIdentityChange).toHaveBeenCalledWith(FULL_CREATURE, {
      avatarUrl: 'https://example.test/vex.png',
    });

    await user.click(screen.getByTitle('Knight'));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(FULL_CREATURE, {
      chessPiece: 'knight',
    });
    await user.click(screen.getByTitle('Red'));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(FULL_CREATURE, {
      color: '#ef4444',
    });
    await user.click(screen.getByRole('radio', { name: 'L 2×2' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(FULL_CREATURE, {
      tokenSize: 2,
    });
  });
});

describe('CreatureDrawer parity — Effects tab', () => {
  it('adjusts, removes, and adds effects from every source', async () => {
    const { actions, user } = renderDrawer();
    await openTab(user, /effects/i);

    expect(screen.getByText('×2')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Poisoned decrease rounds' })
    );
    expect(actions.onSetConditionRounds).toHaveBeenCalledWith(
      ID,
      'cond-poison',
      2
    );
    await user.click(
      screen.getByRole('button', { name: 'Poisoned increase rounds' })
    );
    expect(actions.onSetConditionRounds).toHaveBeenCalledWith(
      ID,
      'cond-poison',
      4
    );
    expect(
      screen.getByRole('button', { name: 'Warded decrease rounds' })
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Warded increase rounds' })
    );
    expect(actions.onSetConditionRounds).toHaveBeenCalledWith(
      ID,
      'cond-ward',
      1
    );
    await user.click(screen.getByRole('button', { name: 'Remove Poisoned' }));
    expect(actions.onRemoveCondition).toHaveBeenCalledWith(ID, 'cond-poison');

    await user.click(
      screen.getByRole('button', { name: 'Webbed (from Giant Spider)' })
    );
    expect(actions.onAddCondition).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ name: 'Webbed', sourceEntity: 'Giant Spider' })
    );

    await user.click(screen.getByRole('button', { name: 'Blinded' }));
    expect(actions.onAddCondition).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ name: 'Blinded', kind: 'debuff' })
    );

    await user.click(screen.getByRole('button', { name: 'Buffs' }));
    await user.click(screen.getByRole('button', { name: 'Haste' }));
    expect(actions.onAddCondition).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ name: 'Haste', kind: 'buff' })
    );

    await user.type(screen.getByPlaceholderText('Custom effect…'), 'Marked');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(actions.onAddCondition).toHaveBeenCalledWith(ID, {
      name: 'Marked',
      kind: 'neutral',
      source: 'dm',
    });
  });
});

describe('CreatureDrawer parity — variants', () => {
  it('lair entities get the reduced layout: a single Lair tab with Use', async () => {
    const { actions, user } = renderDrawer(LAIR);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent('Lair');
    expect(screen.queryByText('Hit Points')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^damage$/i })
    ).not.toBeInTheDocument();

    await user.click(
      within(rowOf('Magma Eruption', 2)).getByRole('button', { name: 'Use' })
    );
    expect(actions.onUseLairAction).toHaveBeenCalledWith(LAIR.id, 'magma');

    await user.click(screen.getByRole('button', { name: 'Ally' }));
    expect(actions.onUpdate).toHaveBeenCalledWith(LAIR.id, {
      playerDisposition: 'ally',
    });
  });

  it('summons show no Damage/Heal controls', () => {
    renderDrawer(SUMMON);
    expect(screen.getByText('Hit Points')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^damage$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^heal$/i })
    ).not.toBeInTheDocument();
  });
});
