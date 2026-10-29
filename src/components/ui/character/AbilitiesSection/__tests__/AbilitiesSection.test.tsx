import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { calculateModifier } from '@/utils/calculations';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { AbilityName, CharacterState, SkillName } from '@/types/character';
import { AbilitiesSection, type AbilitiesSectionProps } from '..';

beforeEach(() => {
  localStorage.clear();
  // The score editor asks for (min-width: 640px); jsdom has no matchMedia.
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

function hero(): CharacterState {
  const base = makeCharacter();
  return {
    ...base,
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
      dexterity: { proficient: false },
    },
    skills: {
      ...base.skills,
      athletics: { proficient: true, expertise: false },
      stealth: { proficient: true, expertise: true },
      acrobatics: { proficient: false, expertise: false },
      sleightOfHand: {
        proficient: false,
        expertise: false,
        bonusAbilities: ['wisdom', 'intelligence'],
      },
    },
  };
}

function setup(props: Partial<AbilitiesSectionProps> = {}, character = hero()) {
  const handlers = {
    onUpdateAbilityScore: vi.fn(),
    onRollAbilityCheck: vi.fn(),
    onUpdateSavingThrowProficiency: vi.fn(),
    onRollSavingThrow: vi.fn(),
    onUpdateSkillProficiency: vi.fn(),
    onUpdateSkillExpertise: vi.fn(),
    onToggleJackOfAllTrades: vi.fn(),
    onRollSkillCheck: vi.fn(),
    onToggleSkillBonusAbility: vi.fn(),
  };
  const save = (ability: AbilityName) =>
    calculateModifier(character.abilities[ability]) +
    (character.savingThrows[ability]?.proficient ? 2 : 0);
  const skillBonus: Partial<Record<SkillName, number>> = {
    athletics: 5,
    stealth: 6,
    acrobatics: 2,
  };
  const view = render(
    <AbilitiesSection
      abilities={character.abilities}
      savingThrows={character.savingThrows}
      skills={character.skills}
      jackOfAllTrades={character.jackOfAllTrades ?? false}
      getSavingThrowModifier={save}
      getSkillModifier={skill => skillBonus[skill] ?? 0}
      {...handlers}
      {...props}
    />
  );
  return { ...view, handlers };
}

function block(ability: AbilityName) {
  return document.querySelector<HTMLElement>(
    `[data-ability-block="${ability}"]`
  )!;
}

describe('AbilitiesSection layout', () => {
  it('is one "Abilities" section with the six abilities as headings', () => {
    setup({ editing: false });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Abilities' })
    ).toBeInTheDocument();
    const names = screen
      .getAllByRole('heading', { level: 3 })
      .map(h => h.getAttribute('aria-label') ?? h.textContent);
    expect(names).toEqual([
      'Strength',
      'Dexterity',
      'Constitution',
      'Intelligence',
      'Wisdom',
      'Charisma',
    ]);
  });

  it.each([true, false])(
    'names the heading by the ability in both modes (editing %s)',
    editing => {
      setup({ editing });
      expect(
        screen.getByRole('heading', { level: 3, name: 'Strength' })
      ).toBeInTheDocument();
    }
  );

  it('shows the medallions with the approved names', () => {
    setup({ editing: false });
    expect(
      screen.getByRole('img', { name: 'Strength: modifier +3, score 16' })
    ).toHaveAttribute('data-save-proficient', 'true');
    expect(
      screen.getByRole('img', { name: 'Dexterity: modifier +2, score 14' })
    ).toHaveAttribute('data-save-proficient', 'false');
  });

  it('puts each skill under its ability, and "No skills" under Constitution', () => {
    setup({ editing: false });
    expect(within(block('dexterity')).getByText('Stealth')).toBeInTheDocument();
    expect(
      within(block('strength')).getByText('Athletics')
    ).toBeInTheDocument();
    expect(within(block('constitution')).getByText('No skills')).toBeVisible();
    expect(within(block('constitution')).queryByRole('list')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(18);
  });

  it('shows each skill bonus', () => {
    setup({ editing: false });
    const stealth = block('dexterity').querySelector('[data-skill="stealth"]')!;
    expect(stealth).toHaveTextContent('+6');
  });

  it('has no proficiency bonus strip, legend or hover titles', () => {
    const { container } = setup({ editing: false });
    expect(screen.queryByText(/Proficiency Bonus/)).toBeNull();
    expect(screen.queryByText(/P = Proficient/)).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
  });
});

describe('AbilitiesSection in play mode', () => {
  it('rolls a check from the ability name', () => {
    const { handlers } = setup({ editing: false });
    const check = screen.getByRole('button', { name: 'Roll Strength check' });
    expect(check).toHaveTextContent('Strength');
    fireEvent.click(check);
    expect(handlers.onRollAbilityCheck).toHaveBeenCalledWith('strength');
  });

  it('rolls a save from the save line, named by its content', () => {
    const { handlers } = setup({ editing: false });
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Strength Save +5, proficient' })
    );
    expect(handlers.onRollSavingThrow).toHaveBeenCalledWith('strength');
    expect(
      screen.getByRole('button', { name: 'Roll Dexterity Save +2' })
    ).toHaveTextContent('Save +2');
  });

  it('rolls a skill from its name', () => {
    const { handlers } = setup({ editing: false });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Stealth check' }));
    expect(handlers.onRollSkillCheck).toHaveBeenCalledWith('stealth');
  });

  it('shows the skill dots as images that say the state', () => {
    setup({ editing: false });
    const row = (skill: SkillName) =>
      document.querySelector<HTMLElement>(`[data-skill="${skill}"]`)!;
    expect(
      within(row('stealth')).getByRole('img', { name: 'Expertise' })
    ).toHaveAttribute('data-level', 'expertise');
    expect(
      within(row('athletics')).getByRole('img', { name: 'Proficient' })
    ).toBeInTheDocument();
    expect(
      within(row('acrobatics')).getByRole('img', { name: 'Not proficient' })
    ).toBeInTheDocument();
  });

  it('shows half dots with Jack of All Trades', () => {
    setup({ editing: false, jackOfAllTrades: true });
    const acrobatics = document.querySelector('[data-skill="acrobatics"]')!;
    expect(
      within(acrobatics as HTMLElement).getByRole('img', {
        name: 'Jack of All Trades',
      })
    ).toHaveAttribute('data-level', 'half');
  });
});

describe('AbilitiesSection in edit mode', () => {
  it('has no roll buttons', () => {
    setup({ editing: true });
    expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull();
  });

  it('defaults to edit mode', () => {
    setup();
    expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull();
  });
});

describe('Scores large', () => {
  it('swaps the large number and remembers it on this device', () => {
    setup({ editing: false });
    const strength = screen.getByRole('img', {
      name: 'Strength: modifier +3, score 16',
    });
    expect(strength).toHaveAttribute('data-display', 'modifier');
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    expect(strength).toHaveAttribute('data-display', 'score');
    expect(
      JSON.parse(localStorage.getItem('rollkeeper-ui-prefs') ?? '{}')
    ).toEqual({ abilityDisplay: 'score' });
    // The name doesn't follow the visual order.
    expect(strength).toHaveAccessibleName('Strength: modifier +3, score 16');
  });

  it.each([true, false])('is there in both modes (editing %s)', editing => {
    setup({ editing });
    expect(
      screen.getByRole('switch', { name: 'Scores large' })
    ).toBeInTheDocument();
  });
});
