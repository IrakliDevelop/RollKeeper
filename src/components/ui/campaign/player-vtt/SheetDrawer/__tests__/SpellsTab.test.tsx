import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';

import { SpellsTab } from '../tabs/SpellsTab';
import { renderWithTooltips, stubResizeObserver } from './renderWithTooltips';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, Spell } from '@/types/character';
import type { SheetSpellCastingProps } from '../SheetDrawer.types';

function makeSpell(
  overrides: Partial<Spell> & Pick<Spell, 'id' | 'name' | 'level'>
): Spell {
  return {
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test spell.',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const FIRE_BOLT = makeSpell({
  id: 'firebolt',
  name: 'Fire Bolt',
  level: 0,
  isPrepared: true,
});
const MAGIC_MISSILE = makeSpell({
  id: 'magicmissile',
  name: 'Magic Missile',
  level: 1,
  isPrepared: true,
});
const SHIELD = makeSpell({
  id: 'shield',
  name: 'Shield',
  level: 1,
  isPrepared: false,
  castingTime: '1 reaction',
  duration: '1 round',
});

function seedCaster(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    class: { name: 'Wizard', isCustom: false, spellcaster: 'full', hitDie: 6 },
    classes: [
      {
        className: 'Wizard',
        level: 3,
        isCustom: false,
        hitDie: 6,
        classSource: 'XPHB',
      },
    ],
    level: 3,
    totalLevel: 3,
    abilities: { ...base.abilities, intelligence: 16 },
    spellcastingStats: {
      spellcastingAbility: 'intelligence',
      isAbilityOverridden: false,
      spellAttackBonus: undefined,
      spellSaveDC: undefined,
    },
    spellSlots: {
      1: { max: 4, used: 0 },
      2: { max: 2, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    },
    concentration: { isConcentrating: false },
    reaction: { hasUsedReaction: false },
    spells: [FIRE_BOLT, MAGIC_MISSILE, SHIELD],
    ...overrides,
  } as CharacterState);
}

const getChar = () => useCharacterStore.getState().character;

function casting(
  overrides: Partial<SheetSpellCastingProps> = {}
): SheetSpellCastingProps {
  return {
    onCastPlacement: vi.fn(),
    connectionLive: true,
    hasPendingPlacement: false,
    onCancelPlacement: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  stubResizeObserver();
  useCharacterStore.getState().resetCharacter();
  seedCaster();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SpellsTab', () => {
  it('groups spells with cantrips first and shows slot pips', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent)
    ).toEqual(['Cantrips', '1st level']);
    expect(
      screen.getAllByRole('button', { name: /spend a level 1 slot/i })[0]
    ).toBeInTheDocument();
  });

  it('spends and restores a slot by tapping pips', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: /spend a level 1 slot/i })[0]
    );
    expect(getChar().spellSlots[1].used).toBe(1);
    fireEvent.click(
      screen.getAllByRole('button', { name: /restore a level 1 slot/i })[0]
    );
    expect(getChar().spellSlots[1].used).toBe(0);
  });

  it('casts a cantrip immediately', () => {
    const addToast = vi.fn();
    renderWithTooltips(
      <SpellsTab locked addToast={addToast} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cast fire bolt/i }));
    expect(addToast).toHaveBeenCalled();
  });

  it('disables Cast for unprepared leveled spells', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByRole('button', { name: /cast shield/i })).toBeDisabled();
  });

  it('toggles prepared only when unlocked', () => {
    const { rerender } = renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.queryByRole('button', { name: /prepare shield/i })
    ).toBeNull();
    rerender(
      <SpellsTab locked={false} addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /prepare shield/i }));
    expect(getChar().spells.find(s => s.name === 'Shield')!.isPrepared).toBe(
      true
    );
  });

  it('filters by search', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: /search spells/i }),
      {
        target: { value: 'fire' },
      }
    );
    expect(screen.queryByText('Magic Missile')).toBeNull();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
  });

  it('spends and restores a pact slot by tapping pips', () => {
    seedCaster({ pactMagic: { level: 2, slots: { max: 2, used: 0 } } });
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: /spend a pact slot/i })[0]
    );
    expect(getChar().pactMagic!.slots.used).toBe(1);
    fireEvent.click(
      screen.getAllByRole('button', { name: /restore a pact slot/i })[0]
    );
    expect(getChar().pactMagic!.slots.used).toBe(0);
  });

  it('labels each slot pip set as a group with remaining of max', () => {
    seedCaster({ pactMagic: { level: 2, slots: { max: 2, used: 1 } } });
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByRole('group', { name: /^\d of \d level 1 slots available$/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: '1 of 2 pact slots available' })
    ).toBeInTheDocument();
    expect(screen.getByText('Pact slots (2nd level)')).toBeInTheDocument();
    expect(screen.queryByText(/\d of \d slots$/)).toBeNull();
  });

  it('shows the no-spells empty state', () => {
    seedCaster({ spells: [] });
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByText(/no spells yet/i)).toBeInTheDocument();
  });

  it('shows the no-matches empty state', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: /search spells/i }),
      { target: { value: 'nonexistent spell' } }
    );
    expect(
      screen.getByText(/no spells match “nonexistent spell”/i)
    ).toBeInTheDocument();
  });

  it('unprepares a prepared leveled spell when unlocked', () => {
    renderWithTooltips(
      <SpellsTab locked={false} addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /unprepare magic missile/i })
    );
    expect(
      getChar().spells.find(s => s.name === 'Magic Missile')!.isPrepared
    ).toBe(false);
  });

  it('disables Cast without a hover title', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    const cast = screen.getByRole('button', { name: /cast shield/i });
    expect(cast).toBeDisabled();
    expect(cast).not.toHaveAttribute('title');
  });

  it('renders Cast as a secondary button', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByRole('button', { name: /cast fire bolt/i })
    ).toHaveAttribute('data-variant', 'secondary');
  });

  it('marks the prepare toggle with data-selected, not aria-pressed', () => {
    renderWithTooltips(
      <SpellsTab locked={false} addToast={vi.fn()} spellCasting={casting()} />
    );
    const prepare = screen.getByRole('button', { name: 'Prepare Shield' });
    expect(prepare).not.toHaveAttribute('data-selected');
    expect(prepare).not.toHaveAttribute('aria-pressed');
    const unprepare = screen.getByRole('button', {
      name: 'Unprepare Magic Missile',
    });
    expect(unprepare).toHaveAttribute('data-selected', 'true');
    expect(unprepare).not.toHaveAttribute('aria-pressed');
  });

  it('spells out concentration and ritual instead of C and R badges', () => {
    const detectMagic = makeSpell({
      id: 'detectmagic',
      name: 'Detect Magic',
      level: 1,
      concentration: true,
      ritual: true,
      isPrepared: true,
    });
    seedCaster({ spells: [FIRE_BOLT, MAGIC_MISSILE, SHIELD, detectMagic] });
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByText('Concentration · Ritual')).toBeInTheDocument();
    expect(screen.queryByText('C')).toBeNull();
    expect(screen.queryByText('R')).toBeNull();
  });

  it('pins a spell via its star, mirroring the legacy favorite flag', () => {
    renderWithTooltips(
      <SpellsTab locked addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin Fire Bolt' }));
    expect(getChar().sheetFavorites).toContainEqual({
      kind: 'spell',
      id: 'firebolt',
    });
    expect(getChar().spellbook?.favoriteSpells).toContain('firebolt');
  });

  it('shows no prepare toggle for an always-prepared spell', () => {
    const domainSpell = makeSpell({
      id: 'domainspell',
      name: 'Bless',
      level: 1,
      isPrepared: false,
      isAlwaysPrepared: true,
    });
    seedCaster({ spells: [FIRE_BOLT, MAGIC_MISSILE, SHIELD, domainSpell] });
    renderWithTooltips(
      <SpellsTab locked={false} addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.queryByRole('button', { name: /prepare bless/i })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /unprepare bless/i })
    ).toBeNull();
  });
});
