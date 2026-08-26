import { describe, expect, test } from 'vitest';

import { processMonster } from './bestiaryDataLoader';

import type { RawMonsterData } from '@/types/bestiary';

function makeRaw(overrides: Partial<RawMonsterData> = {}): RawMonsterData {
  return {
    name: 'Zombie',
    source: 'XMM',
    ...overrides,
  };
}

describe('processMonster token fields', () => {
  test('carries hasToken and raw source as tokenSource', () => {
    const m = processMonster(makeRaw({ hasToken: true }));
    expect(m.hasToken).toBe(true);
    expect(m.tokenSource).toBe('XMM');
  });

  test('hasToken defaults to false when absent in raw data', () => {
    const m = processMonster(makeRaw());
    expect(m.hasToken).toBe(false);
  });

  test('tokenSource stays raw even when display source is transformed', () => {
    const m = processMonster(makeRaw({ source: 'XPHB', hasToken: true }));
    expect(m.source).toBe('PHB2024'); // display transform
    expect(m.tokenSource).toBe('XPHB'); // raw code for URLs
  });
});
