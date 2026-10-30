import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellcastingStats } from '@/components/SpellcastingStats';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';

afterEach(cleanup);

describe('SpellcastingStats edit gate', () => {
  it('keeps a stored override visible but read-only in play mode', () => {
    useCharacterStore.setState({
      character: makeWizard({
        spellcastingStats: {
          spellcastingAbility: 'wisdom',
          isAbilityOverridden: true,
          spellAttackBonus: 7,
          spellSaveDC: 15,
        },
      }),
    });
    render(<SpellcastingStats editing={false} />);

    expect(
      screen.getAllByText('wisdom', { exact: false }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByTitle('Toggle manual overrides')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByPlaceholderText('Auto')).toBeNull();
    expect(screen.getByText('+7')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('closes the override editor on leaving edit mode without changing the values', () => {
    useCharacterStore.setState({ character: makeWizard() });
    const { rerender } = render(<SpellcastingStats editing />);
    fireEvent.click(screen.getByTitle('Toggle manual overrides'));
    expect(screen.getAllByPlaceholderText('Auto')).toHaveLength(2);

    rerender(<SpellcastingStats editing={false} />);
    expect(screen.queryByPlaceholderText('Auto')).toBeNull();
    expect(screen.queryByTitle('Toggle manual overrides')).toBeNull();
    expect(
      useCharacterStore.getState().character.spellcastingStats
        .isAbilityOverridden
    ).toBe(false);
  });
});
