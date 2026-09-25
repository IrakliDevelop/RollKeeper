import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import { AbilitiesTab } from '../tabs/AbilitiesTab';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

function getChar() {
  return useCharacterStore.getState().character;
}

function seed(overrides: Partial<CharacterState> = {}) {
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

afterEach(() => cleanup());

describe('AbilitiesTab', () => {
  beforeEach(() => seed());

  it('shows skill modifiers as plain values when rolls are off', () => {
    render(<AbilitiesTab locked />);
    expect(screen.getByText('Stealth')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll stealth/i })).toBeNull();
  });

  it('does not change proficiency while locked', () => {
    render(<AbilitiesTab locked />);
    expect(
      screen.queryByRole('button', { name: /stealth proficiency/i })
    ).toBeNull();
  });

  it('cycles skill proficiency none → proficient → expertise → none when unlocked', () => {
    render(<AbilitiesTab locked={false} />);
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
    render(<AbilitiesTab locked={false} />);
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
    render(<AbilitiesTab locked />);
    expect(
      screen.getByRole('img', { name: /stealth proficiency: /i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /wisdom save proficiency: /i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    ).toEqual(['Saving Throws', 'Proficiencies & Languages', 'Skills']);
  });

  it('toggles save proficiency when unlocked', () => {
    render(<AbilitiesTab locked={false} />);
    fireEvent.click(
      screen.getByRole('button', { name: /wisdom save proficiency/i })
    );
    expect(getChar().savingThrows.wisdom.proficient).toBe(true);
  });

  it('shows an explanatory title on the locked save proficiency dot', () => {
    seed({
      savingThrows: {
        ...getChar().savingThrows,
        wisdom: { proficient: false },
      },
    });
    render(<AbilitiesTab locked />);
    expect(
      screen.queryByRole('button', { name: /wisdom save proficiency/i })
    ).toBeNull();
    const wisdomRow = screen.getByText('Wisdom').parentElement as HTMLElement;
    expect(
      within(wisdomRow).getByTitle('Not proficient · unlock to change')
    ).toBeInTheDocument();
  });

  it('rolls a skill when a roll function is provided', () => {
    const roll = vi.fn().mockResolvedValue(undefined);
    render(<AbilitiesTab locked roll={roll} />);
    fireEvent.click(screen.getByRole('button', { name: /roll stealth/i }));
    expect(roll).toHaveBeenCalledWith('Stealth', expect.any(Number));
  });

  it('lists languages under proficiencies', () => {
    seed({
      languages: [{ id: 'l1', name: 'Elvish', createdAt: '', updatedAt: '' }],
    });
    render(<AbilitiesTab locked />);
    expect(screen.getByText('Elvish')).toBeInTheDocument();
  });
});
