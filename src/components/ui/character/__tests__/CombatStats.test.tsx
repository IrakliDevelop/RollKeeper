import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CombatStats from '../CombatStats';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

afterEach(cleanup);

function renderStats(
  editing?: boolean,
  overrides: Partial<CharacterState> = {},
  initiative = 3,
  handlers: { reset?: () => void; roll?: () => void } = {}
) {
  const character = makeCharacter({ speed: 35, flySpeed: 60, ...overrides });
  return render(
    <CombatStats
      character={character}
      editing={editing}
      getInitiativeModifier={() => initiative}
      onUpdateInitiative={vi.fn()}
      onResetInitiativeToDefault={handlers.reset ?? vi.fn()}
      onUpdateSpeed={vi.fn()}
      onUpdateCharacter={vi.fn()}
      onToggleReaction={vi.fn()}
      onResetReaction={vi.fn()}
      onRollInitiative={handlers.roll ?? vi.fn()}
    />
  );
}

const overridden = { initiative: { value: 3, isOverridden: true } };

describe('CombatStats sheet mode', () => {
  it('edits speeds by default', () => {
    renderStats();
    expect(screen.getByDisplayValue('35')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('shows speeds as text in play mode; initiative is plain text', () => {
    renderStats(false);
    expect(screen.queryByDisplayValue('35')).toBeNull();
    expect(screen.queryByDisplayValue('60')).toBeNull();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Initiative' })).toBeNull();
  });

  it('signs a non-negative initiative with a plus', () => {
    renderStats(false);
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('signs zero initiative with a plus', () => {
    renderStats(false, {}, 0);
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('shows a negative initiative without a plus', () => {
    renderStats(false, {}, -1);
    expect(screen.queryByText('+')).toBeNull();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('shows the ft unit beside each speed', () => {
    renderStats(false);
    expect(screen.getAllByText('ft')).toHaveLength(2);
  });

  it('play mode hides zero extra speeds and shows non-zero ones', () => {
    renderStats(false, { flySpeed: 60, climbSpeed: 0, swimSpeed: 20 });
    expect(screen.getByText('Fly')).toBeInTheDocument();
    expect(screen.getByText('Swim')).toBeInTheDocument();
    expect(screen.queryByText('Climb')).toBeNull();
    expect(screen.getAllByText('ft')).toHaveLength(3);
  });

  it('play mode shows no extra speeds when all are zero', () => {
    renderStats(false, { flySpeed: 0 });
    expect(screen.queryByText('Fly')).toBeNull();
    expect(screen.queryByText('Climb')).toBeNull();
    expect(screen.queryByText('Swim')).toBeNull();
  });

  it('edit mode shows all three extra speed fields', () => {
    renderStats(true, { flySpeed: 0 });
    for (const name of ['Fly', 'Climb', 'Swim']) {
      expect(screen.getByRole('textbox', { name })).toBeInTheDocument();
    }
  });

  it('has no extra-speeds toggle in either mode', () => {
    for (const editing of [false, true]) {
      renderStats(editing);
      expect(
        screen.queryByRole('button', { name: /extra speeds/i })
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: /Add fly\/climb\/swim/i })
      ).toBeNull();
      cleanup();
    }
  });

  it('offers the Dexterity reset only in edit mode when overridden', () => {
    const reset = { name: 'Reset to Dexterity modifier' };
    renderStats(true, overridden);
    expect(screen.getByRole('button', reset)).toBeInTheDocument();
    cleanup();
    renderStats(false, overridden);
    expect(screen.queryByRole('button', reset)).toBeNull();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    cleanup();
    renderStats(true, { initiative: { value: 3, isOverridden: false } });
    expect(screen.queryByRole('button', reset)).toBeNull();
  });
});

describe('CombatStats click handlers', () => {
  it('calls the initiative actions without the click event', () => {
    const reset = vi.fn();
    const roll = vi.fn();
    renderStats(true, overridden, 3, { reset, roll });
    fireEvent.click(screen.getByRole('button', { name: /^Roll initiative/ }));
    expect(roll).toHaveBeenCalledWith();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to Dexterity modifier' })
    );
    expect(reset).toHaveBeenCalledWith();
  });
});
