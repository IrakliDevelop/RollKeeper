import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreatureHpCard } from '../CreatureHpCard';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(() => cleanup());

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 20,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  };
}

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
    onSpendResource: vi.fn(),
    onRestoreResource: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onShortRest: vi.fn(),
  };
}

function baseProps(
  overrides: Partial<ComponentProps<typeof CreatureHpCard>> = {}
) {
  return {
    entity: makeEntity(),
    actions: makeActions(),
    editing: false,
    ...overrides,
  };
}

describe('CreatureHpCard', () => {
  it('shows current/max HP', () => {
    render(<CreatureHpCard {...baseProps()} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('shows the stat block HP formula when present', () => {
    render(
      <CreatureHpCard
        {...baseProps({
          entity: makeEntity({
            monsterStatBlock: { hpFormula: '3d8+6' } as never,
          }),
        })}
      />
    );
    expect(screen.getByText('3d8+6')).toBeInTheDocument();
  });

  it('damages via DamageControls', () => {
    const actions = makeActions();
    render(<CreatureHpCard {...baseProps({ actions })} />);
    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: /damage/i }));
    expect(actions.onDamage).toHaveBeenCalledWith('e1', 4);
  });

  it('does not render DamageControls for a summon', () => {
    render(
      <CreatureHpCard
        {...baseProps({ entity: makeEntity({ summonId: 'summon-1' }) })}
      />
    );
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
  });

  it('does not show a Max HP editor outside editing mode', () => {
    render(<CreatureHpCard {...baseProps({ editing: false })} />);
    expect(screen.queryByLabelText('Max HP')).not.toBeInTheDocument();
  });

  it('buffers max HP typing and commits once on blur', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(
      <CreatureHpCard
        {...baseProps({
          actions,
          editing: true,
          entity: makeEntity({ currentHp: 45, maxHp: 45 }),
        })}
      />
    );
    const input = screen.getByLabelText('Max HP');
    await user.clear(input);
    await user.type(input, '50');
    expect(actions.onSetMaxHp).not.toHaveBeenCalled();
    await user.tab();
    expect(actions.onSetMaxHp).toHaveBeenCalledExactlyOnceWith('e1', 50);
  });

  it('commits max HP once on Enter', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<CreatureHpCard {...baseProps({ actions, editing: true })} />);
    const input = screen.getByLabelText('Max HP');
    await user.clear(input);
    await user.type(input, '25{Enter}');
    expect(actions.onSetMaxHp).toHaveBeenCalledExactlyOnceWith('e1', 25);
  });

  it('reverts max HP on Escape without committing', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<CreatureHpCard {...baseProps({ actions, editing: true })} />);
    const input = screen.getByLabelText('Max HP');
    await user.clear(input);
    await user.type(input, '99{Escape}');
    expect(input).toHaveValue('20');
    await user.tab();
    expect(actions.onSetMaxHp).not.toHaveBeenCalled();
  });

  it('does not commit an emptied or unchanged max HP', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<CreatureHpCard {...baseProps({ actions, editing: true })} />);
    const input = screen.getByLabelText('Max HP');
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue('20');
    await user.click(input);
    await user.tab();
    expect(actions.onSetMaxHp).not.toHaveBeenCalled();
  });

  it('resyncs the max HP field when maxHp changes elsewhere', () => {
    const p = baseProps({ editing: true });
    const { rerender } = render(<CreatureHpCard {...p} />);
    rerender(<CreatureHpCard {...p} entity={makeEntity({ maxHp: 30 })} />);
    expect(screen.getByLabelText('Max HP')).toHaveValue('30');
  });

  it('clears temp HP via the pill button', () => {
    const actions = makeActions();
    render(
      <CreatureHpCard
        {...baseProps({ actions, entity: makeEntity({ tempHp: 5 }) })}
      />
    );
    fireEvent.click(screen.getByLabelText('Clear temp HP'));
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', { tempHp: 0 });
  });
});
