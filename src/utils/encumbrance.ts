import { CharacterState } from '@/types/character';

export interface EncumbranceInfo {
  totalWeight: number;
  carryCapacity: number; // STR × 15
  encumberedAt: number; // STR × 5
  heavilyEncumberedAt: number; // STR × 10
  status: 'normal' | 'encumbered' | 'heavily-encumbered' | 'over-capacity';
}

/**
 * Calculate total carried weight from all sources:
 * weapons, armor, inventory items, and coins.
 */
export function calculateTotalWeight(char: CharacterState): number {
  let totalWeight = 0;

  for (const w of char.weapons ?? []) {
    totalWeight += w.weight ?? 0;
  }
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

  return Math.round(totalWeight * 10) / 10;
}

/**
 * Calculate total value of all carried items in copper pieces.
 */
export function calculateTotalValue(char: CharacterState): number {
  let totalValue = 0;

  for (const w of char.weapons ?? []) {
    totalValue += w.value ?? 0;
  }
  for (const a of char.armorItems ?? []) {
    totalValue += a.value ?? 0;
  }
  for (const item of char.inventoryItems ?? []) {
    totalValue += (item.value ?? 0) * (item.quantity ?? 1);
  }

  return totalValue;
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

  const totalWeight = calculateTotalWeight(char);

  let status: EncumbranceInfo['status'] = 'normal';
  if (totalWeight > carryCapacity) {
    status = 'over-capacity';
  } else if (totalWeight > heavilyEncumberedAt) {
    status = 'heavily-encumbered';
  } else if (totalWeight > encumberedAt) {
    status = 'encumbered';
  }

  return {
    totalWeight,
    carryCapacity,
    encumberedAt,
    heavilyEncumberedAt,
    status,
  };
}
