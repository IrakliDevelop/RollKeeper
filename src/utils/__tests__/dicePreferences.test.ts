import { describe, expect, it } from 'vitest';
import { classic } from 'pollyroll/render';
import { parseDiceSet } from '@/utils/diceSet';
import { parseDicePreferences } from '@/utils/dicePreferences';

const options = {
  sound: 0.6,
  reducedMotion: 'always',
  shadows: false,
  maxDpr: 1,
  announce: true,
  fadeAfterMs: null,
  labels: {
    d6: ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'],
    dc: ['Tails', 'Heads'],
    dF: ['−', '', '+'],
  },
};
describe('saved dice renderer preferences', () => {
  it('round-trips the latest options without losing custom faces or changing the skin', () => {
    const saved = parseDiceSet(
      JSON.parse(JSON.stringify({ skin: classic, dieScale: 1.35, options }))
    );
    expect(saved?.options).toEqual(options);
    expect(saved?.skin).toEqual(classic);
    expect(saved?.dieScale).toBe(1.35);
  });
  it.each([
    { sound: NaN },
    { sound: 2 },
    { reducedMotion: 'sometimes' },
    { shadows: 'yes' },
    { maxDpr: Infinity },
    { maxDpr: 0.5 },
    { fadeAfterMs: -1 },
    { fadeAfterMs: 60001 },
    { labels: { d6: ['one'] } },
    { labels: { dc: ['Tails', 'x'.repeat(17)] } },
    { labels: { shader: ['code'] } },
  ])('rejects invalid preferences: %j', invalid => {
    expect(parseDicePreferences(invalid)).toBeNull();
    expect(parseDiceSet({ skin: classic, options: invalid })).toBeNull();
  });
  it('keeps legacy skins and dice sets valid with no new preferences', () => {
    expect(parseDiceSet(classic)?.options).toBeUndefined();
    expect(parseDiceSet({ skin: classic, dieScale: 1.8 })?.dieScale).toBe(1.8);
  });
});
