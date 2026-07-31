import { describe, it, expect, beforeAll } from 'vitest';

import { loadAllClasses } from '@/utils/classDataLoader';
import { ProcessedClass } from '@/types/classes';

// Loads the real json/class/*.json data — these tests pin the edition
// pairing between a class object and its feature descriptions, which share
// one classFeature[] array per file across PHB (2014) and XPHB (2024).
let classes: ProcessedClass[];

beforeAll(async () => {
  classes = await loadAllClasses();
});

function classBySource(name: string, source: string): ProcessedClass {
  const found = classes.find(c => c.name === name && c.source === source);
  expect(found, `${name} (${source}) should exist`).toBeDefined();
  return found!;
}

describe('class feature edition pairing', () => {
  it('2024 Druid Wild Shape uses the XPHB description, not the 2014 one', () => {
    const druid2024 = classBySource('Druid', 'PHB2024');
    const wildShape = druid2024.features.find(f => f.name === 'Wild Shape');
    expect(wildShape).toBeDefined();
    expect(wildShape!.source).toBe('XPHB');
    expect(wildShape!.is2024Rules).toBe(true);
  });

  it('2014 Druid Wild Shape still uses the PHB description', () => {
    const druid2014 = classBySource('Druid', 'PHB');
    const wildShape = druid2014.features.find(f => f.name === 'Wild Shape');
    expect(wildShape).toBeDefined();
    expect(wildShape!.source).toBe('PHB');
    expect(wildShape!.is2024Rules).toBe(false);
  });

  it('2024 Barbarian Rage uses the XPHB description (level-1 collision)', () => {
    const barbarian2024 = classBySource('Barbarian', 'PHB2024');
    const rage = barbarian2024.features.find(f => f.name === 'Rage');
    expect(rage).toBeDefined();
    expect(rage!.source).toBe('XPHB');
    expect(rage!.is2024Rules).toBe(true);
  });

  it('every 2024 class feature resolves to a non-2014 description when an XPHB entry exists', () => {
    // Broad guard: no feature on a PHB2024 class object may carry source PHB
    // when the very same name+level exists as an XPHB classFeature entry —
    // that is the shadowing bug this suite pins.
    for (const cls of classes.filter(c => c.source === 'PHB2024')) {
      for (const feature of cls.features) {
        expect(
          feature.source,
          `${cls.name} L${feature.level} ${feature.name}`
        ).not.toBe('PHB');
      }
    }
  });
});
