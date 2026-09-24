import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';

import { EffectsTab } from '../tabs/EffectsTab';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

vi.mock('@/utils/conditionsDiseasesLoader', () => ({
  getExhaustionByVariant: vi.fn(async () => ({
    id: 'exhaustion-2024',
    name: 'Exhaustion',
    source: 'XPHB',
    description: 'rules',
    isExhaustion: true,
    stackable: true,
  })),
}));

function getChar() {
  return useCharacterStore.getState().character;
}

function active() {
  return getChar().conditionsAndDiseases.activeConditions;
}

function seed(overrides: Partial<CharacterState> = {}) {
  const base = useCharacterStore.getState().character;
  // `migrateToMulticlass` (run by `loadCharacterState`) recomputes
  // `hitDicePools` from the legacy single-class fields whenever `classes`
  // is empty — pin `classes` (carrying it forward once set) so it doesn't
  // clobber other fixture fields.
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

describe('EffectsTab', () => {
  beforeEach(() => seed());

  it('toggles a standard condition on and off', () => {
    render(<EffectsTab addToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Prone' }));
    expect(active().some(c => c.name === 'Prone')).toBe(true);
    expect(screen.getByRole('button', { name: 'Prone' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Prone' }));
    expect(active().some(c => c.name === 'Prone')).toBe(false);
  });

  it('shows concentration with the CON save modifier and ends it', () => {
    seed({ concentration: { isConcentrating: true, spellName: 'Bless' } });
    render(<EffectsTab addToast={vi.fn()} />);
    expect(screen.getByText(/concentrating on bless/i)).toBeInTheDocument();
    expect(screen.getByText(/con save/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /roll concentration/i })
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /end concentration/i }));
    expect(getChar().concentration.isConcentrating).toBe(false);
  });

  it('shows the not-concentrating empty state', () => {
    render(<EffectsTab addToast={vi.fn()} />);
    expect(screen.getByText(/not concentrating/i)).toBeInTheDocument();
  });

  it('toggles a buff with a toast', () => {
    seed({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Mage Armor',
          effects: [],
          isActive: false,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    const addToast = vi.fn();
    render(<EffectsTab addToast={addToast} />);
    fireEvent.click(screen.getByRole('button', { name: /mage armor/i }));
    expect(getChar().temporaryBuffs![0].isActive).toBe(true);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Mage Armor on' })
    );
  });

  it('steps exhaustion and shows rules text', async () => {
    render(<EffectsTab addToast={vi.fn()} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /increase exhaustion/i })
      );
    });
    expect(await screen.findByText(/−2 to d20 tests/)).toBeInTheDocument();
  });
});
