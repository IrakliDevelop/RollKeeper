import { describe, expect, it } from 'vitest';

import {
  buildOfficialConditions,
  selectCanonicalConditions,
} from '@/utils/officialConditions';

import type { ProcessedCondition } from '@/types/character';

const CONDITIONS: ProcessedCondition[] = [
  {
    id: 'poisoned-phb',
    name: 'Poisoned',
    source: 'PHB',
    description: '2014 text',
    isExhaustion: false,
    stackable: false,
  },
  {
    id: 'poisoned-xphb',
    name: 'Poisoned',
    source: 'XPHB',
    description: '2024 text',
    isExhaustion: false,
    stackable: false,
  },
];

describe('official conditions', () => {
  it('selects one entry per name and prefers XPHB', () => {
    expect(selectCanonicalConditions(CONDITIONS)).toEqual([CONDITIONS[1]]);
  });

  it('builds a stable NPC/combat snapshot with canonical metadata', () => {
    expect(buildOfficialConditions(CONDITIONS)).toEqual([
      {
        id: 'official-poisoned',
        name: 'Poisoned',
        description: '2024 text',
        icon: 'biohazard',
        kind: 'debuff',
        origin: 'official',
        rulesSource: 'XPHB',
      },
    ]);
  });
});
