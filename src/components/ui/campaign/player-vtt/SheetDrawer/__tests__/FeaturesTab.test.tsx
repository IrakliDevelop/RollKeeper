import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { FeaturesTab } from '../tabs/FeaturesTab';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

function seed(overrides: Partial<CharacterState> = {}) {
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    extendedFeatures: [
      {
        id: 'sw',
        name: 'Second Wind',
        sourceType: 'class',
        maxUses: 1,
        usedUses: 0,
        restType: 'short',
        displayOrder: 0,
        description: '<p>Heal 1d10 + level HP.</p>',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'dv',
        name: 'Darkvision',
        sourceType: 'race',
        maxUses: 0,
        usedUses: 0,
        restType: 'long',
        displayOrder: 0,
        isPassive: true,
        description: '<p>See in the dark.</p>',
        createdAt: '',
        updatedAt: '',
      },
    ],
    trackableTraits: [
      {
        id: 'luck',
        name: 'Lucky',
        maxUses: 3,
        usedUses: 1,
        restType: 'long',
        createdAt: '',
        updatedAt: '',
      },
    ],
    ...overrides,
  } as CharacterState);
}

function getChar() {
  return useCharacterStore.getState().character;
}

afterEach(() => cleanup());

describe('FeaturesTab', () => {
  beforeEach(() => seed());

  it('groups features by source', () => {
    render(<FeaturesTab />);
    expect(
      screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    ).toEqual(
      expect.arrayContaining([
        'Class Features',
        'Racial Features',
        'Tracked traits',
      ])
    );
  });

  it('spends and restores an extended feature use via pips', () => {
    render(<FeaturesTab />);
    fireEvent.click(screen.getByRole('button', { name: /use second wind/i }));
    expect(getChar().extendedFeatures.find(f => f.id === 'sw')!.usedUses).toBe(
      1
    );
    fireEvent.click(
      screen.getByRole('button', { name: /restore second wind/i })
    );
    expect(getChar().extendedFeatures.find(f => f.id === 'sw')!.usedUses).toBe(
      0
    );
  });

  it('spends and restores a tracked trait', () => {
    render(<FeaturesTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /use lucky/i })[0]);
    expect(getChar().trackableTraits.find(t => t.id === 'luck')!.usedUses).toBe(
      2
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: /restore lucky/i })[0]
    );
    expect(getChar().trackableTraits.find(t => t.id === 'luck')!.usedUses).toBe(
      1
    );
  });

  it('labels feature pips as a group with remaining of max', () => {
    render(<FeaturesTab />);
    expect(
      screen.getByRole('group', { name: /^second wind uses: \d+ of \d+$/i })
    ).toBeInTheDocument();
  });

  it('expands a description', () => {
    render(<FeaturesTab />);
    const toggle = screen.getByRole('button', { name: /^darkvision/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText('See in the dark.')).toBeInTheDocument();
  });

  it('pins a feature via its star, mirroring the legacy favorite flag', () => {
    render(<FeaturesTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Pin Second Wind' }));
    expect(getChar().sheetFavorites).toContainEqual({
      kind: 'feature',
      id: 'sw',
    });
    expect(getChar().favoriteFeatureIds).toContain('sw');
  });

  it('shows an empty state', () => {
    cleanup();
    seed({ extendedFeatures: [], trackableTraits: [] });
    render(<FeaturesTab />);
    expect(screen.getByText(/no features yet/i)).toBeInTheDocument();
  });
});
