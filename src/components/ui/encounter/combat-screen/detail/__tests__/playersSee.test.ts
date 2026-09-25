import { describe, expect, it } from 'vitest';

import { playersSeeLabel, playersSeeSuffix } from '../playersSee';
import type { EncounterEntity } from '@/types/encounter';

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  };
}

describe('playersSeeLabel', () => {
  it('prefers a trimmed alias over everything else', () => {
    const entity = makeEntity({
      playerAlias: '  Mystery Foe  ',
      isHidden: true,
      name: 'Goblin Boss',
    });
    expect(playersSeeLabel(entity)).toBe('Mystery Foe');
  });

  it('falls back to "Enemy" when hidden with no alias', () => {
    const entity = makeEntity({ isHidden: true });
    expect(playersSeeLabel(entity)).toBe('Enemy');
  });

  it('falls back to the real name when visible with no alias', () => {
    const entity = makeEntity({ isHidden: false });
    expect(playersSeeLabel(entity)).toBe('Goblin Boss');
  });

  it('treats a whitespace-only alias as absent', () => {
    const entity = makeEntity({ playerAlias: '   ', isHidden: true });
    expect(playersSeeLabel(entity)).toBe('Enemy');
  });
});

describe('playersSeeSuffix', () => {
  it('returns the exact HP suffix when hpVisibleToPlayers is true', () => {
    expect(playersSeeSuffix(makeEntity({ hpVisibleToPlayers: true }))).toBe(
      ' · exact HP'
    );
  });

  it('returns an empty string when hpVisibleToPlayers is false or absent', () => {
    expect(playersSeeSuffix(makeEntity({ hpVisibleToPlayers: false }))).toBe(
      ''
    );
    expect(playersSeeSuffix(makeEntity())).toBe('');
  });
});
