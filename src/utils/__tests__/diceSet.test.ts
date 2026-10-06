import { describe, expect, it } from 'vitest';
import { classic } from 'pollyroll/render';
import { clampDieScale, parseDiceSet } from '@/utils/diceSet';

describe('parseDiceSet', () => {
  it('accepts a bare preset skin and fills the default size', () => {
    expect(parseDiceSet(classic)).toEqual({ skin: classic, dieScale: 1 });
  });

  it('clamps die size and keeps a two-tone custom material', () => {
    const parsed = parseDiceSet({
      dieScale: 9,
      skin: {
        material: { metalness: 0.2, roughness: 0.4, transmission: 0.5 },
        color: ['#112233', '#abcdef'],
        labelColor: '#ffffff',
        pattern: 'marble',
      },
    });

    expect(parsed?.dieScale).toBe(2.5);
    expect(parsed?.skin.color).toEqual(['#112233', '#abcdef']);
    expect(parsed?.skin.pattern).toBe('marble');
  });

  it('rejects custom shader patterns and non-hex colors', () => {
    expect(
      parseDiceSet({
        material: 'plastic',
        color: '#ffffff',
        labelColor: '#000000',
        pattern: {
          glsl: 'vec3 pattern(vec3 p, vec3 n, vec3 a, vec3 b) { return a; }',
        },
      })
    ).toBeNull();
    expect(
      parseDiceSet({
        material: 'plastic',
        color: 'red',
        labelColor: '#000000',
      })
    ).toBeNull();
  });
});

describe('clampDieScale', () => {
  it('snaps to the slider step and stays in range', () => {
    expect(clampDieScale(2)).toBe(2);
    expect(clampDieScale(0.1)).toBe(0.75);
    expect(clampDieScale(1.02)).toBe(1);
  });
});
