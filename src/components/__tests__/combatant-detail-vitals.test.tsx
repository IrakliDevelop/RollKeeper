// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailVitals } from '@/components/ui/encounter/combat-screen/detail/DetailVitals';
import { DetailHeader } from '@/components/ui/encounter/combat-screen/detail/DetailHeader';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(cleanup);

vi.mock('@/components/ui/encounter/combat-screen/spendHitDie', () => ({
  rollHitDie: vi.fn(() => ({
    healAmount: 6,
    hitDice: { current: 2, max: 3, dieType: 'd8' },
  })),
}));

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
    onRestoreAbility: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
  };
}

const npcEntity: EncounterEntity = {
  id: 'npc-1',
  type: 'npc',
  name: 'Goblin',
  initiative: 12,
  initiativeModifier: 1,
  currentHp: 5,
  maxHp: 10,
  tempHp: 0,
  armorClass: 13,
  conditions: [],
};

const playerEntity: EncounterEntity = {
  id: 'player-1',
  type: 'player',
  name: 'Aragorn',
  initiative: 18,
  initiativeModifier: 3,
  currentHp: 30,
  maxHp: 40,
  tempHp: 0,
  armorClass: 16,
  conditions: [],
};

describe('DetailVitals', () => {
  it('damage flow: type 7 → click Damage → onDamage(id, 7)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcEntity} actions={actions} />);

    const amountInput = screen.getByPlaceholderText('Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '7');
    await user.click(screen.getByRole('button', { name: /damage/i }));
    expect(actions.onDamage).toHaveBeenCalledWith('npc-1', 7);
  });

  it('½× halves the amount field only — does not apply damage', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcEntity} actions={actions} />);

    const amountInput = screen.getByPlaceholderText('Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '10');
    await user.click(screen.getByRole('button', { name: '½×' }));
    expect(amountInput).toHaveValue(5);
    expect(actions.onDamage).not.toHaveBeenCalled();
  });

  it('2× doubles the amount field only — does not apply damage', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcEntity} actions={actions} />);

    const amountInput = screen.getByPlaceholderText('Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '6');
    await user.click(screen.getByRole('button', { name: '2×' }));
    expect(amountInput).toHaveValue(12);
    expect(actions.onDamage).not.toHaveBeenCalled();
  });

  it('heal: type 5 → click Heal → onHeal(id, 5)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcEntity} actions={actions} />);

    const amountInput = screen.getByPlaceholderText('Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '5');
    await user.click(screen.getByRole('button', { name: /heal/i }));
    expect(actions.onHeal).toHaveBeenCalledWith('npc-1', 5);
  });

  it('temp: type 3 → click + Temp → onAddTempHp(id, 3)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcEntity} actions={actions} />);

    const amountInput = screen.getByPlaceholderText('Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '3');
    await user.click(screen.getByRole('button', { name: /\+ temp/i }));
    expect(actions.onAddTempHp).toHaveBeenCalledWith('npc-1', 3);
  });

  it('player entity hides damage controls', () => {
    const actions = makeActions();
    render(<DetailVitals entity={playerEntity} actions={actions} />);

    expect(screen.queryByPlaceholderText('Amount')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /damage/i })
    ).not.toBeInTheDocument();
  });

  it('player entity shows synced caption for AC', () => {
    const actions = makeActions();
    render(<DetailVitals entity={playerEntity} actions={actions} />);

    expect(screen.getByText('synced')).toBeInTheDocument();
  });

  it('NPC death-save failure toggle calls onUpdate with incremented failures', async () => {
    const npcAtZeroHp: EncounterEntity = {
      ...npcEntity,
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    };
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcAtZeroHp} actions={actions} />);

    const failPip = screen.getByRole('button', {
      name: 'Death save failure 1',
    });
    await user.click(failPip);
    expect(actions.onUpdate).toHaveBeenCalledWith('npc-1', {
      deathSaves: { successes: 0, failures: 1, isStabilized: false },
    });
  });

  it('spend hit die calls onHeal + onUpdate', async () => {
    const npcWithHitDice: EncounterEntity = {
      ...npcEntity,
      hitDice: { current: 3, max: 3, dieType: 'd8' },
    };
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailVitals entity={npcWithHitDice} actions={actions} />);

    await user.click(screen.getByRole('button', { name: /spend hit die/i }));
    expect(actions.onHeal).toHaveBeenCalledWith('npc-1', 6);
    expect(actions.onUpdate).toHaveBeenCalledWith('npc-1', {
      hitDice: { current: 2, max: 3, dieType: 'd8' },
    });
  });

  it('lair entity renders null', () => {
    const lairEntity: EncounterEntity = {
      ...npcEntity,
      id: 'lair-1',
      type: 'lair',
      name: 'Vampire Lair',
    };
    const actions = makeActions();
    const { container } = render(
      <DetailVitals entity={lairEntity} actions={actions} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('player entity max HP is static text — no edit button and onSetMaxHp never called', () => {
    const actions = makeActions();
    render(<DetailVitals entity={playerEntity} actions={actions} />);

    expect(screen.queryByTitle('Edit max HP')).not.toBeInTheDocument();
    expect(actions.onSetMaxHp).not.toHaveBeenCalled();
  });
});

describe('DetailHeader', () => {
  it('clicking Enemy disposition calls onUpdate with enemy playerDisposition', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Enemy' }));
    expect(actions.onUpdate).toHaveBeenCalledWith('npc-1', {
      playerDisposition: 'enemy',
    });
  });

  it('Remove button calls window.confirm and invokes onRemove when confirmed', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(
      screen.getByRole('button', { name: /remove from combat/i })
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(actions.onRemove).toHaveBeenCalledWith('npc-1');
    vi.restoreAllMocks();
  });

  it('Remove button calls window.confirm but does NOT call onRemove when cancelled', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(
      screen.getByRole('button', { name: /remove from combat/i })
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(actions.onRemove).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('non-player: Rename button swaps name for an input, commits on Enter', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    expect(input).toHaveValue('Goblin');

    await user.clear(input);
    await user.type(input, 'Goblin Boss');
    await user.keyboard('{Enter}');

    expect(actions.onUpdate).toHaveBeenCalledWith('npc-1', {
      name: 'Goblin Boss',
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('non-player: rename commits on blur too', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    await user.clear(input);
    await user.type(input, 'Renamed Goblin');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith('npc-1', {
      name: 'Renamed Goblin',
    });
  });

  it('non-player: Escape cancels the rename without committing', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    await user.clear(input);
    await user.type(input, 'Should not save');
    await user.keyboard('{Escape}');

    expect(actions.onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('non-player: empty/whitespace name is ignored (trimmed, not committed)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailHeader entity={npcEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    await user.clear(input);
    await user.type(input, '   ');
    await user.keyboard('{Enter}');

    expect(actions.onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('player entities have no rename affordance', () => {
    const actions = makeActions();
    render(<DetailHeader entity={playerEntity} actions={actions} />);

    expect(
      screen.queryByRole('button', { name: 'Rename' })
    ).not.toBeInTheDocument();
  });
});
