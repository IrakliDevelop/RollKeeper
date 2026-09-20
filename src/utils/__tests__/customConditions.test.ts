import { describe, it, expect } from 'vitest';
import {
  CUSTOM_CONDITION_DESCRIPTION_MAX,
  EMPTY_CUSTOM_CONDITIONS,
  cleanCustomConditions,
  collectInflictableConditions,
  createCustomCondition,
  generateCustomConditionId,
  normalizeCombatConfig,
  resolveInflictableConditions,
  sanitizeCustomCondition,
  toAppliedCondition,
} from '../customConditions';
import { createMockEncounterEntity } from '@/test/helpers';
import type { LegacyCombatConfig } from '../customConditions';
import type { MonsterStatBlock } from '@/types/encounter';

const baseConfig: LegacyCombatConfig = {
  enemyHpDisplay: 'off',
  hpStateBands: [],
  enemyConditionsDisplay: 'off',
};

describe('createCustomCondition', () => {
  it('defaults to an untitled-description debuff with the debuff fallback icon', () => {
    const created = createCustomCondition('  Marked  ');
    expect(created).toEqual({
      id: expect.stringMatching(/^cc-/),
      name: 'Marked',
      description: '',
      icon: 'trending-down',
      kind: 'debuff',
    });
  });

  it('defaults the icon from the overridden kind and honours overrides', () => {
    expect(createCustomCondition('Blessed', { kind: 'buff' }).icon).toBe(
      'trending-up'
    );
    expect(
      createCustomCondition('Cursed', { icon: 'skull', description: 'Bad.' })
    ).toMatchObject({ icon: 'skull', description: 'Bad.', kind: 'debuff' });
  });

  it('mints distinct ids', () => {
    expect(generateCustomConditionId()).not.toBe(generateCustomConditionId());
  });
});

describe('sanitizeCustomCondition', () => {
  it('rejects non-objects and entries without an id or name', () => {
    expect(sanitizeCustomCondition(null)).toBeNull();
    expect(sanitizeCustomCondition('Marked')).toBeNull();
    expect(sanitizeCustomCondition({ name: 'Marked' })).toBeNull();
    expect(sanitizeCustomCondition({ id: 'a', name: '   ' })).toBeNull();
  });

  it('repairs an unknown icon/kind and a missing description', () => {
    expect(
      sanitizeCustomCondition({
        id: 'a',
        name: 'Marked',
        icon: 'not-an-icon',
        kind: 'weird',
      })
    ).toEqual({
      id: 'a',
      name: 'Marked',
      description: '',
      icon: 'trending-down',
      kind: 'debuff',
    });
  });

  it('caps an oversized description', () => {
    const out = sanitizeCustomCondition({
      id: 'a',
      name: 'Marked',
      description: 'x'.repeat(CUSTOM_CONDITION_DESCRIPTION_MAX + 50),
      icon: 'skull',
      kind: 'neutral',
    });
    expect(out?.description).toHaveLength(CUSTOM_CONDITION_DESCRIPTION_MAX);
    expect(out?.kind).toBe('neutral');
  });
});

describe('normalizeCombatConfig', () => {
  it('maps legacy customStatuses strings to objects with deterministic ids and drops the legacy key', () => {
    const out = normalizeCombatConfig({
      ...baseConfig,
      customStatuses: ['Marked', 'Marked by Fate', '  ', 42],
    });
    expect(out.customConditions).toEqual([
      {
        id: 'legacy-marked',
        name: 'Marked',
        description: '',
        icon: 'trending-down',
        kind: 'debuff',
      },
      {
        id: 'legacy-marked-by-fate',
        name: 'Marked by Fate',
        description: '',
        icon: 'trending-down',
        kind: 'debuff',
      },
    ]);
    expect('customStatuses' in out).toBe(false);
  });

  it('is deterministic across calls so ids survive reloads before the first write', () => {
    const legacy = { ...baseConfig, customStatuses: ['Hexed!'] };
    expect(normalizeCombatConfig(legacy).customConditions).toEqual(
      normalizeCombatConfig(legacy).customConditions
    );
  });

  it('disambiguates legacy names that slug to the same id', () => {
    const out = normalizeCombatConfig({
      ...baseConfig,
      customStatuses: ['Hexed!', 'Hexed?'],
    });
    expect(out.customConditions?.map(c => c.id)).toEqual([
      'legacy-hexed',
      'legacy-hexed-2',
    ]);
  });

  it('keeps existing customConditions, sanitizes them, and skips legacy names they already cover', () => {
    const out = normalizeCombatConfig({
      ...baseConfig,
      customConditions: [
        {
          id: 'cc-1',
          name: 'Marked',
          description: 'Seen.',
          icon: 'eye',
          kind: 'neutral',
        },
      ],
      customStatuses: ['marked', 'Hexed'],
    });
    expect(out.customConditions?.map(c => c.name)).toEqual(['Marked', 'Hexed']);
    expect(out.customConditions?.[0].icon).toBe('eye');
  });

  it('returns the SAME object when there is nothing to migrate (persist byte-fixpoint)', () => {
    const untouched = { ...baseConfig, enemyHpDisplay: 'label' as const };
    expect(normalizeCombatConfig(untouched)).toBe(untouched);
    expect('customConditions' in normalizeCombatConfig(untouched)).toBe(false);

    const clean = {
      ...baseConfig,
      customConditions: [
        {
          id: 'cc-1',
          name: 'Marked',
          description: '',
          icon: 'eye' as const,
          kind: 'neutral' as const,
        },
      ],
    };
    expect(normalizeCombatConfig(clean)).toBe(clean);
  });

  it('repairs a dirty library even without the legacy key', () => {
    const out = normalizeCombatConfig({
      ...baseConfig,
      customConditions: [
        {
          id: 'cc-1',
          name: 'Marked',
          description: '',
          icon: 'not-an-icon',
          kind: 'neutral',
        },
      ] as unknown as LegacyCombatConfig['customConditions'],
    });
    expect(out.customConditions?.[0].icon).toBe('circle-dot');
  });

  it('exports a stable empty constant for selector fallbacks', () => {
    expect(EMPTY_CUSTOM_CONDITIONS).toEqual([]);
  });
});

describe('cleanCustomConditions', () => {
  it('trims, drops unnamed rows and later case-insensitive duplicates', () => {
    expect(
      cleanCustomConditions([
        {
          id: 'a',
          name: '  Marked ',
          description: ' Seen. ',
          icon: 'eye',
          kind: 'neutral',
        },
        { id: 'b', name: '', description: 'x', icon: 'skull', kind: 'debuff' },
        {
          id: 'c',
          name: 'marked',
          description: '',
          icon: 'skull',
          kind: 'debuff',
        },
      ])
    ).toEqual([
      {
        id: 'a',
        name: 'Marked',
        description: 'Seen.',
        icon: 'eye',
        kind: 'neutral',
      },
    ]);
  });
});

describe('resolveInflictableConditions', () => {
  const copy = {
    id: 'cc-web',
    name: 'Webbed',
    description: 'Old text.',
    icon: 'link',
    kind: 'debuff',
  } as const;

  it('returns [] for a missing stat block or field', () => {
    expect(resolveInflictableConditions(undefined, [])).toEqual([]);
    expect(resolveInflictableConditions({}, [])).toEqual([]);
  });

  it('lets a same-id library entry win so library edits reach every creature', () => {
    const library = [
      { ...copy, name: 'Web Snare', description: 'New text.', icon: 'anchor' },
    ] as const;
    expect(
      resolveInflictableConditions({ inflictableConditions: [copy] }, [
        ...library,
      ])
    ).toEqual([library[0]]);
  });

  it('uses the copy on a device without the library entry', () => {
    expect(
      resolveInflictableConditions({ inflictableConditions: [copy] }, [])
    ).toEqual([copy]);
  });

  it('sanitizes synced copies and dedupes by id', () => {
    const dirty = { ...copy, icon: 'not-an-icon' } as unknown as typeof copy;
    expect(
      resolveInflictableConditions({ inflictableConditions: [dirty, copy] }, [])
    ).toEqual([{ ...copy, icon: 'trending-down' }]);
  });
});

const webbed = {
  id: 'cc-web',
  name: 'Webbed',
  description: 'Restrained by sticky webbing.',
  icon: 'link',
  kind: 'debuff',
} as const;

function blockWith(
  inflictableConditions: MonsterStatBlock['inflictableConditions']
): MonsterStatBlock {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    saves: '',
    skills: '',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: '',
    passivePerception: 10,
    traits: [],
    actions: [],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'Beast',
    size: 'Large',
    languages: '',
    alignment: '',
    hpFormula: '',
    inflictableConditions,
  };
}

describe('collectInflictableConditions', () => {
  it('dedupes by id across creatures, keeps the first source, resolves through the library', () => {
    const entities = [
      createMockEncounterEntity({ id: 'p1', type: 'player', name: 'Aria' }),
      createMockEncounterEntity({
        id: 's1',
        name: 'Giant Spider',
        monsterStatBlock: blockWith([webbed]),
      }),
      createMockEncounterEntity({
        id: 's2',
        name: 'Giant Spider 2',
        monsterStatBlock: blockWith([webbed]),
      }),
    ];
    const library = [{ ...webbed, name: 'Web Snare' }];
    expect(collectInflictableConditions(entities, library)).toEqual([
      { condition: library[0], sourceName: 'Giant Spider' },
    ]);
  });

  it('returns [] when no combatant has a stat block or the field', () => {
    expect(
      collectInflictableConditions(
        [
          createMockEncounterEntity({ id: 'a' }),
          createMockEncounterEntity({
            id: 'b',
            monsterStatBlock: blockWith(undefined),
          }),
        ],
        []
      )
    ).toEqual([]);
  });
});

describe('toAppliedCondition', () => {
  it('builds the DM condition payload, omitting a blank description and source', () => {
    expect(toAppliedCondition(webbed, 'Giant Spider')).toEqual({
      name: 'Webbed',
      description: 'Restrained by sticky webbing.',
      icon: 'link',
      kind: 'debuff',
      source: 'dm',
      origin: 'custom',
      sourceEntity: 'Giant Spider',
    });
    expect(toAppliedCondition({ ...webbed, description: '   ' })).toEqual({
      name: 'Webbed',
      icon: 'link',
      kind: 'debuff',
      source: 'dm',
      origin: 'custom',
    });
  });
});
