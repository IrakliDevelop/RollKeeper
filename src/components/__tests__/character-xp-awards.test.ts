import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { shouldLevelUp } from '@/utils/calculations';
import type { DmXpAward } from '@/types/sharedState';

function makeAward(overrides: Partial<DmXpAward> = {}): DmXpAward {
  return {
    id: 'award-1',
    mode: 'add',
    amount: 300,
    awardedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
}

function resetCharacter() {
  useCharacterStore.getState().resetCharacter();
}

describe('XP without auto-level', () => {
  beforeEach(resetCharacter);

  it('addExperience changes XP only — level, classes, hit dice untouched', () => {
    const before = useCharacterStore.getState().character;
    // 300 XP crosses the level-2 threshold for a fresh level-1 character
    useCharacterStore.getState().addExperience(300);
    const after = useCharacterStore.getState().character;
    expect(after.experience).toBe(before.experience + 300);
    expect(after.totalLevel).toBe(before.totalLevel);
    expect(after.level).toBe(before.level);
    expect(after.classes).toEqual(before.classes);
    expect(after.hitDicePools).toEqual(before.hitDicePools);
  });

  it('setExperience changes XP only and clamps below zero', () => {
    const before = useCharacterStore.getState().character;
    useCharacterStore.getState().setExperience(6500);
    expect(useCharacterStore.getState().character.experience).toBe(6500);
    expect(useCharacterStore.getState().character.totalLevel).toBe(
      before.totalLevel
    );
    useCharacterStore.getState().setExperience(-5);
    expect(useCharacterStore.getState().character.experience).toBe(0);
  });

  it('addExperience clamps the result at zero', () => {
    useCharacterStore.getState().setExperience(100);
    useCharacterStore.getState().addExperience(-500);
    expect(useCharacterStore.getState().character.experience).toBe(0);
  });

  it('derived pending: shouldLevelUp true above threshold, false below', () => {
    expect(shouldLevelUp(0, 1)).toBe(false);
    expect(shouldLevelUp(300, 1)).toBe(true); // level 2 at 300 XP
    expect(shouldLevelUp(299, 1)).toBe(false);
    // XP below the current level's floor never signals a (de-)level
    expect(shouldLevelUp(0, 5)).toBe(false);
    // Multi-level gap: pending persists until level catches up (2700 XP = level 4)
    expect(shouldLevelUp(2700, 1)).toBe(true);
    expect(shouldLevelUp(2700, 3)).toBe(true);
    expect(shouldLevelUp(2700, 4)).toBe(false);
  });
});

describe('applyDmXpAward', () => {
  beforeEach(resetCharacter);

  it('applies an add award and reports becamePending on threshold cross', () => {
    const result = useCharacterStore
      .getState()
      .applyDmXpAward(makeAward({ amount: 300 }));
    expect(result).toEqual({ status: 'applied', becamePending: true });
    const char = useCharacterStore.getState().character;
    expect(char.experience).toBe(300);
    expect(char.appliedDmXpAwardIds).toEqual(['award-1']);
    expect(char.level).toBe(1); // still level 1 — no auto-leveling
  });

  it('applies a set award', () => {
    const result = useCharacterStore
      .getState()
      .applyDmXpAward(makeAward({ id: 'a-set', mode: 'set', amount: 900 }));
    expect(result.status).toBe('applied');
    expect(useCharacterStore.getState().character.experience).toBe(900);
  });

  it('duplicate id is a no-op returning duplicate', () => {
    useCharacterStore.getState().applyDmXpAward(makeAward({ amount: 100 }));
    const result = useCharacterStore
      .getState()
      .applyDmXpAward(makeAward({ amount: 100 }));
    expect(result).toEqual({ status: 'duplicate', becamePending: false });
    expect(useCharacterStore.getState().character.experience).toBe(100);
    expect(useCharacterStore.getState().character.appliedDmXpAwardIds).toEqual([
      'award-1',
    ]);
  });

  it('becamePending is false when already pending before the award', () => {
    useCharacterStore.getState().setExperience(300); // already pending at level 1
    const result = useCharacterStore
      .getState()
      .applyDmXpAward(makeAward({ id: 'a-2', amount: 100 }));
    expect(result).toEqual({ status: 'applied', becamePending: false });
  });

  it('trims applied ids with append-and-slice(-150)', () => {
    for (let i = 0; i < 155; i++) {
      useCharacterStore
        .getState()
        .applyDmXpAward(makeAward({ id: `bulk-${i}`, amount: 1 }));
    }
    const ids = useCharacterStore.getState().character.appliedDmXpAwardIds!;
    expect(ids).toHaveLength(150);
    expect(ids[0]).toBe('bulk-5');
    expect(ids[149]).toBe('bulk-154');
  });
});
