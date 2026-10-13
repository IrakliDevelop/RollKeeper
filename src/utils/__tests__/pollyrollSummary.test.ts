import { createRoll, evaluate, PollyrollSyntaxError } from 'pollyroll';
import { describe, expect, it } from 'vitest';
import { toRollSummary } from '@/utils/pollyrollSummary';

describe('toRollSummary', () => {
  it('keeps a +0 modifier as a normal d20 instead of a huge die', () => {
    const event = createRoll('1d20+0', { rng: () => 0 });
    const summary = toRollSummary(event, evaluate(event));

    expect(event.dice).toHaveLength(1);
    expect(event.dice[0]?.type).toBe('d20');
    expect(summary.individualValues).toEqual([1]);
    expect(summary.modifier).toBe(0);
    expect(summary.total).toBe(1);
    expect(summary.finalTotal).toBe(1);
    expect(summary.diceResults[0]?.sides).toBe(20);
  });

  it('reports the kept die for advantage and adds the modifier once', () => {
    const faces = [3, 14];
    let index = 0;
    const event = createRoll('2d20kh1+5', {
      rng: () => faces[index++] ?? 0,
    });
    const summary = toRollSummary(event, evaluate(event));

    expect(summary.individualValues).toEqual([15]);
    expect(summary.total).toBe(15);
    expect(summary.modifier).toBe(5);
    expect(summary.finalTotal).toBe(20);
  });

  it('rejects a die size created by gluing a zero modifier on', () => {
    expect(() => createRoll('1d200')).toThrow(PollyrollSyntaxError);
  });
});
