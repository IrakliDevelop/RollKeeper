import { describe, expect, it } from 'vitest';

import { castCostAlertTitle } from './spellCastCost';

describe('castCostAlertTitle', () => {
  const spell = {
    name: 'Revivify',
    inventoryCost: { inventoryItemId: 'diamond', quantity: 1 },
  };

  it('names the item and the spell', () => {
    expect(
      castCostAlertTitle(spell, [{ id: 'diamond', name: 'Diamond (300 gp)' }])
    ).toBe('Not enough Diamond (300 gp) to cast Revivify');
  });

  it('says the linked item is gone when it was deleted', () => {
    expect(castCostAlertTitle(spell, [])).toBe(
      "Revivify's linked item is no longer in your inventory"
    );
  });
});
