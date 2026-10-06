import type {
  DieType,
  RollEvent,
  RollSummary as PollySummary,
} from 'pollyroll';
import type { DiceResult, RollSummary } from '@/types/dice';

const DIE_SIDES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
  dF: 1,
};

/** Maps a Pollyroll evaluation into the summary the sheet already displays. */
export function toRollSummary(
  event: RollEvent,
  summary: PollySummary,
  themeColor = '#1a1a1a'
): RollSummary {
  const individualValues: number[] = [];
  const diceResults: DiceResult[] = [];

  summary.groups.forEach((group, groupId) => {
    const kept = new Set(group.kept);
    group.dice.forEach((value, index) => {
      if (value === null || !kept.has(index)) return;
      individualValues.push(value);
      diceResults.push({
        sides: DIE_SIDES[group.die],
        dieType: group.die,
        groupId,
        rollId: index,
        theme: 'pollyroll',
        themeColor,
        value,
      });
    });
  });

  const modifier = summary.modifier;
  const diceTotal = individualValues.reduce((sum, value) => sum + value, 0);
  const finalTotal = summary.total ?? diceTotal + modifier;

  return {
    diceResults,
    individualValues,
    total: finalTotal - modifier,
    modifier,
    finalTotal,
    notation: event.notation,
    rollTime: new Date(event.createdAt),
    rollId: event.id,
  };
}
