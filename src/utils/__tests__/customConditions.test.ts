import { describe, it, expect } from 'vitest';
import {
  CUSTOM_CONDITION_DESCRIPTION_MAX,
  EMPTY_CUSTOM_CONDITIONS,
  createCustomCondition,
  generateCustomConditionId,
  normalizeCombatConfig,
  sanitizeCustomCondition,
} from '../customConditions';
import type { LegacyCombatConfig } from '../customConditions';

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
