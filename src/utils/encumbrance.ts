import { CharacterState } from '@/types/character';

export interface EncumbranceInfo {
  totalWeight: number;
  carryCapacity: number; // STR × 15
  encumberedAt: number; // STR × 5
  heavilyEncumberedAt: number; // STR × 10
  status: 'normal' | 'encumbered' | 'heavily-encumbered' | 'over-capacity';
}

/**
 * Calculate encumbrance for a character based on D&D 5e rules.
 * Carry capacity = STR score × 15
 * Encumbered = STR × 5 (speed -10)
 * Heavily encumbered = STR × 10 (speed -20, disadvantage on checks)
 */
export function calculateEncumbrance(char: CharacterState): EncumbranceInfo {
  const strScore = char.abilities?.strength ?? 10;
  const carryCapacity = strScore * 15;
  const encumberedAt = strScore * 5;
  const heavilyEncumberedAt = strScore * 10;

  let totalWeight = 0;

  // Weapons don't have weight in the current type — skip
  for (const a of char.armorItems ?? []) {
    totalWeight += a.weight ?? 0;
  }
  for (const item of char.inventoryItems ?? []) {
    totalWeight += (item.weight ?? 0) * (item.quantity ?? 1);
  }

  // Coin weight: 50 coins = 1 lb
  const currency = char.currency;
  if (currency) {
    const totalCoins =
      (currency.copper ?? 0) +
      (currency.silver ?? 0) +
      (currency.electrum ?? 0) +
      (currency.gold ?? 0) +
      (currency.platinum ?? 0);
    totalWeight += totalCoins / 50;
  }

  let status: EncumbranceInfo['status'] = 'normal';
  if (totalWeight > carryCapacity) {
    status = 'over-capacity';
  } else if (totalWeight > heavilyEncumberedAt) {
    status = 'heavily-encumbered';
  } else if (totalWeight > encumberedAt) {
    status = 'encumbered';
  }

  return {
    totalWeight: Math.round(totalWeight * 10) / 10,
    carryCapacity,
    encumberedAt,
    heavilyEncumberedAt,
    status,
  };
}
