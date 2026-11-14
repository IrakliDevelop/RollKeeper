import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';

import { AbilitiesTab } from '../tabs/AbilitiesTab';
import { renderWithTooltips, stubResizeObserver } from './renderWithTooltips';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

function getChar() {
  return useCharacterStore.getState().character;
}

function seed(overrides: Partial<CharacterState> = {}) {
  useCharacterStore.getState().resetCharacter();
  const base = useCharacterStore.getState().character;
  // `migrateToMulticlass` (run by `loadCharacterState`) recomputes
  // `hitDicePools`/multiclass fields from legacy single-class fields
  // whenever `classes` is empty — pin `classes` so overrides stick.
  const classes =
    base.classes && base.classes.length > 0
      ? base.classes
      : [
          {
            className: base.class?.name || 'Fighter',
            level: base.level || 1,
            isCustom: false,
            hitDie: base.class?.hitDie || 8,
          },
        ];
  useCharacterStore.getState().loadCharacterState({
    ...base,
    classes,
    ...overrides,
  } as CharacterState);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AbilitiesTab', () => {
  beforeEach(() => {
    stubResizeObserver();
    seed();
  });

  it('shows skill modifiers as plain values when rolls are off', () => {
    renderWithTooltips(<AbilitiesTab locked />);
    expect(screen.getByText('Stealth')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll stealth/i })).toBeNull();
  });

  it('does not change proficiency while locked', () => {
    renderWithTooltips(<AbilitiesTab locked />);
    expect(
      screen.queryByRole('button', { name: /stealth proficiency/i })
    ).toBeNull();
  });

  it('cycles skill proficiency none → proficient → expertise → none when unlocked', () => {
    renderWithTooltips(<AbilitiesTab locked={false} />);
    const btn = () =>
      screen.getByRole('button', { name: /stealth proficiency/i });
    fireEvent.click(btn());
    expect(getChar().skills.stealth).toMatchObject({
      proficient: true,
      expertise: false,
    });
    fireEvent.click(btn());
    expect(getChar().skills.stealth).toMatchObject({
      proficient: true,
      expertise: true,
    });
    fireEvent.click(btn());
    expect(getChar().skills.stealth).toMatchObject({
      proficient: false,
      expertise: false,
    });
  });

  it('announces the current skill proficiency level', () => {
    renderWithTooltips(<AbilitiesTab locked={false} />);
    expect(
      screen.getByRole('button', { name: 'Stealth proficiency: none' })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /stealth proficiency/i })
    );
    expect(
      screen.getByRole('button', { name: 'Stealth proficiency: proficient' })
    ).toBeInTheDocument();
  });

  it('labels locked proficiency dots as images and shows a Skills heading', () => {
    renderWithTooltips(<AbilitiesTab locked />);
    expect(
      screen.getByRole('img', { name: /stealth proficiency: /i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /wisdom save proficiency: /i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent)
    ).toEqual(['Saving throws', 'Proficiencies & languages', 'Skills']);
  });

  it('toggles save proficiency when unlocked', () => {
    renderWithTooltips(<AbilitiesTab locked={false} />);
    const dot = screen.getByRole('button', { name: 'Wisdom save proficiency' });
    expect(dot).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dot);
    expect(getChar().savingThrows.wisdom.proficient).toBe(true);
  });

  it('leaves a skill dot without a pressed state or a hover hint', () => {
    renderWithTooltips(<AbilitiesTab locked={false} />);
    const dot = screen.getByRole('button', {
      name: 'Stealth proficiency: none',
    });
    expect(dot).not.toHaveAttribute('aria-pressed');
    expect(dot).not.toHaveAttribute('title');
  });

  it('spells out the skills table header', () => {
    renderWithTooltips(<AbilitiesTab locked />);
    expect(screen.getByText('Ability')).toBeInTheDocument();
    expect(screen.getByText('Passive')).toBeInTheDocument();
    expect(screen.queryByText('Abl')).toBeNull();
  });

  it('shows a locked save dot as an image with no button and no hover hint', () => {
    renderWithTooltips(<AbilitiesTab locked />);
    expect(
      screen.getByRole('img', { name: 'Wisdom save proficiency: none' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Wisdom save proficiency' })
    ).toBeNull();
    expect(document.querySelector('[title]')).toBeNull();
  });

  it('rolls a skill when a roll function is provided', () => {
    const roll = vi.fn().mockResolvedValue(undefined);
    renderWithTooltips(<AbilitiesTab locked roll={roll} />);
    fireEvent.click(screen.getByRole('button', { name: /roll stealth/i }));
    expect(roll).toHaveBeenCalledWith('Stealth', expect.any(Number));
  });

  it('lists languages under proficiencies', () => {
    seed({
      languages: [{ id: 'l1', name: 'Elvish', createdAt: '', updatedAt: '' }],
    });
    renderWithTooltips(<AbilitiesTab locked />);
    expect(screen.getByText('Elvish')).toBeInTheDocument();
  });
});
