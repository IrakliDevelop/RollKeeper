import { describe, it, expect } from 'vitest';
import {
  calculateTotalWeight,
  calculateTotalValue,
  calculateEncumbrance,
} from '@/utils/encumbrance';
import { makeCharacter } from './test-utils';

describe('calculateTotalWeight', () => {
  it('returns 0 for an empty inventory', () => {
    const char = makeCharacter();
    expect(calculateTotalWeight(char)).toBe(0);
  });

  it('sums weapon weights', () => {
    const char = makeCharacter({
      weapons: [{ weight: 3 } as never, { weight: 2 } as never],
    });
    expect(calculateTotalWeight(char)).toBe(5);
  });

  it('treats missing weapon weight as 0', () => {
    const char = makeCharacter({
      weapons: [{ weight: undefined } as never],
    });
    expect(calculateTotalWeight(char)).toBe(0);
  });

  it('sums armor weights', () => {
    const char = makeCharacter({
      armorItems: [{ weight: 15 } as never, { weight: 6 } as never],
    });
    expect(calculateTotalWeight(char)).toBe(21);
  });

  it('multiplies item weight by quantity', () => {
    const char = makeCharacter({
      inventoryItems: [{ weight: 2, quantity: 3 } as never],
    });
    expect(calculateTotalWeight(char)).toBe(6);
  });

  it('defaults quantity to 1 when undefined', () => {
    const char = makeCharacter({
      inventoryItems: [{ weight: 4, quantity: undefined } as never],
    });
    expect(calculateTotalWeight(char)).toBe(4);
  });

  it('adds coin weight at 50 coins per pound', () => {
    const char = makeCharacter({
      currency: { gold: 50, silver: 0, copper: 0, electrum: 0, platinum: 0 },
    });
    expect(calculateTotalWeight(char)).toBe(1);
  });

  it('counts all coin types toward weight', () => {
    // 10 gold + 10 silver + 10 copper + 10 electrum + 10 platinum = 50 coins = 1 lb
    const char = makeCharacter({
      currency: {
        gold: 10,
        silver: 10,
        copper: 10,
        electrum: 10,
        platinum: 10,
      },
    });
    expect(calculateTotalWeight(char)).toBe(1);
  });

  it('combines all weight sources', () => {
    const char = makeCharacter({
      weapons: [{ weight: 3 } as never],
      armorItems: [{ weight: 15 } as never],
      inventoryItems: [{ weight: 1, quantity: 2 } as never],
      currency: { gold: 50, silver: 0, copper: 0, electrum: 0, platinum: 0 },
    });
    // 3 + 15 + 2 + 1 = 21
    expect(calculateTotalWeight(char)).toBe(21);
  });

  it('rounds to one decimal place', () => {
    // 5 coins = 0.1 lb
    const char = makeCharacter({
      currency: { gold: 5, silver: 0, copper: 0, electrum: 0, platinum: 0 },
    });
    expect(calculateTotalWeight(char)).toBe(0.1);
  });
});

describe('calculateTotalValue', () => {
  it('returns 0 for empty inventory', () => {
    const char = makeCharacter();
    expect(calculateTotalValue(char)).toBe(0);
  });

  it('sums weapon values', () => {
    const char = makeCharacter({
      weapons: [{ value: 100 } as never, { value: 50 } as never],
    });
    expect(calculateTotalValue(char)).toBe(150);
  });

  it('sums armor values', () => {
    const char = makeCharacter({
      armorItems: [{ value: 1500 } as never],
    });
    expect(calculateTotalValue(char)).toBe(1500);
  });

  it('multiplies item value by quantity', () => {
    const char = makeCharacter({
      inventoryItems: [{ value: 10, quantity: 4 } as never],
    });
    expect(calculateTotalValue(char)).toBe(40);
  });

  it('combines all value sources', () => {
    const char = makeCharacter({
      weapons: [{ value: 200 } as never],
      armorItems: [{ value: 100 } as never],
      inventoryItems: [{ value: 5, quantity: 3 } as never],
    });
    expect(calculateTotalValue(char)).toBe(315);
  });
});

describe('calculateEncumbrance', () => {
  // makeCharacter has STR 16 → capacity=240, encumberedAt=80, heavilyEncumberedAt=160

  it('returns normal status when carrying nothing', () => {
    const char = makeCharacter();
    const result = calculateEncumbrance(char);
    expect(result.status).toBe('normal');
    expect(result.totalWeight).toBe(0);
  });

  it('computes carry capacity as STR × 15', () => {
    const char = makeCharacter();
    const result = calculateEncumbrance(char);
    expect(result.carryCapacity).toBe(16 * 15); // 240
  });

  it('computes encumbered threshold as STR × 5', () => {
    const char = makeCharacter();
    const result = calculateEncumbrance(char);
    expect(result.encumberedAt).toBe(16 * 5); // 80
  });

  it('computes heavily encumbered threshold as STR × 10', () => {
    const char = makeCharacter();
    const result = calculateEncumbrance(char);
    expect(result.heavilyEncumberedAt).toBe(16 * 10); // 160
  });

  it('returns encumbered status when weight exceeds STR × 5', () => {
    // STR 16 → encumberedAt = 80. Use weapons totaling 81 lb.
    const char = makeCharacter({
      weapons: [{ weight: 81 } as never],
    });
    const result = calculateEncumbrance(char);
    expect(result.status).toBe('encumbered');
  });

  it('returns heavily-encumbered status when weight exceeds STR × 10', () => {
    // STR 16 → heavilyEncumberedAt = 160. Use 161 lb.
    const char = makeCharacter({
      weapons: [{ weight: 161 } as never],
    });
    const result = calculateEncumbrance(char);
    expect(result.status).toBe('heavily-encumbered');
  });

  it('returns over-capacity status when weight exceeds STR × 15', () => {
    // STR 16 → carryCapacity = 240. Use 241 lb.
    const char = makeCharacter({
      weapons: [{ weight: 241 } as never],
    });
    const result = calculateEncumbrance(char);
    expect(result.status).toBe('over-capacity');
  });

  it('defaults STR to 10 when abilities is undefined', () => {
    const char = makeCharacter({ abilities: undefined as never });
    const result = calculateEncumbrance(char);
    expect(result.carryCapacity).toBe(10 * 15); // 150
  });

  it('totalWeight in result matches calculateTotalWeight', () => {
    const char = makeCharacter({
      weapons: [{ weight: 5 } as never],
    });
    const result = calculateEncumbrance(char);
    expect(result.totalWeight).toBe(5);
  });
});
