import { describe, it, expect, vi } from 'vitest';
import { d20Notation, rollD20 } from '@/utils/sheetRoll';
import type { RollSummary } from '@/types/dice';

describe('d20Notation', () => {
  it('formats positive, negative and zero modifiers', () => {
    expect(d20Notation(5)).toBe('1d20+5');
    expect(d20Notation(-1)).toBe('1d20-1');
    // Regression: the old inline code produced "1d200" for a +0 modifier.
    expect(d20Notation(0)).toBe('1d20');
  });
});

describe('rollD20', () => {
  it('uses the 3D dice result when ready', async () => {
    const showAttackRoll = vi.fn();
    const rollDice = vi
      .fn()
      .mockResolvedValue({ individualValues: [20] } as RollSummary);
    await rollD20({ diceReady: true, rollDice, showAttackRoll }, 'Stealth', 7);
    expect(rollDice).toHaveBeenCalledWith('1d20+7');
    expect(showAttackRoll).toHaveBeenCalledWith('Stealth', 20, 7, true);
  });

  it('falls back to random when dice are not ready', async () => {
    const showAttackRoll = vi.fn();
    await rollD20(
      { diceReady: false, showAttackRoll, random: () => 0.5 },
      'STR Save',
      2
    );
    expect(showAttackRoll).toHaveBeenCalledWith('STR Save', 11, 2, false);
  });

  it('falls back to random when the dice animation throws', async () => {
    const showAttackRoll = vi.fn();
    const rollDice = vi.fn().mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await rollD20(
      { diceReady: true, rollDice, showAttackRoll, random: () => 0 },
      'Init',
      3
    );
    expect(showAttackRoll).toHaveBeenCalledWith('Init', 1, 3, false);
    warn.mockRestore();
  });
});
