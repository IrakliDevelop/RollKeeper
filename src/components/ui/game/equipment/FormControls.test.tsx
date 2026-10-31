// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { useCharacterStore } from '@/store/characterStore';
import { ItemForm, initialInventoryFormData } from '../inventory/ItemForm';
import { MagicItemForm, type MagicItemFormData } from './MagicItemForm';
import { WeaponForm, type WeaponFormData } from './WeaponForm';

beforeEach(() => {
  useCharacterStore.setState({ character: makeCharacter() });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pool = {
  maxCharges: 4,
  usedCharges: 1,
  rechargeType: 'dawn' as const,
  abilities: [{ id: 'light', name: 'Light', cost: 1 }],
};

describe('populated inventory form controls', () => {
  it('names weapon damage, charge and shared ability removal', () => {
    const data: WeaponFormData = {
      name: 'Moonblade',
      category: 'magic',
      weaponType: ['melee'],
      damage: [
        { dice: '1d8', type: 'slashing', label: 'Slash' },
        { dice: '1d4', type: 'radiant', label: 'Glow' },
      ],
      enhancementBonus: 0,
      properties: [],
      isEquipped: false,
      charges: [
        { name: 'Radiance', maxCharges: 3, usedCharges: 0, restType: 'dawn' },
      ],
      chargePool: pool,
    };
    render(
      <WeaponForm
        formData={data}
        setFormData={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isEditing
      />
    );
    expect(
      screen.getByRole('button', { name: 'Remove damage Slash' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Remove charge ability Radiance' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Remove shared charge ability Light' })
    ).toBeVisible();
  });

  it('names magic item charge and shared ability removal', () => {
    const data: MagicItemFormData = {
      name: 'Moonstone',
      category: 'wondrous',
      rarity: 'rare',
      description: '',
      properties: [],
      requiresAttunement: false,
      isAttuned: false,
      charges: [
        { name: 'Pulse', maxCharges: 3, usedCharges: 0, restType: 'dawn' },
      ],
      chargePool: pool,
    };
    render(
      <MagicItemForm
        formData={data}
        setFormData={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isEditing
      />
    );
    expect(
      screen.getByRole('button', { name: 'Remove charge ability Pulse' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Remove shared charge ability Light' })
    ).toBeVisible();
  });

  it('removes a named tag from the shared item form', () => {
    const onSubmit = vi.fn();
    render(
      <ItemForm
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialData={{
          ...initialInventoryFormData,
          name: 'Rope',
          tags: ['quest'],
        }}
        availableLocations={['Backpack']}
        isEditing
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag quest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] })
    );
  });
});
