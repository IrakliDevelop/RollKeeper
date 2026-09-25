import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useStatBlockEditDialog } from '../StatBlockEditDialog';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '../../types';

afterEach(() => cleanup());

function makeStatBlock(): MonsterStatBlock {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    saves: '',
    skills: '',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: '',
    passivePerception: 10,
    traits: [],
    actions: [],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'humanoid',
    size: 'Small',
    languages: '',
    alignment: 'neutral evil',
    hpFormula: '2d6',
  };
}

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
    monsterStatBlock: makeStatBlock(),
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
    onSpendResource: vi.fn(() => true),
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

/** Tiny harness exercising the hook the way a real caller (DetailActions, the future drawer body) would. */
function Harness({
  entity,
  actions,
}: {
  entity: EncounterEntity;
  actions: EntityActions;
}) {
  const { open, dialog, canEdit } = useStatBlockEditDialog(entity, actions);
  return (
    <>
      {canEdit && <button onClick={open}>Open editor</button>}
      {dialog}
    </>
  );
}

describe('useStatBlockEditDialog', () => {
  it('reports canEdit for a non-player entity with a stat block', () => {
    render(<Harness entity={makeEntity()} actions={makeActions()} />);
    expect(
      screen.getByRole('button', { name: 'Open editor' })
    ).toBeInTheDocument();
  });

  it('reports canEdit=false for a player entity', () => {
    render(
      <Harness
        entity={makeEntity({ type: 'player' })}
        actions={makeActions()}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Open editor' })
    ).not.toBeInTheDocument();
  });

  it('open() shows the editor dialog titled "Edit {name}"', async () => {
    const user = userEvent.setup();
    render(<Harness entity={makeEntity()} actions={makeActions()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open editor' }));

    expect(
      await screen.findByRole('dialog', { name: /edit goblin boss/i })
    ).toBeInTheDocument();
  });
});
