import type { RollSummary } from '@/types/dice';

export interface D20RollDeps {
  diceReady: boolean;
  rollDice?: (notation: string) => Promise<RollSummary | null>;
  showAttackRoll: (
    label: string,
    roll: number,
    bonus: number,
    isCrit: boolean
  ) => void;
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number;
}

export function d20Notation(modifier: number): string {
  if (modifier === 0) return '1d20';
  return modifier > 0 ? `1d20+${modifier}` : `1d20${modifier}`;
}

/** Rolls 1d20 + modifier with the 3D dice when available, else Math.random. */
export async function rollD20(
  deps: D20RollDeps,
  label: string,
  modifier: number
): Promise<void> {
  if (deps.diceReady && deps.rollDice) {
    try {
      const summary = await deps.rollDice(d20Notation(modifier));
      if (summary && 'individualValues' in summary) {
        const roll = summary.individualValues[0] || 1;
        deps.showAttackRoll(label, roll, modifier, roll === 20);
        return;
      }
    } catch (error) {
      console.warn(
        'Dice animation failed, falling back to random roll:',
        error
      );
    }
  }
  const roll = Math.floor((deps.random ?? Math.random)() * 20) + 1;
  deps.showAttackRoll(label, roll, modifier, roll === 20);
}
