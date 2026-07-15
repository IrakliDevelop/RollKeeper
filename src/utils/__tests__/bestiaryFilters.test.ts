import { describe, it, expect } from 'vitest';
import { rankMonstersByRelevance } from '@/utils/bestiaryFilters';
import { createMockProcessedMonster } from '@/test/helpers';

// Input arrays are alphabetical by name, matching how loadAllBestiary()
// pre-sorts the bestiary before filtering.
const names = (result: { name: string }[]) => result.map(m => m.name);

describe('rankMonstersByRelevance', () => {
  it('puts the exact name match first for "guard"', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'blackguard', name: 'Blackguard' }),
      createMockProcessedMonster({ id: 'drow-guard', name: 'Drow Guard' }),
      createMockProcessedMonster({ id: 'guard', name: 'Guard' }),
      createMockProcessedMonster({
        id: 'guardian-naga',
        name: 'Guardian Naga',
      }),
    ];
    const ranked = rankMonstersByRelevance(monsters, 'guard');
    expect(ranked[0].name).toBe('Guard');
  });

  it('orders by tier: exact, prefix, word boundary, substring, metadata-only', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'blackguard', name: 'Blackguard' }),
      createMockProcessedMonster({
        id: 'city-watch',
        name: 'City Watch',
        type: 'humanoid (guard)',
      }),
      createMockProcessedMonster({ id: 'drow-guard', name: 'Drow Guard' }),
      createMockProcessedMonster({ id: 'guard', name: 'Guard' }),
      createMockProcessedMonster({
        id: 'guardian-naga',
        name: 'Guardian Naga',
      }),
    ];
    const ranked = rankMonstersByRelevance(monsters, 'guard');
    expect(names(ranked)).toEqual([
      'Guard', // tier 0: exact
      'Guardian Naga', // tier 1: prefix
      'Drow Guard', // tier 2: word boundary
      'Blackguard', // tier 3: substring
      'City Watch', // tier 4: metadata-only
    ]);
  });

  it('preserves alphabetical input order within a tier', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'ashari', name: 'Ashari Stoneguard' }),
      createMockProcessedMonster({ id: 'blackguard', name: 'Blackguard' }),
      createMockProcessedMonster({
        id: 'doomguard',
        name: 'Doomguard Rot Blade',
      }),
    ];
    const ranked = rankMonstersByRelevance(monsters, 'guard');
    // Ashari Stoneguard and Blackguard are both tier 3 (substring, no word
    // boundary); Doomguard Rot Blade is also tier 3. Order must be unchanged.
    expect(names(ranked)).toEqual([
      'Ashari Stoneguard',
      'Blackguard',
      'Doomguard Rot Blade',
    ]);
  });

  it('is case-insensitive and trims the query', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'blackguard', name: 'Blackguard' }),
      createMockProcessedMonster({ id: 'guard', name: 'Guard' }),
    ];
    const ranked = rankMonstersByRelevance(monsters, '  GUARD ');
    expect(ranked[0].name).toBe('Guard');
  });

  it('does not throw on regex-special characters in the query', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'guard', name: 'Guard (Veteran)' }),
    ];
    expect(() => rankMonstersByRelevance(monsters, 'guard (')).not.toThrow();
    const ranked = rankMonstersByRelevance(monsters, 'guard (vet');
    expect(ranked[0].name).toBe('Guard (Veteran)');
  });

  it('returns input order unchanged for an empty/whitespace query', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'b', name: 'Bandit' }),
      createMockProcessedMonster({ id: 'a', name: 'Aboleth' }),
    ];
    expect(names(rankMonstersByRelevance(monsters, '  '))).toEqual([
      'Bandit',
      'Aboleth',
    ]);
  });

  it('does not mutate the input array', () => {
    const monsters = [
      createMockProcessedMonster({ id: 'blackguard', name: 'Blackguard' }),
      createMockProcessedMonster({ id: 'guard', name: 'Guard' }),
    ];
    const before = names(monsters);
    rankMonstersByRelevance(monsters, 'guard');
    expect(names(monsters)).toEqual(before);
  });
});
