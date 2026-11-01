import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SWAP_ANIMATION } from '@/components/ui/game/abilityNumbers';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';
import { OverviewTab } from '../OverviewTab';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fighter(overrides: Partial<CharacterState> = {}): CharacterState {
  const base = makeCharacter();
  return {
    ...base,
    level: 5,
    totalLevel: 5,
    abilities: {
      strength: 16,
      dexterity: 14,
      constitution: 15,
      intelligence: 8,
      wisdom: 12,
      charisma: 10,
    },
    savingThrows: {
      ...base.savingThrows,
      strength: { proficient: true },
      dexterity: { proficient: false, customModifier: 1 },
    },
    ...overrides,
  };
}

describe('OverviewTab abilities', () => {
  it('shows the six abilities as a ledger row with every save', () => {
    const { container } = render(
      <OverviewTab char={fighter()} counterValue={0} />
    );
    expect(container.querySelectorAll('[data-ledger-cell]')).toHaveLength(6);
    // Level 5: proficiency bonus +3.
    expect(
      screen.getByRole('img', { name: 'Strength saving throw +6, proficient' })
    ).toHaveTextContent('Save +6');
    expect(
      screen.getByRole('img', { name: 'Dexterity saving throw +3' })
    ).toHaveTextContent('Save +3');
    expect(
      screen.getByRole('img', { name: 'Strength: modifier +3, score 16' })
    ).toBeInTheDocument();
  });

  it('is read-only: no rolls, no score editor', () => {
    render(<OverviewTab char={fighter()} counterValue={0} />);
    expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Strength: modifier/ })
    ).toBeNull();
  });

  it('heads the row "Abilities" with the DM’s own "Scores large" switch', () => {
    const { container } = render(
      <OverviewTab char={fighter()} counterValue={0} />
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Abilities' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Ability Scores')).toBeNull();
    const row = container.querySelector('[data-ledger-row]')!;
    expect(row).toHaveAttribute('data-display', 'modifier');
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    expect(row).toHaveAttribute('data-display', 'score');
    expect(
      JSON.parse(localStorage.getItem('rollkeeper-ui-prefs') ?? '{}')
    ).toEqual({ abilityDisplay: 'score' });
  });

  it('reads an older character without saving throws', () => {
    const old = fighter({
      savingThrows: undefined as unknown as CharacterState['savingThrows'],
    });
    render(<OverviewTab char={old} counterValue={0} />);
    expect(
      screen.getByRole('img', { name: 'Strength saving throw +3' })
    ).toBeInTheDocument();
  });

  it('uses the total level for a multiclass character’s saves', () => {
    render(
      <OverviewTab
        char={fighter({ level: 1, totalLevel: 5 })}
        counterValue={0}
      />
    );
    expect(
      screen.getByRole('img', { name: 'Strength saving throw +6, proficient' })
    ).toBeInTheDocument();
  });

  it('animates a swap made with its own switch', () => {
    const { container } = render(
      <OverviewTab char={fighter()} counterValue={0} />
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    expect(
      container.querySelector('[data-number="large"]')!.className
    ).toContain(SWAP_ANIMATION);
  });
});
