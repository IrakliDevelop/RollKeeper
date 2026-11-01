import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(
      screen.getByRole('button', { name: 'Strength save proficiency' })
    ).toBeInTheDocument();
  });

  it('edits a score from the medallion', async () => {
    const { handlers } = setup({ editing: true });
    await userEvent.click(
      screen.getByRole('button', { name: 'Strength: modifier +3, score 16' })
    );
    const increase = screen.getByRole('button', {
      name: 'Increase Strength score',
    });
    await userEvent.click(increase);
    await userEvent.click(increase);
    expect(screen.getByText('Modifier +4')).toBeInTheDocument();
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Save' }))
    );
    expect(handlers.onUpdateAbilityScore).toHaveBeenCalledWith('strength', 18);
  });

  it('toggles a save proficiency from the save dot', () => {
    const { handlers } = setup({ editing: true });
    const strength = screen.getByRole('button', {
      name: 'Strength save proficiency',
    });
    expect(strength).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(strength);
    expect(handlers.onUpdateSavingThrowProficiency).toHaveBeenCalledWith(
      'strength',
      false
    );
    const dexterity = screen.getByRole('button', {
      name: 'Dexterity save proficiency',
    });
    expect(dexterity).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dexterity);
    expect(handlers.onUpdateSavingThrowProficiency).toHaveBeenCalledWith(
      'dexterity',
      true
    );
    expect(block('strength')).toHaveTextContent('Save +5');
  });

  it('cycles a skill dot through the store actions', () => {
    const { handlers } = setup({ editing: true });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Acrobatics: not proficient. Make proficient.',
      })
    );
    expect(handlers.onUpdateSkillProficiency).toHaveBeenLastCalledWith(
      'acrobatics',
      true
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Athletics: proficient. Add expertise.',
      })
    );
    expect(handlers.onUpdateSkillExpertise).toHaveBeenLastCalledWith(
      'athletics',
      true
    );
  });

  it('clears expertise before proficiency', () => {
    const calls: string[] = [];
    setup({
      editing: true,
      onUpdateSkillExpertise: (skill, on) =>
        calls.push(`expertise ${skill} ${on}`),
      onUpdateSkillProficiency: (skill, on) =>
        calls.push(`proficiency ${skill} ${on}`),
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Stealth: expertise. Remove proficiency.',
      })
    );
    expect(calls).toEqual([
      'expertise stealth false',
      'proficiency stealth false',
    ]);
  });

  it('says Jack of All Trades on a half dot', () => {
    const { handlers } = setup({ editing: true, jackOfAllTrades: true });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Acrobatics: Jack of All Trades. Make proficient.',
      })
    );
    expect(handlers.onUpdateSkillProficiency).toHaveBeenCalledWith(
      'acrobatics',
      true
    );
  });

  it('switches Jack of All Trades at the foot of the section', () => {
    const { handlers } = setup({ editing: true });
    const joat = screen.getByRole('switch', { name: 'Jack of All Trades' });
    expect(joat).toHaveAccessibleDescription(
      "Add half your proficiency bonus, rounded down, to checks with skills you're not proficient in."
    );
    expect(joat).not.toBeChecked();
    fireEvent.click(joat);
    expect(handlers.onToggleJackOfAllTrades).toHaveBeenCalledTimes(1);
  });

  it('shows bonus abilities as badges', () => {
    setup({ editing: true });
    const row = document.querySelector<HTMLElement>(
      '[data-skill="sleightOfHand"]'
    )!;
    expect(within(row).getByText('+WIS')).toBeInTheDocument();
    expect(within(row).getByText('+INT')).toBeInTheDocument();
  });

  it('chooses bonus abilities in a popover', async () => {
    const { handlers } = setup({ editing: true });
    const toggle = screen.getByRole('button', {
      name: 'Choose ability modifiers for Sleight of Hand',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const popover = screen.getByRole('dialog', {
      name: 'Add ability modifiers:',
    });
    const choices = within(popover).getAllByRole('button');
    expect(choices.map(b => b.textContent)).toEqual([
      'STR',
      'CON',
      'INT',
      'WIS',
      'CHA',
    ]);
    expect(
      within(popover).getByRole('button', { name: 'WIS' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(popover).getByRole('button', { name: 'STR' })
    ).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(popover).getByRole('button', { name: 'STR' }));
    expect(handlers.onToggleSkillBonusAbility).toHaveBeenCalledWith(
      'sleightOfHand',
      'strength'
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it('has no bonus ability control without a handler', () => {
    setup({ editing: true, onToggleSkillBonusAbility: undefined });
    expect(
      screen.queryByRole('button', { name: /^Choose ability modifiers/ })
    ).toBeNull();
  });
});

describe('AbilitiesSection controls by mode', () => {
  it('keeps the edit controls out of play mode', () => {
    setup({ editing: false });
    expect(
      screen.queryByRole('button', { name: /save proficiency$/ })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /\. Make proficient\.$/ })
    ).toBeNull();
    expect(
      screen.queryByRole('switch', { name: 'Jack of All Trades' })
    ).toBeNull();
    expect(screen.queryByText('+WIS')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Choose ability modifiers/ })
    ).toBeNull();
    // Plain medallions: no score editor.
    expect(
      screen.queryByRole('button', { name: /^Strength: modifier/ })
    ).toBeNull();
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

async function selectLayout(name: 'Compact' | '2014 sheet' | '2024 sheet') {
  await userEvent.click(screen.getByRole('combobox', { name: 'Layout' }));
  await userEvent.click(screen.getByRole('option', { name }));
}

describe('2014 sheet layout', () => {
  it('separates all six scores and saves from one alphabetical skill list', () => {
    localStorage.setItem('rollkeeper-ui-prefs', '{"abilityLayout":"2014"}');
    const { container } = setup({ editing: false });
    const scores = screen.getByRole('region', { name: 'Ability scores' });
    const saves = screen.getByRole('region', { name: 'Saving throws' });
    const skills = screen.getByRole('region', { name: 'Skills' });
    expect(within(scores).getAllByRole('heading', { level: 4 })).toHaveLength(
      6
    );
    expect(scores.querySelectorAll('[data-medallion]')).toHaveLength(6);
    expect(
      scores.querySelector('[data-saving-throw], [data-skill]')
    ).toBeNull();
    expect(
      Array.from(saves.querySelectorAll('[data-saving-throw]'), row =>
        row.getAttribute('data-saving-throw')
      )
    ).toEqual([
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
    ]);
    expect(within(skills).getAllByRole('list')).toHaveLength(1);
    expect(
      Array.from(skills.querySelectorAll('[data-skill]'), row =>
        row.getAttribute('data-skill')
      )
    ).toEqual([
      'acrobatics',
      'animalHandling',
      'arcana',
      'athletics',
      'deception',
      'history',
      'insight',
      'intimidation',
      'investigation',
      'medicine',
      'nature',
      'perception',
      'performance',
      'persuasion',
      'religion',
      'sleightOfHand',
      'stealth',
      'survival',
    ]);
    expect(within(skills).getByText('Acrobatics (Dex)')).toBeVisible();
    expect(within(skills).getByText('Athletics (Str)')).toBeVisible();
    expect(within(skills).getByText('Animal Handling (Wis)')).toBeVisible();
    expect(within(skills).getByText('Arcana (Int)')).toBeVisible();
    expect(within(skills).getByText('Persuasion (Cha)')).toBeVisible();
    const ids = Array.from(container.querySelectorAll('[id]'), node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses the shared totals, proficiency states and play-mode roll handlers', () => {
    localStorage.setItem('rollkeeper-ui-prefs', '{"abilityLayout":"2014"}');
    const { handlers } = setup({
      editing: false,
      getSavingThrowModifier: () => 17,
      getSkillModifier: () => 42,
    });
    const stealth = document.querySelector<HTMLElement>(
      '[data-skill="stealth"]'
    )!;
    expect(stealth).toHaveTextContent('+42');
    expect(
      within(stealth).getByRole('img', { name: 'Expertise' })
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Strength check' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Strength Save +17, proficient' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Stealth (Dex) check' })
    );
    expect(handlers.onRollAbilityCheck).toHaveBeenCalledWith('strength');
    expect(handlers.onRollSavingThrow).toHaveBeenCalledWith('strength');
    expect(handlers.onRollSkillCheck).toHaveBeenCalledWith('stealth');
    expect(
      screen.queryByRole('button', { name: /save proficiency$/ })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Strength: modifier/ })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Choose ability modifiers/ })
    ).toBeNull();
  });

  it('keeps proficiency, expertise, Jack of All Trades, bonus abilities and score editing shared', async () => {
    localStorage.setItem('rollkeeper-ui-prefs', '{"abilityLayout":"2014"}');
    const { handlers } = setup({ editing: true, jackOfAllTrades: true });
    fireEvent.click(
      screen.getByRole('button', { name: 'Strength save proficiency' })
    );
    expect(handlers.onUpdateSavingThrowProficiency).toHaveBeenCalledWith(
      'strength',
      false
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Stealth: expertise. Remove proficiency.',
      })
    );
    expect(handlers.onUpdateSkillExpertise).toHaveBeenCalledWith(
      'stealth',
      false
    );
    expect(handlers.onUpdateSkillProficiency).toHaveBeenCalledWith(
      'stealth',
      false
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Acrobatics: Jack of All Trades. Make proficient.',
      })
    );
    expect(handlers.onUpdateSkillProficiency).toHaveBeenCalledWith(
      'acrobatics',
      true
    );
    expect(
      screen.getAllByRole('switch', { name: 'Jack of All Trades' })
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('switch', { name: 'Jack of All Trades' }));
    expect(handlers.onToggleJackOfAllTrades).toHaveBeenCalledOnce();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose ability modifiers for Sleight of Hand',
      })
    );
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Add ability modifiers:' })
      ).getByRole('button', { name: 'WIS' })
    );
    expect(handlers.onToggleSkillBonusAbility).toHaveBeenCalledWith(
      'sleightOfHand',
      'wisdom'
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      screen.getByRole('button', { name: 'Strength: modifier +3, score 16' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(handlers.onUpdateAbilityScore).toHaveBeenCalledWith('strength', 17);
    expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull();
  });

  it('persists 2014 independently of number emphasis and keeps both existing layouts available', async () => {
    localStorage.setItem(
      'rollkeeper-ui-prefs',
      '{"abilityDisplay":"score","future":1}'
    );
    const { unmount, handlers } = setup({ editing: false });
    await selectLayout('2014 sheet');
    expect(screen.getByRole('switch', { name: 'Scores large' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem('rollkeeper-ui-prefs')!)).toEqual({
      abilityDisplay: 'score',
      abilityLayout: '2014',
      future: 1,
    });
    unmount();
    setup({ editing: false });
    expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveTextContent(
      '2014 sheet'
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveTextContent(
      '2014 sheet'
    );
    await selectLayout('2024 sheet');
    expect(block('strength')).toHaveClass('border');
    await selectLayout('Compact');
    expect(block('strength')).not.toHaveClass('border');
    expect(handlers.onUpdateAbilityScore).not.toHaveBeenCalled();
    expect(handlers.onUpdateSavingThrowProficiency).not.toHaveBeenCalled();
  });
});

describe('2024 sheet layout', () => {
  it('defaults to classic and remembers layout independently of number size', async () => {
    const { unmount } = setup({ editing: false });
    expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveTextContent(
      'Compact'
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    await selectLayout('2024 sheet');
    expect(block('strength')).toHaveClass('border');
    expect(
      screen.getByRole('img', { name: 'Strength: modifier +3, score 16' })
    ).toHaveAttribute('data-display', 'score');
    expect(JSON.parse(localStorage.getItem('rollkeeper-ui-prefs')!)).toEqual({
      abilityDisplay: 'score',
      abilityLayout: '2024',
    });
    unmount();
    setup({ editing: false });
    expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveTextContent(
      '2024 sheet'
    );
    expect(screen.getByRole('switch', { name: 'Scores large' })).toBeChecked();
    await selectLayout('Compact');
    expect(block('strength')).not.toHaveClass('border');
    expect(screen.getByRole('switch', { name: 'Scores large' })).toBeChecked();
  });

  it('keeps totals, expertise, save state and roll handlers in play mode', () => {
    localStorage.setItem('rollkeeper-ui-prefs', '{"abilityLayout":"2024"}');
    const { handlers } = setup({ editing: false });
    expect(screen.getAllByRole('listitem')).toHaveLength(18);
    expect(within(block('constitution')).queryByText('No skills')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Strength: modifier +3, score 16' })
    ).toHaveAttribute('data-save-proficient', 'true');
    const stealth = document.querySelector<HTMLElement>(
      '[data-skill="stealth"]'
    )!;
    expect(stealth).toHaveTextContent('+6');
    expect(
      within(stealth).getByRole('img', { name: 'Expertise' })
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Strength check' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll Strength Save +5, proficient' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll Stealth check' }));
    expect(handlers.onRollAbilityCheck).toHaveBeenCalledWith('strength');
    expect(handlers.onRollSavingThrow).toHaveBeenCalledWith('strength');
    expect(handlers.onRollSkillCheck).toHaveBeenCalledWith('stealth');
    expect(
      screen.queryByRole('button', { name: /save proficiency$/ })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Strength: modifier/ })
    ).toBeNull();
  });

  it('uses the same build controls and expertise actions in edit mode', async () => {
    localStorage.setItem('rollkeeper-ui-prefs', '{"abilityLayout":"2024"}');
    const { handlers } = setup({ editing: true, jackOfAllTrades: true });
    fireEvent.click(
      screen.getByRole('button', { name: 'Strength save proficiency' })
    );
    expect(handlers.onUpdateSavingThrowProficiency).toHaveBeenCalledWith(
      'strength',
      false
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Stealth: expertise. Remove proficiency.',
      })
    );
    expect(handlers.onUpdateSkillExpertise).toHaveBeenCalledWith(
      'stealth',
      false
    );
    expect(handlers.onUpdateSkillProficiency).toHaveBeenCalledWith(
      'stealth',
      false
    );
    expect(
      screen.getByRole('button', {
        name: 'Acrobatics: Jack of All Trades. Make proficient.',
      })
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Choose ability modifiers for Sleight of Hand',
      })
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Strength: modifier +3, score 16' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(handlers.onUpdateAbilityScore).toHaveBeenCalledWith('strength', 17);
  });
});

describe('AbilitiesSection with older data', () => {
  it('renders a save or a skill missing from the saved character', () => {
    const character = hero();
    const savingThrows: Partial<CharacterState['savingThrows']> = {
      ...character.savingThrows,
    };
    delete savingThrows.wisdom;
    const skills: Partial<CharacterState['skills']> = { ...character.skills };
    delete skills.insight;
    setup({
      editing: true,
      savingThrows: savingThrows as CharacterState['savingThrows'],
      skills: skills as CharacterState['skills'],
    });
    expect(
      screen.getByRole('button', { name: 'Wisdom save proficiency' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', {
        name: 'Insight: not proficient. Make proficient.',
      })
    ).toBeInTheDocument();
  });

  it('has no hover titles in edit mode, with the popover open', async () => {
    setup({ editing: true });
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose ability modifiers for Sleight of Hand',
      })
    );
    expect(
      screen.getByRole('dialog', { name: 'Add ability modifiers:' })
    ).toBeInTheDocument();
    expect(document.body.querySelector('[title]')).toBeNull();
  });
});
