import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { OverviewTab } from '../tabs/OverviewTab';
import { renderWithTooltips, stubResizeObserver } from './renderWithTooltips';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';
import type { SheetSpellCastingProps } from '../SheetDrawer.types';

function casting(): SheetSpellCastingProps {
  return {
    onCastPlacement: vi.fn(),
    connectionLive: true,
    hasPendingPlacement: false,
    onCancelPlacement: vi.fn(),
  };
}

function seed(overrides: Partial<CharacterState> = {}) {
  useCharacterStore.getState().resetCharacter();
  const base = useCharacterStore.getState().character;
  // `migrateToMulticlass` (run by `loadCharacterState`) recomputes
  // `hitDicePools` from the legacy single-class fields whenever `classes`
  // is empty, which would silently discard the `hitDicePools` override
  // below. Pin `classes` so the override sticks — a real store interaction
  // the brief's verbatim seed doesn't account for.
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
    hitDicePools: { d10: { max: 5, used: 1 } },
    heroicInspiration: { count: 0 },
    ...overrides,
  } as CharacterState);
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OverviewTab', () => {
  beforeEach(() => {
    stubResizeObserver();
    seed();
  });

  it('spends a hit die through the store', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /spend d10/i }));
    expect(useCharacterStore.getState().character.hitDicePools!.d10.used).toBe(
      2
    );
  });

  it('toggles heroic inspiration', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    const button = screen.getByRole('button', { name: 'Heroic inspiration' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveAttribute('data-selected');

    fireEvent.click(button);

    expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(
      1
    );
    const pressed = screen.getByRole('button', { name: 'Heroic inspiration' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(pressed).toHaveAttribute('data-selected', 'true');
  });

  it('shows heroic inspiration as one button with no heading or status text', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.queryByText('Ready')).toBeNull();
    expect(screen.queryByText('None')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: /heroic inspiration/i })
    ).toBeNull();
  });

  it('titles its sections in sentence case at level 4', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByRole('heading', { level: 4, name: 'Hit dice' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Senses & passives' })
    ).toBeInTheDocument();
  });

  it('labels each passive as a term in a definition list', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByText('Perception').tagName).toBe('DT');
  });

  it('spends a hit die with a secondary button', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByRole('button', { name: 'Spend d10' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
  });

  it('hides the spell slot section for non-casters', () => {
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.queryByText(/spell slots/i)).toBeNull();
  });

  it('disables hit die spend when none remain', () => {
    seed({ hitDicePools: { d10: { max: 2, used: 2 } } });
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByRole('button', { name: /spend d10/i })).toBeDisabled();
  });

  it('draws slot pips for each level and for pact slots on a caster', () => {
    const base = useCharacterStore.getState().character;
    seed({
      spellSlots: { ...base.spellSlots, 1: { max: 4, used: 1 } },
      pactMagic: { level: 2, slots: { max: 2, used: 1 } },
    } as Partial<CharacterState>);
    renderWithTooltips(
      <OverviewTab addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByRole('heading', { name: 'Spell slots' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 of 2 pact slots available' })
    ).toBeInTheDocument();
    expect(screen.getByText('Pact 2nd')).toBeInTheDocument();
  });
});
