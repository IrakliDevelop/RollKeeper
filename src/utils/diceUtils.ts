import { DiceRollResults, ParsedDiceNotation, RollSummary } from '@/types/dice';

/**
 * Parse dice notation like "3d12+5" or "1d20-2"
 */
export function parseDiceNotation(notation: string): ParsedDiceNotation {
  // Remove spaces
  const clean = notation.replace(/\s/g, '');
  
  // Match pattern like "3d12+5" or "1d20-2"
  const match = clean.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }
  
  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);
  const modifierStr = match[3] || '+0';
  const modifier = parseInt(modifierStr, 10);
  
  return {
    count,
    sides,
    modifier,
    originalNotation: notation
  };
}

/**
 * Calculate roll summary from dice results
 */
export function calculateRollSummary(
  diceResults: DiceRollResults, 
  notation: string
): RollSummary {
  const parsed = parseDiceNotation(notation);
  const individualValues = diceResults.map(die => die.value);
  const diceTotal = individualValues.reduce((sum, value) => sum + value, 0);
  const finalTotal = diceTotal + parsed.modifier;
  
  return {
    diceResults,
    individualValues,
    total: diceTotal,
    modifier: parsed.modifier,
    finalTotal,
    notation,
    rollTime: new Date(),
    rollId: generateRollId()
  };
}

/**
 * Generate a unique roll ID
 */
function generateRollId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format dice results for display
 */
export function formatDiceResults(summary: RollSummary): string {
  const { individualValues, modifier, finalTotal, notation } = summary;
  
  const diceStr = individualValues.join(' + ');
  
  if (modifier === 0) {
    return `${notation}: [${diceStr}] = ${finalTotal}`;
  } else {
    const modStr = modifier > 0 ? `+${modifier}` : `${modifier}`;
    return `${notation}: [${diceStr}] ${modStr} = ${finalTotal}`;
  }
}

/**
 * Check if a roll contains any maximum values (critical success indicator)
 */
export function hasCriticalSuccess(results: DiceRollResults): boolean {
  return results.some(die => die.value === die.sides && die.sides === 20);
}

/**
 * Check if a roll contains any minimum values (critical failure indicator)
 */
export function hasCriticalFailure(results: DiceRollResults): boolean {
  return results.some(die => die.value === 1 && die.sides === 20);
}

/**
 * Get color class based on roll results
 */
export function getRollResultColor(summary: RollSummary): string {
  if (hasCriticalSuccess(summary.diceResults)) {
    return 'text-green-600 font-bold'; // Critical success
  } else if (hasCriticalFailure(summary.diceResults)) {
    return 'text-red-600 font-bold'; // Critical failure
  } else {
    return 'text-gray-800'; // Normal roll
  }
}

/**
 * Auto-clear dice after a delay
 */
export function autoClearDice(
  diceBox: { clear?: () => void },
  delay: number = 3000,
  onClear?: () => void
): void {
  setTimeout(() => {
    try {
      if (diceBox && typeof diceBox.clear === 'function') {
        diceBox.clear();
        if (onClear) {
          onClear();
        }
      }
    } catch (error) {
      console.warn('Error during auto-clear dice:', error);
    }
  }, delay);
}