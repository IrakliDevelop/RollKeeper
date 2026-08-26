import { describe, it, expect } from 'vitest';
import {
  parseAttachedSpells,
  buildChargePool,
  type ParsedAttachedSpells,
} from '@/utils/attachedSpellsParser';

describe('parseAttachedSpells', () => {
  it('returns empty result for empty input', () => {
    const result = parseAttachedSpells({});
    expect(result.poolAbilities).toHaveLength(0);
    expect(result.individualCharges).toHaveLength(0);
    expect(result.referenceSpells).toHaveLength(0);
    expect(result.castingAbility).toBeUndefined();
  });

  it('parses casting ability', () => {
    const result = parseAttachedSpells({ ability: 'int' });
    expect(result.castingAbility).toBe('int');
  });

  it('parses charges block into poolAbilities', () => {
    const result = parseAttachedSpells({
      charges: {
        '3': ['fireball'],
      },
    });
    expect(result.poolAbilities).toHaveLength(1);
    const ability = result.poolAbilities[0];
    expect(ability.name).toBe('Fireball');
    expect(ability.cost).toBe(3);
    expect(ability.isSpell).toBe(true);
    expect(ability.id).toBeTruthy();
  });

  it('parses multiple spells in charges with different costs', () => {
    const result = parseAttachedSpells({
      charges: {
        '1': ['magic missile'],
        '3': ['fireball'],
        '5': ['cone of cold'],
      },
    });
    expect(result.poolAbilities).toHaveLength(3);
    const costs = result.poolAbilities.map(a => a.cost).sort();
    expect(costs).toEqual([1, 3, 5]);
  });

  it('parses will block into poolAbilities with cost 0', () => {
    const result = parseAttachedSpells({
      will: ['pass without trace', 'shillelagh'],
    });
    expect(result.poolAbilities).toHaveLength(2);
    result.poolAbilities.forEach(a => {
      expect(a.cost).toBe(0);
      expect(a.description).toBe('At will');
    });
  });

  it('title-cases spell names', () => {
    const result = parseAttachedSpells({
      will: ['pass without trace'],
    });
    expect(result.poolAbilities[0].name).toBe('Pass Without Trace');
  });

  it('strips source suffix from spell name', () => {
    const result = parseAttachedSpells({
      will: ['misty step|phb'],
    });
    expect(result.poolAbilities[0].name).toBe('Misty Step');
  });

  it('parses ritual block into poolAbilities with "Ritual only" description', () => {
    const result = parseAttachedSpells({
      ritual: ['detect evil and good'],
    });
    expect(result.poolAbilities).toHaveLength(1);
    expect(result.poolAbilities[0].description).toBe('Ritual only');
    expect(result.poolAbilities[0].cost).toBe(0);
  });

  it('parses other block into poolAbilities with "Special" description', () => {
    const result = parseAttachedSpells({
      other: ['teleport'],
    });
    expect(result.poolAbilities).toHaveLength(1);
    expect(result.poolAbilities[0].description).toBe('Special');
    expect(result.poolAbilities[0].cost).toBe(0);
  });

  it('parses daily block into individualCharges with long rest type', () => {
    const result = parseAttachedSpells({
      daily: {
        '1': ['slow'],
        '1e': ['haste'],
      },
    });
    expect(result.individualCharges).toHaveLength(2);
    result.individualCharges.forEach(c => {
      expect(c.restType).toBe('long');
      expect(c.maxCharges).toBe(1);
      expect(c.usedCharges).toBe(0);
    });
  });

  it('parses rest block into individualCharges with short rest type', () => {
    const result = parseAttachedSpells({
      rest: {
        '2': ['invisibility'],
      },
    });
    expect(result.individualCharges).toHaveLength(1);
    expect(result.individualCharges[0].restType).toBe('short');
    expect(result.individualCharges[0].maxCharges).toBe(2);
    expect(result.individualCharges[0].name).toBe('Invisibility');
  });

  it('parses limited block into individualCharges with long rest type', () => {
    const result = parseAttachedSpells({
      limited: {
        '1': ['fly'],
      },
    });
    expect(result.individualCharges).toHaveLength(1);
    expect(result.individualCharges[0].restType).toBe('long');
  });

  it('parses _flat block into referenceSpells', () => {
    const result = parseAttachedSpells({
      _flat: ['detect magic', 'identify'],
    });
    expect(result.referenceSpells).toHaveLength(2);
    expect(result.referenceSpells).toContain('Detect Magic');
    expect(result.referenceSpells).toContain('Identify');
  });

  it('assigns unique ids to each poolAbility', () => {
    const result = parseAttachedSpells({
      will: ['light', 'mending', 'prestidigitation'],
    });
    const ids = result.poolAbilities.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('assigns unique ids to each individualCharge', () => {
    const result = parseAttachedSpells({
      daily: {
        '1': ['fireball', 'lightning bolt'],
      },
    });
    const ids = result.individualCharges.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('handles combined charges, will, daily, and references', () => {
    const result = parseAttachedSpells({
      charges: { '2': ['sleep'] },
      will: ['light'],
      daily: { '1': ['cure wounds'] },
      _flat: ['detect magic'],
    });
    expect(result.poolAbilities).toHaveLength(2); // charges + will
    expect(result.individualCharges).toHaveLength(1);
    expect(result.referenceSpells).toHaveLength(1);
  });
});

describe('buildChargePool', () => {
  const makeResult = (
    overrides: Partial<ParsedAttachedSpells> = {}
  ): ParsedAttachedSpells => ({
    poolAbilities: [],
    individualCharges: [],
    referenceSpells: [],
    ...overrides,
  });

  it('returns undefined when no poolAbilities', () => {
    expect(buildChargePool(makeResult())).toBeUndefined();
  });

  it('returns undefined when only at-will abilities and no item charges', () => {
    const parsed = makeResult({
      poolAbilities: [{ id: 'a1', name: 'Light', cost: 0, isSpell: true }],
    });
    expect(buildChargePool(parsed)).toBeUndefined();
  });

  it('builds a ChargePool when there are charged abilities', () => {
    const parsed = makeResult({
      poolAbilities: [{ id: 'a1', name: 'Fireball', cost: 3, isSpell: true }],
    });
    const pool = buildChargePool(parsed, 7, 'dawn');
    expect(pool).toBeDefined();
    expect(pool!.maxCharges).toBe(7);
    expect(pool!.usedCharges).toBe(0);
    expect(pool!.rechargeType).toBe('dawn');
    expect(pool!.abilities).toHaveLength(1);
  });

  it('defaults rechargeType to "dawn" for unknown recharge values', () => {
    const parsed = makeResult({
      poolAbilities: [{ id: 'a1', name: 'Sleep', cost: 1, isSpell: true }],
    });
    const pool = buildChargePool(parsed, 5, 'unknown_value');
    expect(pool!.rechargeType).toBe('dawn');
  });

  it('maps restLong recharge string to "long"', () => {
    const parsed = makeResult({
      poolAbilities: [
        { id: 'a1', name: 'Healing Word', cost: 1, isSpell: true },
      ],
    });
    const pool = buildChargePool(parsed, 3, 'restLong');
    expect(pool!.rechargeType).toBe('long');
  });

  it('maps restShort recharge string to "short"', () => {
    const parsed = makeResult({
      poolAbilities: [
        { id: 'a1', name: 'Cure Wounds', cost: 1, isSpell: true },
      ],
    });
    const pool = buildChargePool(parsed, 3, 'restShort');
    expect(pool!.rechargeType).toBe('short');
  });

  it('builds pool with only at-will abilities when itemCharges provided', () => {
    const parsed = makeResult({
      poolAbilities: [{ id: 'a1', name: 'Light', cost: 0, isSpell: true }],
    });
    const pool = buildChargePool(parsed, 3, 'dawn');
    expect(pool).toBeDefined();
    expect(pool!.maxCharges).toBe(3);
  });

  it('stores rechargeAmount when provided', () => {
    const parsed = makeResult({
      poolAbilities: [{ id: 'a1', name: 'Fireball', cost: 3, isSpell: true }],
    });
    const pool = buildChargePool(parsed, 7, 'dawn', '1d6+1');
    expect(pool!.rechargeAmount).toBe('1d6+1');
  });
});
