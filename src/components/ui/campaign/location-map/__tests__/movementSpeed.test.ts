import { describe, it, expect } from 'vitest';
import {
  parseWalkingSpeed,
  movementRangeBands,
  characterWalkingSpeed,
  MOVEMENT_WITHIN_SPEED_COLOR,
  MOVEMENT_DASH_COLOR,
  walkFeetFromParsed,
  MOVEMENT_DEFAULT_WALK_FEET,
} from '../movementSpeed';
import type { CharacterState } from '@/types/character';

describe('parseWalkingSpeed', () => {
  // formatSpeed (bestiaryDataLoader.ts:71-93) emits walk FIRST with no mode
  // prefix: "30 ft., fly 60 ft.". Free-text NPC speeds may prefix "walk".
  it('parses the unprefixed leading walk entry', () => {
    expect(parseWalkingSpeed('30 ft., fly 60 ft.')).toEqual({
      kind: 'walk',
      feet: 30,
    });
  });
  it('parses an explicit walk prefix anywhere', () => {
    expect(parseWalkingSpeed('fly 60 ft., walk 25 ft.')).toEqual({
      kind: 'walk',
      feet: 25,
    });
  });
  it('parses a bare number and a bare "40 ft."', () => {
    expect(parseWalkingSpeed('40 ft.')).toEqual({ kind: 'walk', feet: 40 });
    expect(parseWalkingSpeed('40')).toEqual({ kind: 'walk', feet: 40 });
  });
  it('recognizes non-walking-only speeds as no-walk, NOT unknown', () => {
    expect(parseWalkingSpeed('fly 60 ft. (hover)')).toEqual({
      kind: 'no-walk',
    });
    expect(parseWalkingSpeed('swim 40 ft., burrow 10 ft.')).toEqual({
      kind: 'no-walk',
    });
  });
  it('recognizes a "can hover" segment as no-walk too (CAN_HOVER branch, untested until Task 3 review)', () => {
    expect(parseWalkingSpeed('fly 60 ft., can hover')).toEqual({
      kind: 'no-walk',
    });
  });
  it('returns unknown for empty/undefined/garbage', () => {
    expect(parseWalkingSpeed('')).toEqual({ kind: 'unknown' });
    expect(parseWalkingSpeed(undefined)).toEqual({ kind: 'unknown' });
    expect(parseWalkingSpeed('N/A')).toEqual({ kind: 'unknown' });
  });
});

describe('walkFeetFromParsed', () => {
  it('walk passes through, no-walk is 0 (never the default), unknown defaults', () => {
    expect(walkFeetFromParsed({ kind: 'walk', feet: 25 })).toBe(25);
    expect(walkFeetFromParsed({ kind: 'no-walk' })).toBe(0);
    expect(walkFeetFromParsed({ kind: 'unknown' })).toBe(
      MOVEMENT_DEFAULT_WALK_FEET
    );
  });
});

describe('movementRangeBands', () => {
  it('one band without dash, two with, dash doubles the first band', () => {
    expect(movementRangeBands(30, false)).toEqual([
      { feet: 30, color: MOVEMENT_WITHIN_SPEED_COLOR },
    ]);
    expect(movementRangeBands(30, true)).toEqual([
      { feet: 30, color: MOVEMENT_WITHIN_SPEED_COLOR },
      { feet: 60, color: MOVEMENT_DASH_COLOR },
    ]);
  });
  it('clamps a non-positive speed to no bands', () => {
    expect(movementRangeBands(0, true)).toEqual([]);
  });
});

describe('characterWalkingSpeed', () => {
  it('adds active speed buffs to base speed', () => {
    const character = {
      speed: 30,
      temporaryBuffs: [
        {
          isActive: true,
          effects: [{ targetStat: 'speed', mode: 'add', value: 10 }],
        },
      ],
    } as unknown as CharacterState;
    expect(characterWalkingSpeed(character)).toBe(40);
  });
});
