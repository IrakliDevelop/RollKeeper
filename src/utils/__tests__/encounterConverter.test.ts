import { describe, it, expect } from 'vitest';
import {
  monsterToEncounterEntity,
  createLairEntity,
} from '@/utils/encounterConverter';
import { createMockProcessedMonster } from '@/test/helpers';

describe('monsterToEncounterEntity', () => {
  it('converts basic monster stats', () => {
    const monster = createMockProcessedMonster();
    const entity = monsterToEncounterEntity(monster);

    expect(entity.type).toBe('monster');
    expect(entity.name).toBe('Adult Red Dragon');
    expect(entity.currentHp).toBe(256);
    expect(entity.maxHp).toBe(256);
    expect(entity.tempHp).toBe(0);
    expect(entity.armorClass).toBe(19);
    expect(entity.initiative).toBeNull();
    expect(entity.conditions).toEqual([]);
    expect(entity.monsterSourceId).toBe('adult-red-dragon');
  });

  it('calculates initiative modifier from DEX', () => {
    // DEX 10 → mod 0
    const entity = monsterToEncounterEntity(
      createMockProcessedMonster({ dex: 10 })
    );
    expect(entity.initiativeModifier).toBe(0);

    // DEX 16 → mod 3
    const entity2 = monsterToEncounterEntity(
      createMockProcessedMonster({ dex: 16 })
    );
    expect(entity2.initiativeModifier).toBe(3);

    // DEX 8 → mod -1
    const entity3 = monsterToEncounterEntity(
      createMockProcessedMonster({ dex: 8 })
    );
    expect(entity3.initiativeModifier).toBe(-1);
  });

  it('applies hpOverride', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster(), {
      hpOverride: 100,
    });
    expect(entity.currentHp).toBe(100);
    expect(entity.maxHp).toBe(100);
  });

  it('applies acOverride', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster(), {
      acOverride: 25,
    });
    expect(entity.armorClass).toBe(25);
  });

  it('applies nameOverride and color', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster(), {
      nameOverride: 'Smaug',
      color: '#ff0000',
    });
    expect(entity.name).toBe('Smaug');
    expect(entity.color).toBe('#ff0000');
  });

  it('applies abilityScoreOverrides and recalculates initiative modifier', () => {
    const entity = monsterToEncounterEntity(
      createMockProcessedMonster({ dex: 10 }),
      { abilityScoreOverrides: { dex: 20 } }
    );
    // DEX 20 → mod 5
    expect(entity.initiativeModifier).toBe(5);
    expect(entity.monsterStatBlock!.dex).toBe(20);
  });

  // ── Stat block ──

  it('populates monsterStatBlock', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster());
    const sb = entity.monsterStatBlock!;

    expect(sb.str).toBe(27);
    expect(sb.dex).toBe(10);
    expect(sb.cr).toBe('17');
    expect(sb.type).toBe('Dragon');
    expect(sb.size).toBe('Large');
    expect(sb.traits).toHaveLength(1);
    expect(sb.actions).toHaveLength(2);
    expect(sb.reactions).toHaveLength(1);
    expect(sb.immunities).toBe('fire');
    expect(sb.hpFormula).toBe('19d12+133');
  });

  it('handles object type format', () => {
    const entity = monsterToEncounterEntity(
      createMockProcessedMonster({ type: { type: 'Humanoid', tags: ['elf'] } })
    );
    expect(entity.monsterStatBlock!.type).toBe('Humanoid');
  });

  // ── Abilities ──

  it('parses recharge abilities from actions', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster());
    const fireBreath = entity.abilities!.find(a => a.name === 'Fire Breath');

    expect(fireBreath).toBeDefined();
    expect(fireBreath!.usageType).toBe('recharge');
    expect(fireBreath!.rechargeOn).toBe(5);
    expect(fireBreath!.usedUses).toBe(0);
  });

  it('parses per-day abilities from traits', () => {
    const monster = createMockProcessedMonster({
      traits: [
        {
          name: 'Legendary Resistance (3/Day)',
          text: 'If the dragon fails a saving throw, it can choose to succeed instead.',
        },
      ],
    });
    const entity = monsterToEncounterEntity(monster);
    const legRes = entity.abilities!.find(a =>
      a.name.includes('Legendary Resistance')
    );

    expect(legRes).toBeDefined();
    expect(legRes!.usageType).toBe('per-day');
  });

  it('parses per-rest abilities', () => {
    const monster = createMockProcessedMonster({
      actions: [
        {
          name: 'Animate Chains (Recharges after a Short or Long Rest)',
          text: 'Chains animate.',
        },
      ],
      traits: [],
    });
    const entity = monsterToEncounterEntity(monster);
    const ability = entity.abilities!.find(a => a.name === 'Animate Chains');

    expect(ability).toBeDefined();
    expect(ability!.usageType).toBe('per-rest');
    expect(ability!.restType).toBe('short');
  });

  it('parses long rest abilities', () => {
    const monster = createMockProcessedMonster({
      actions: [
        {
          name: 'Divine Word (Recharges after a Long Rest)',
          text: 'Speaks a holy word.',
        },
      ],
      traits: [],
    });
    const entity = monsterToEncounterEntity(monster);
    const ability = entity.abilities!.find(a => a.name === 'Divine Word');

    expect(ability).toBeDefined();
    expect(ability!.usageType).toBe('per-rest');
    expect(ability!.restType).toBe('long');
  });

  // ── Legendary Actions ──

  it('builds legendary action pool', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster());
    const la = entity.legendaryActions!;

    expect(la.maxActions).toBe(3);
    expect(la.usedActions).toBe(0);
    expect(la.actions).toHaveLength(3);
  });

  it('parses cost from legendary action names', () => {
    const entity = monsterToEncounterEntity(createMockProcessedMonster());
    const la = entity.legendaryActions!;

    const detect = la.actions.find(a => a.name === 'Detect')!;
    const wingAttack = la.actions.find(a => a.name === 'Wing Attack')!;

    expect(detect.cost).toBe(1);
    expect(wingAttack.cost).toBe(2);
  });

  it('returns undefined legendaryActions when monster has none', () => {
    const entity = monsterToEncounterEntity(
      createMockProcessedMonster({
        legendaryActions: undefined,
        legendaryActionCount: 0,
      })
    );
    expect(entity.legendaryActions).toBeUndefined();
  });

  // ── Spellcasting ──

  it('extracts spellcasting data', () => {
    const monster = createMockProcessedMonster({
      spellcastingEntries: [
        {
          name: 'Spellcasting',
          headerText: 'The dragon is a 5th-level spellcaster.',
          ability: 'Charisma',
          dc: 19,
          toHit: 11,
          spells: {
            '0': { spells: ['fire bolt', 'mage hand'] },
            '1': { slots: 4, spells: ['shield', 'magic missile'] },
            '2': { slots: 3, spells: ['misty step', 'scorching ray'] },
          },
        },
      ],
    });
    const entity = monsterToEncounterEntity(monster);
    const sc = entity.spellcasting!;

    expect(sc.ability).toBe('Charisma');
    expect(sc.dc).toBe(19);
    expect(sc.toHit).toBe(11);
    expect(sc.atWill).toEqual(['fire bolt', 'mage hand']);
    expect(sc.slots!['1']).toEqual({ max: 4, used: 0 });
    expect(sc.slots!['2']).toEqual({ max: 3, used: 0 });
  });

  it('returns undefined spellcasting when monster has none', () => {
    const entity = monsterToEncounterEntity(
      createMockProcessedMonster({ spellcastingEntries: undefined })
    );
    expect(entity.spellcasting).toBeUndefined();
  });
});

describe('createLairEntity', () => {
  it('creates a lair entity with initiative 20', () => {
    const entity = createLairEntity('Red Dragon', [
      { name: 'Magma Eruption', description: 'Lava bursts from the ground.' },
    ]);

    expect(entity.type).toBe('lair');
    expect(entity.name).toBe("Red Dragon's Lair");
    expect(entity.initiative).toBe(20);
    expect(entity.initiativeModifier).toBe(0);
    expect(entity.currentHp).toBe(0);
    expect(entity.maxHp).toBe(0);
    expect(entity.lairActions).toHaveLength(1);
    expect(entity.lairActions![0].name).toBe('Magma Eruption');
    expect(entity.lairActions![0].usedThisRound).toBe(false);
  });

  it('includes regional effects when provided', () => {
    const entity = createLairEntity(
      'Beholder',
      [{ name: 'Eye Ray', description: 'A beam fires.' }],
      ['Plants wither within 1 mile.']
    );

    expect(entity.regionalEffects).toEqual(['Plants wither within 1 mile.']);
  });
});
