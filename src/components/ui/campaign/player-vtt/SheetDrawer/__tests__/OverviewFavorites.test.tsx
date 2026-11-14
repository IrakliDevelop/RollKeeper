import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';

import { OverviewFavorites } from '../tabs/OverviewFavorites';
import { renderWithTooltips, stubResizeObserver } from './renderWithTooltips';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, Spell } from '@/types/character';
import type { SheetSpellCastingProps } from '../SheetDrawer.types';

const FIRE_BOLT: Spell = {
  id: 'firebolt',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: '1 action',
  range: '120 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Instantaneous',
  description: 'Test spell.',
  createdAt: '',
  updatedAt: '',
};

const MAGIC_MISSILE: Spell = {
  ...FIRE_BOLT,
  id: 'magicmissile',
  name: 'Magic Missile',
  level: 1,
  isPrepared: false,
};

function seed(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    classes: [{ className: 'Wizard', level: 3, isCustom: false, hitDie: 6 }],
    level: 3,
    totalLevel: 3,
    spells: [FIRE_BOLT],
    inventoryItems: [
      {
        id: 'ration1',
        name: 'Ration',
        category: 'consumable',
        quantity: 3,
        tags: [],
        createdAt: '',
        updatedAt: '',
      },
    ],
    extendedFeatures: [
      {
        id: 'sw',
        name: 'Second Wind',
        sourceType: 'class',
        maxUses: 1,
        usedUses: 0,
        restType: 'short',
        displayOrder: 0,
        description: '',
        createdAt: '',
        updatedAt: '',
      },
    ],
    sheetFavorites: [
      { kind: 'spell', id: 'firebolt' },
      { kind: 'item', id: 'ration1' },
      { kind: 'feature', id: 'sw' },
    ],
    favoriteFeatureIds: ['sw'],
    spellbook: { ...base.spellbook, favoriteSpells: ['firebolt'] },
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
  seed();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('OverviewFavorites', () => {
  it('shows a pinned spell with a working Cast button', () => {
    const addToast = vi.fn();
    renderWithTooltips(
      <OverviewFavorites addToast={addToast} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cast fire bolt/i }));
    expect(addToast).toHaveBeenCalled();
  });

  it('uses a pinned consumable, decrementing quantity', () => {
    const addToast = vi.fn();
    renderWithTooltips(
      <OverviewFavorites addToast={addToast} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /use ration/i }));
    expect(
      getChar().inventoryItems.find(i => i.id === 'ration1')!.quantity
    ).toBe(2);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Used Ration', message: '2 left' })
    );
  });

  it('shows the consumable quantity next to a pinned consumable row', () => {
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByText('consumable · ×3')).toBeInTheDocument();
  });

  it('spends a pinned feature use via its pip', () => {
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /use second wind/i }));
    expect(getChar().extendedFeatures.find(f => f.id === 'sw')!.usedUses).toBe(
      1
    );
  });

  it('removes a row when its star is unpinned', () => {
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin Fire Bolt' }));
    expect(screen.queryByText('Fire Bolt')).toBeNull();
    expect(getChar().sheetFavorites).not.toContainEqual({
      kind: 'spell',
      id: 'firebolt',
    });
  });

  it('shows the empty state when nothing is pinned', () => {
    seed({
      sheetFavorites: [],
      favoriteFeatureIds: [],
      spellbook: {
        ...useCharacterStore.getState().character.spellbook,
        favoriteSpells: [],
      },
    });
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByText(/nothing pinned\. tap the star/i)
    ).toBeInTheDocument();
  });

  it('titles the section at level 4 and drops the always-on hint', () => {
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByRole('heading', { level: 4, name: 'Favorites' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Star anything in other tabs to pin it here')
    ).toBeNull();
  });

  it('casts with a secondary button', () => {
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(
      screen.getByRole('button', { name: 'Cast Fire Bolt' })
    ).toHaveAttribute('data-variant', 'secondary');
  });

  it('says why a pinned spell cannot be cast in a visible caption, not a title', () => {
    seed({
      spells: [FIRE_BOLT, MAGIC_MISSILE],
      sheetFavorites: [
        { kind: 'spell', id: 'firebolt' },
        { kind: 'spell', id: 'magicmissile' },
      ],
      spellbook: {
        ...useCharacterStore.getState().character.spellbook,
        favoriteSpells: ['firebolt', 'magicmissile'],
      },
    });
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    const cast = screen.getByRole('button', { name: 'Cast Magic Missile' });
    expect(cast).toBeDisabled();
    expect(cast).not.toHaveAttribute('title');
    expect(screen.getAllByText('Not prepared or no slots left')).toHaveLength(
      1
    );
  });

  it('keeps Equipped as text on a pinned weapon', () => {
    seed({
      weapons: [
        {
          id: 'sword1',
          name: 'Longsword',
          category: 'martial',
          weaponType: ['melee'],
          damage: [{ dice: '1d8', type: 'slashing' }],
          enhancementBonus: 0,
          properties: [],
          isEquipped: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      sheetFavorites: [{ kind: 'item', id: 'sword1' }],
    } as Partial<CharacterState>);
    renderWithTooltips(
      <OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />
    );
    expect(screen.getByText('Equipped')).toBeInTheDocument();
  });
});
