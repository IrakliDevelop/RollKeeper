import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OverviewTab } from '../tabs/OverviewTab';
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
  const base = useCharacterStore.getState().character;
  // `migrateToMulticlass` (run by `loadCharacterState`) recomputes
  // `hitDicePools` from the legacy single-class fields whenever `classes`
  // is empty, which would silently discard the `hitDicePools` override
  // below. Pin `classes` (carrying it forward once set) so the override
  // sticks — a real store interaction the brief's verbatim seed doesn't
  // account for.
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
afterEach(() => cleanup());

describe('OverviewTab', () => {
  beforeEach(() => seed());

  it('spends a hit die through the store', () => {
    render(<OverviewTab addToast={vi.fn()} spellCasting={casting()} />);
    fireEvent.click(screen.getByRole('button', { name: /spend d10/i }));
    expect(useCharacterStore.getState().character.hitDicePools!.d10.used).toBe(
      2
    );
  });

  it('toggles heroic inspiration', () => {
    render(<OverviewTab addToast={vi.fn()} spellCasting={casting()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /heroic inspiration/i })
    );
    expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(
      1
    );
  });

  it('hides the spell slot section for non-casters', () => {
    render(<OverviewTab addToast={vi.fn()} spellCasting={casting()} />);
    expect(screen.queryByText(/spell slots/i)).toBeNull();
  });

  it('disables hit die spend when none remain', () => {
    cleanup();
    seed({ hitDicePools: { d10: { max: 2, used: 2 } } });
    render(<OverviewTab addToast={vi.fn()} spellCasting={casting()} />);
    expect(screen.getByRole('button', { name: /spend d10/i })).toBeDisabled();
  });
});
