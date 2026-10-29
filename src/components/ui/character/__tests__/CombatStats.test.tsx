import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CombatStats from '../CombatStats';
import { makeCharacter } from '@/utils/__tests__/test-utils';

afterEach(cleanup);

function renderStats(editing?: boolean) {
  const character = makeCharacter({ speed: 35, flySpeed: 60 });
  return render(
    <CombatStats
      character={character}
      editing={editing}
      getInitiativeModifier={() => 3}
      onUpdateInitiative={vi.fn()}
      onResetInitiativeToDefault={vi.fn()}
      onUpdateSpeed={vi.fn()}
      onUpdateCharacter={vi.fn()}
      onToggleReaction={vi.fn()}
      onResetReaction={vi.fn()}
      onRollInitiative={vi.fn()}
    />
  );
}

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

  it('keeps the extra-speeds toggle in play mode', () => {
    renderStats(false);
    expect(
      screen.getByRole('button', { name: 'Hide extra speeds' })
    ).toBeInTheDocument();
  });
});
