import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';
import {
  createTabbedSheetConfig,
  type TabbedSheetConfigParams,
} from '../tabbedSheetConfig';

vi.mock('@/hooks/useClassData', () => ({
  useClassData: () => ({ classData: [], loading: false, error: null }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
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

type Params = TabbedSheetConfigParams;

// The Stats tab reads a handful of values; every other handler is a stub,
// one per name, so a test can ask which one was called.
function params(editing: boolean, character = makeCharacter()): Params {
  const known: Partial<TabbedSheetConfigParams> = {
    character,
    hasHydrated: true,
    totalLevel: 1,
    proficiencyBonus: 2,
    characterHasSpells: false,
    editing,
    getSavingThrowModifier: () => 1,
    getSkillModifier: () => 2,
    getClassDisplayString: () => 'Fighter 1',
  };
  const stubs = new Map<string, ReturnType<typeof vi.fn>>();
  return new Proxy(known, {
    get: (target, key: string) => {
      if (key in target) return target[key as keyof typeof target];
      if (!stubs.has(key)) stubs.set(key, vi.fn());
      return stubs.get(key);
    },
    has: () => true,
  }) as Params;
}

function renderStats(p: Params) {
  const stats = createTabbedSheetConfig(p).find(tab => tab.id === 'stats')!;
  return render(<>{stats.content}</>);
}

function bard(): CharacterState {
  const base = makeCharacter();
  return {
    ...base,
    jackOfAllTrades: true,
    savingThrows: { ...base.savingThrows, strength: { proficient: true } },
    skills: {
      ...base.skills,
      stealth: { proficient: true, expertise: true },
      acrobatics: { proficient: false, expertise: false },
    },
  };
}

describe('Stats tab', () => {
  it('shows one Abilities section instead of the three panels', () => {
    renderStats(params(false));
    expect(
      screen.getByRole('heading', { level: 2, name: 'Abilities' })
    ).toBeInTheDocument();
    for (const old of ['Ability Scores', 'Saving Throws', 'Skills']) {
      expect(screen.queryByRole('heading', { name: old })).toBeNull();
    }
    expect(screen.queryByText('Proficiency Bonus:')).toBeNull();
  });

  it('puts Experience points after the abilities', () => {
    renderStats(params(false));
    const abilities = screen.getByRole('heading', { name: 'Abilities' });
    const xp = screen.getByRole('heading', { name: 'Experience points' });
    expect(
      abilities.compareDocumentPosition(xp) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('rolls through the page’s handlers in play mode', () => {
    const p = params(false);
    renderStats(p);
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Strength check' })
    );
    expect(p.rollAbilityCheck).toHaveBeenCalledWith('strength');
    fireEvent.click(
      screen.getByRole('button', { name: /^Roll Strength Save/ })
    );
    expect(p.rollSavingThrow).toHaveBeenCalledWith('strength');
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Athletics check' })
    );
    expect(p.rollSkillCheck).toHaveBeenCalledWith('athletics');
    expect(
      screen.queryByRole('button', { name: 'Strength save proficiency' })
    ).toBeNull();
  });

  it('edits through the page’s handlers in edit mode', async () => {
    const p = params(true, bard());
    renderStats(p);
    expect(
      screen.queryByRole('button', { name: 'Roll Strength check' })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Strength save proficiency' })
    );
    expect(p.updateSavingThrowProficiency).toHaveBeenCalledWith(
      'strength',
      false
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Stealth: expertise. Remove proficiency.',
      })
    );
    expect(p.updateSkillExpertise).toHaveBeenCalledWith('stealth', false);
    expect(p.updateSkillProficiency).toHaveBeenCalledWith('stealth', false);
    expect(
      vi.mocked(p.updateSkillExpertise).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(p.updateSkillProficiency).mock.invocationCallOrder[0]
    );

    // Jack of All Trades: half dots, and the switch calls the toggle.
    expect(
      screen.getByRole('button', {
        name: 'Acrobatics: Jack of All Trades. Make proficient.',
      })
    ).toBeInTheDocument();
    const joat = screen.getByRole('switch', { name: 'Jack of All Trades' });
    expect(joat).toBeChecked();
    fireEvent.click(joat);
    expect(p.toggleJackOfAllTrades).toHaveBeenCalledTimes(1);

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose ability modifiers for Athletics',
      })
    );
    await userEvent.click(screen.getByRole('button', { name: 'WIS' }));
    expect(p.toggleSkillBonusAbility).toHaveBeenCalledWith(
      'athletics',
      'wisdom'
    );
    await userEvent.keyboard('{Escape}');

    await userEvent.click(
      screen.getByRole('button', { name: /^Strength: modifier/ })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Save' }))
    );
    expect(p.updateAbilityScore).toHaveBeenCalledWith(
      'strength',
      bard().abilities.strength + 1
    );
  });
});
