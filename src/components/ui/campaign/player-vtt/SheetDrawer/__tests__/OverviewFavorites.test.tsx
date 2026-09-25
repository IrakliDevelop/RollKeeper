import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { OverviewFavorites } from '../tabs/OverviewFavorites';
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

beforeEach(() => seed());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OverviewFavorites', () => {
  it('shows a pinned spell with a working Cast button', () => {
    const addToast = vi.fn();
    render(<OverviewFavorites addToast={addToast} spellCasting={casting()} />);
    fireEvent.click(screen.getByRole('button', { name: /cast fire bolt/i }));
    expect(addToast).toHaveBeenCalled();
  });

  it('uses a pinned consumable, decrementing quantity', () => {
    const addToast = vi.fn();
    render(<OverviewFavorites addToast={addToast} spellCasting={casting()} />);
    fireEvent.click(screen.getByRole('button', { name: /use ration/i }));
    expect(
      getChar().inventoryItems.find(i => i.id === 'ration1')!.quantity
    ).toBe(2);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Used Ration', message: '2 left' })
    );
  });

  it('spends a pinned feature use via its pip', () => {
    render(<OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />);
    fireEvent.click(screen.getByRole('button', { name: /use second wind/i }));
    expect(getChar().extendedFeatures.find(f => f.id === 'sw')!.usedUses).toBe(
      1
    );
  });

  it('removes a row when its star is unpinned', () => {
    render(<OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />);
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
    render(<OverviewFavorites addToast={vi.fn()} spellCasting={casting()} />);
    expect(
      screen.getByText(/nothing pinned\. tap the star/i)
    ).toBeInTheDocument();
  });
});
