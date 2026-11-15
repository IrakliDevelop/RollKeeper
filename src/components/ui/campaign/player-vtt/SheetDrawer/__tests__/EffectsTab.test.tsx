import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  screen,
  fireEvent,
  act,
  cleanup,
  within,
} from '@testing-library/react';

import { EffectsTab } from '../tabs/EffectsTab';
import { renderWithTooltips, stubResizeObserver } from './renderWithTooltips';
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EffectsTab', () => {
  beforeEach(() => {
    stubResizeObserver();
    useCharacterStore.getState().resetCharacter();
    seed();
  });

  it('toggles a standard condition on and off', () => {
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
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
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    const chip = screen
      .getByText('Concentrating on Bless')
      .closest('[data-kind]');
    expect(chip).toHaveAttribute('data-kind', 'concentration');
    expect(screen.getByText(/^CON save [+-]\d+$/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'On damage: CON save, DC 10 or half the damage, whichever is higher.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Taking damage\?/)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /roll concentration/i })
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /end concentration/i })
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /end concentration/i }));
    expect(getChar().concentration.isConcentrating).toBe(false);
  });

  it('falls back to a bare label when concentrating without a spell name', () => {
    seed({ concentration: { isConcentrating: true } });
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    expect(screen.getByText('Concentrating')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it('titles each section with a level 4 heading', () => {
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 4, name: 'Concentration' })
    ).toBeInTheDocument();
    const titles = screen
      .getAllByRole('heading', { level: 4 })
      .map(heading => heading.textContent);
    expect(titles).toContain('Conditions');
    expect(titles).toContain('Exhaustion');
  });

  it('steps exhaustion with icon buttons, not text glyphs', () => {
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    expect(screen.queryByText('−')).toBeNull();
    expect(screen.queryByText('+')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Decrease exhaustion' })
    ).toBeDisabled();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows the not-concentrating empty state', () => {
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
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
    renderWithTooltips(<EffectsTab addToast={addToast} />);
    fireEvent.click(screen.getByRole('button', { name: /mage armor/i }));
    expect(getChar().temporaryBuffs![0].isActive).toBe(true);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Mage Armor on' })
    );
  });

  it('steps exhaustion and shows rules text', async () => {
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /increase exhaustion/i })
      );
    });
    expect(await screen.findByText(/−2 to d20 tests/)).toBeInTheDocument();
  });

  it('does not create duplicate conditions on a rapid double tap', () => {
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    const prone = screen.getByRole('button', { name: 'Prone' });
    // Both clicks land before React re-renders, so the second click still
    // sees the stale "inactive" closure.
    act(() => {
      prone.click();
      prone.click();
    });
    expect(active().filter(c => c.name === 'Prone')).toHaveLength(1);
  });

  it('lists other active effects and diseases, and removes an effect', () => {
    const base = getChar();
    seed({
      conditionsAndDiseases: {
        ...base.conditionsAndDiseases,
        activeConditions: [
          {
            id: 'prone-1',
            name: 'Prone',
            source: 'Self',
            description: '',
            stackable: false,
            count: 1,
            appliedAt: '',
            kind: 'debuff',
          },
          {
            id: 'bless-1',
            name: 'Bless',
            source: 'Map',
            description: '',
            stackable: false,
            count: 1,
            appliedAt: '',
            kind: 'buff',
          },
          {
            id: 'hex-1',
            name: 'Hexed',
            source: 'DM',
            description: '',
            stackable: true,
            count: 2,
            appliedAt: '',
          },
        ],
        activeDiseases: [
          {
            id: 'd1',
            name: 'Sewer Plague',
            source: 'DMG',
            description: '',
            appliedAt: '',
          },
        ],
      },
    });
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    const other = screen.getByRole('region', { name: /other active effects/i });
    expect(within(other).getByText('Bless')).toBeInTheDocument();
    expect(within(other).getByText('buff')).toBeInTheDocument();
    expect(within(other).getByText('×2')).toBeInTheDocument();
    expect(within(other).queryByText('Prone')).toBeNull();
    expect(within(other).getByText('Sewer Plague')).toBeInTheDocument();
    expect(
      within(other).getByRole('heading', { level: 5, name: 'Diseases' })
    ).toBeInTheDocument();
    expect(
      within(other).queryByRole('button', { name: /remove sewer plague/i })
    ).toBeNull();

    fireEvent.click(
      within(other).getByRole('button', { name: 'Remove Bless' })
    );
    expect(active().some(c => c.name === 'Bless')).toBe(false);
    expect(active().some(c => c.name === 'Prone')).toBe(true);
  });

  it('hides the other-effects section when nothing is active', () => {
    seed({
      conditionsAndDiseases: {
        ...getChar().conditionsAndDiseases,
        activeConditions: [],
        activeDiseases: [],
      },
    });
    renderWithTooltips(<EffectsTab addToast={vi.fn()} />);
    expect(
      screen.queryByRole('region', { name: /other active effects/i })
    ).toBeNull();
  });
});
