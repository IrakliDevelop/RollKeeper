import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EquippedWeapons } from '@/components/EquippedWeapons';
import { NavigationContext } from '@/contexts/NavigationContext';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { Weapon } from '@/types/character';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const weapon: Weapon = {
  id: 'sun-blade',
  name: 'Sun Blade',
  category: 'martial',
  weaponType: ['melee'],
  damage: [{ dice: '1d8', type: 'slashing', versatiledice: '1d10' }],
  enhancementBonus: 1,
  properties: ['versatile'],
  isEquipped: true,
  charges: [
    {
      id: 'flame',
      name: 'Flame Tongue',
      maxCharges: 3,
      usedCharges: 1,
      restType: 'long',
    },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('EquippedWeapons actions', () => {
  it('keeps charge and roll actions usable as secondary coarse targets', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const restoreWeaponCharge = vi.fn();
    const expendWeaponCharge = vi.fn();
    const showDamageRoll = vi.fn();
    useCharacterStore.setState({
      character: makeCharacter({ weapons: [weapon] }),
      restoreWeaponCharge,
      expendWeaponCharge,
    });
    render(
      <NavigationContext.Provider value={{ switchToTab: vi.fn() }}>
        <EquippedWeapons
          showAttackRoll={vi.fn()}
          showDamageRoll={showDamageRoll}
        />
      </NavigationContext.Provider>
    );

    const restore = screen.getByTitle('Restore charge');
    const spend = screen.getByTitle('Use charge');
    expect(restore).toHaveClass('pointer-coarse:min-h-11');
    expect(spend).toHaveClass('pointer-coarse:min-h-11');
    fireEvent.click(restore);
    fireEvent.click(spend);
    expect(restoreWeaponCharge).toHaveBeenCalledWith('sun-blade', 'flame');
    expect(expendWeaponCharge).toHaveBeenCalledWith('sun-blade', 'flame');

    const versatile = screen.getByRole('button', { name: 'Versatile' });
    expect(versatile).not.toHaveAttribute('data-variant', 'primary');
    fireEvent.click(versatile);
    expect(showDamageRoll).toHaveBeenCalled();
  });
});
