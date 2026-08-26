import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseDiceNotation,
  calculateRollSummary,
  formatDiceResults,
  hasCriticalSuccess,
  hasCriticalFailure,
  getRollResultColor,
  autoClearDice,
} from '@/utils/diceUtils';
import type { DiceResult } from '@/types/dice';

// Helper to build a DiceResult
function makeDie(sides: number, value: number): DiceResult {
  return {
    sides,
    value,
    dieType: `d${sides}`,
    groupId: 1,
    rollId: 1,
    theme: 'default',
    themeColor: '#fff',
  };
}

describe('parseDiceNotation', () => {
  it('parses standard "1d20" notation', () => {
    const result = parseDiceNotation('1d20');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.modifier).toBe(0);
    expect(result.originalNotation).toBe('1d20');
  });

  it('parses "3d6+5" with positive modifier', () => {
    const result = parseDiceNotation('3d6+5');
    expect(result.count).toBe(3);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(5);
  });

  it('parses "1d20-2" with negative modifier', () => {
    const result = parseDiceNotation('1d20-2');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.modifier).toBe(-2);
  });

  it('defaults count to 1 when omitted (e.g. "d8")', () => {
    const result = parseDiceNotation('d8');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(8);
    expect(result.modifier).toBe(0);
  });

  it('handles spaces in notation', () => {
    const result = parseDiceNotation('2d 10');
    expect(result.count).toBe(2);
    expect(result.sides).toBe(10);
  });

  it('is case-insensitive ("2D6")', () => {
    const result = parseDiceNotation('2D6');
    expect(result.count).toBe(2);
    expect(result.sides).toBe(6);
  });

  it('throws on invalid notation', () => {
    expect(() => parseDiceNotation('invalid')).toThrow();
    expect(() => parseDiceNotation('abc')).toThrow();
  });

  it('parses "+0" modifier as 0', () => {
    const result = parseDiceNotation('1d6');
    expect(result.modifier).toBe(0);
  });
});

describe('hasCriticalSuccess', () => {
  it('returns true when a d20 shows 20', () => {
    const results = [makeDie(20, 20)];
    expect(hasCriticalSuccess(results)).toBe(true);
  });

  it('returns false when a d20 shows less than 20', () => {
    const results = [makeDie(20, 19)];
    expect(hasCriticalSuccess(results)).toBe(false);
  });

  it('returns false for max roll on non-d20 dice', () => {
    const results = [makeDie(6, 6)];
    expect(hasCriticalSuccess(results)).toBe(false);
  });

  it('returns true if any die in mixed set crits', () => {
    const results = [makeDie(6, 3), makeDie(20, 20)];
    expect(hasCriticalSuccess(results)).toBe(true);
  });

  it('returns false for empty results', () => {
    expect(hasCriticalSuccess([])).toBe(false);
  });
});

describe('hasCriticalFailure', () => {
  it('returns true when a d20 shows 1', () => {
    const results = [makeDie(20, 1)];
    expect(hasCriticalFailure(results)).toBe(true);
  });

  it('returns false when a d20 shows more than 1', () => {
    const results = [makeDie(20, 2)];
    expect(hasCriticalFailure(results)).toBe(false);
  });

  it('returns false for a roll of 1 on a non-d20 die', () => {
    const results = [makeDie(6, 1)];
    expect(hasCriticalFailure(results)).toBe(false);
  });

  it('returns true if any die in mixed set fumbles', () => {
    const results = [makeDie(6, 4), makeDie(20, 1)];
    expect(hasCriticalFailure(results)).toBe(true);
  });

  it('returns false for empty results', () => {
    expect(hasCriticalFailure([])).toBe(false);
  });
});

describe('calculateRollSummary', () => {
  it('calculates correct total and finalTotal with no modifier', () => {
    const dice = [makeDie(6, 3), makeDie(6, 4)];
    const summary = calculateRollSummary(dice, '2d6');
    expect(summary.total).toBe(7);
    expect(summary.modifier).toBe(0);
    expect(summary.finalTotal).toBe(7);
    expect(summary.individualValues).toEqual([3, 4]);
  });

  it('applies positive modifier to finalTotal', () => {
    const dice = [makeDie(6, 3)];
    const summary = calculateRollSummary(dice, '1d6+2');
    expect(summary.total).toBe(3);
    expect(summary.modifier).toBe(2);
    expect(summary.finalTotal).toBe(5);
  });

  it('applies negative modifier to finalTotal', () => {
    const dice = [makeDie(20, 15)];
    const summary = calculateRollSummary(dice, '1d20-3');
    expect(summary.total).toBe(15);
    expect(summary.finalTotal).toBe(12);
  });

  it('preserves the notation string', () => {
    const dice = [makeDie(8, 5)];
    const summary = calculateRollSummary(dice, '1d8');
    expect(summary.notation).toBe('1d8');
  });
});

describe('formatDiceResults', () => {
  it('formats results with no modifier', () => {
    const dice = [makeDie(6, 3), makeDie(6, 4)];
    const summary = calculateRollSummary(dice, '2d6');
    const formatted = formatDiceResults(summary);
    expect(formatted).toBe('2d6: [3 + 4] = 7');
  });

  it('formats results with positive modifier', () => {
    const dice = [makeDie(20, 15)];
    const summary = calculateRollSummary(dice, '1d20+5');
    const formatted = formatDiceResults(summary);
    expect(formatted).toBe('1d20+5: [15] +5 = 20');
  });

  it('formats results with negative modifier', () => {
    const dice = [makeDie(20, 10)];
    const summary = calculateRollSummary(dice, '1d20-2');
    const formatted = formatDiceResults(summary);
    expect(formatted).toBe('1d20-2: [10] -2 = 8');
  });
});

describe('getRollResultColor', () => {
  it('returns green class on critical success', () => {
    const dice = [makeDie(20, 20)];
    const summary = calculateRollSummary(dice, '1d20');
    expect(getRollResultColor(summary)).toContain('green');
  });

  it('returns red class on critical failure', () => {
    const dice = [makeDie(20, 1)];
    const summary = calculateRollSummary(dice, '1d20');
    expect(getRollResultColor(summary)).toContain('red');
  });

  it('returns a normal class for a regular roll', () => {
    const dice = [makeDie(20, 10)];
    const summary = calculateRollSummary(dice, '1d20');
    const color = getRollResultColor(summary);
    expect(color).not.toContain('green');
    expect(color).not.toContain('red');
  });
});

describe('autoClearDice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls clear() on the diceBox after the delay', () => {
    vi.useFakeTimers();
    const diceBox = { clear: vi.fn() };
    autoClearDice(diceBox, 500);
    vi.advanceTimersByTime(500);
    expect(diceBox.clear).toHaveBeenCalledOnce();
  });

  it('calls the onClear callback after clearing', () => {
    vi.useFakeTimers();
    const diceBox = { clear: vi.fn() };
    const onClear = vi.fn();
    autoClearDice(diceBox, 100, onClear);
    vi.advanceTimersByTime(100);
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('does not call clear() before the delay elapses', () => {
    vi.useFakeTimers();
    const diceBox = { clear: vi.fn() };
    autoClearDice(diceBox, 1000);
    vi.advanceTimersByTime(500);
    expect(diceBox.clear).not.toHaveBeenCalled();
  });

  it('handles a diceBox with no clear function gracefully', () => {
    vi.useFakeTimers();
    const diceBox = {};
    expect(() => {
      autoClearDice(diceBox, 100);
      vi.advanceTimersByTime(100);
    }).not.toThrow();
  });
});
