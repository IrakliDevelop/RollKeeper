import { describe, expect, it } from 'vitest';

import {
  CHARACTER_FAMILY,
  characterFamilyKeys,
  isCharacterFamilyKey,
} from '@/lib/indexeddb/characterFamily';

describe('atomic character family', () => {
  it('contains only the legacy slot, every per-character envelope, and roster', () => {
    const keys = [
      'rollkeeper-dm-data',
      'rollkeeper-character:z',
      'rollkeeper-player-data',
      'rollkeeper-character',
      'rollkeeper-character:a',
      'rollkeeper-encounter-data',
    ];
    expect(characterFamilyKeys(keys)).toEqual([
      'rollkeeper-character',
      'rollkeeper-character:a',
      'rollkeeper-character:z',
      'rollkeeper-player-data',
    ]);
    expect(CHARACTER_FAMILY).toBe('character');
  });

  it.each([
    ['rollkeeper-character', true],
    ['rollkeeper-character:a', true],
    ['rollkeeper-player-data', true],
    ['rollkeeper-characteristic', false],
    ['rollkeeper-dm-data', false],
    ['location-canvas-a', false],
  ])('classifies %s', (key, expected) => {
    expect(isCharacterFamilyKey(key)).toBe(expected);
  });
});
