import { describe, it, expect } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import {
  CLASS_RESOURCE_DEFINITIONS,
  getActiveClassResources,
  getResourceDefinitionById,
} from '@/utils/classResources';

function bard(level: number, charisma = 16) {
  return makeCharacter({
    classes: [
      {
        className: 'Bard',
        level,
        isCustom: false,
        hitDie: 8,
        classSource: 'XPHB',
      },
    ],
    totalLevel: level,
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma,
    },
  });
}

describe('registry contents', () => {
  it('defines all 11 XPHB resources', () => {
    const ids = CLASS_RESOURCE_DEFINITIONS.map(d => d.id).sort();
    expect(ids).toEqual(
      [
        'action-surge',
        'arcane-recovery',
        'bardic-inspiration',
        'channel-divinity-cleric',
        'channel-divinity-paladin',
        'focus-points',
        'lay-on-hands',
        'rage',
        'second-wind',
        'sorcery-points',
        'wild-shape',
      ].sort()
    );
  });
});

describe('max uses scaling', () => {
  const ctx = (classLevel: number) => ({
    classLevel,
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    proficiencyBonus: 2,
  });

  it('rage follows XPHB table', () => {
    const rage = getResourceDefinitionById('rage')!;
    expect(rage.getMaxUses(ctx(1))).toBe(2);
    expect(rage.getMaxUses(ctx(3))).toBe(3);
    expect(rage.getMaxUses(ctx(12))).toBe(5);
    expect(rage.getMaxUses(ctx(20))).toBe(6);
  });

  it('wild shape follows XPHB table', () => {
    const ws = getResourceDefinitionById('wild-shape')!;
    expect(ws.getMaxUses(ctx(1))).toBe(0);
    expect(ws.getMaxUses(ctx(2))).toBe(2);
    expect(ws.getMaxUses(ctx(6))).toBe(3);
    expect(ws.getMaxUses(ctx(17))).toBe(4);
  });

  it('focus points equal monk level from 2', () => {
    const focus = getResourceDefinitionById('focus-points')!;
    expect(focus.getMaxUses(ctx(1))).toBe(0);
    expect(focus.getMaxUses(ctx(2))).toBe(2);
    expect(focus.getMaxUses(ctx(11))).toBe(11);
    expect(focus.getMaxUses(ctx(20))).toBe(20);
  });

  it('lay on hands is 5 x paladin level', () => {
    const loh = getResourceDefinitionById('lay-on-hands')!;
    expect(loh.getMaxUses(ctx(1))).toBe(5);
    expect(loh.getMaxUses(ctx(20))).toBe(100);
  });

  it('bardic inspiration uses CHA modifier with floor 1', () => {
    const bi = getResourceDefinitionById('bardic-inspiration')!;
    expect(
      bi.getMaxUses({
        ...ctx(1),
        abilities: { ...ctx(1).abilities, charisma: 16 },
      })
    ).toBe(3);
    expect(
      bi.getMaxUses({
        ...ctx(1),
        abilities: { ...ctx(1).abilities, charisma: 8 },
      })
    ).toBe(1);
  });

  it('action surge is 1 use, 2 at level 17', () => {
    const surge = getResourceDefinitionById('action-surge')!;
    expect(surge.getMaxUses(ctx(2))).toBe(1);
    expect(surge.getMaxUses(ctx(16))).toBe(1);
    expect(surge.getMaxUses(ctx(17))).toBe(2);
  });
});

describe('die ladders', () => {
  it('bardic die scales d6/d8@5/d10@10/d12@15', () => {
    const bi = getResourceDefinitionById('bardic-inspiration')!;
    expect(bi.getDie!(1)).toBe('d6');
    expect(bi.getDie!(5)).toBe('d8');
    expect(bi.getDie!(10)).toBe('d10');
    expect(bi.getDie!(15)).toBe('d12');
  });
});

describe('short rest reset rules', () => {
  it('bardic resets all at level 5+ (Font of Inspiration), none below', () => {
    const bi = getResourceDefinitionById('bardic-inspiration')!;
    expect(bi.getShortRestReset(4)).toBe(0);
    expect(bi.getShortRestReset(5)).toBe('all');
  });

  it('rage, wild shape, channel divinity, second wind regain 1', () => {
    for (const id of [
      'rage',
      'wild-shape',
      'channel-divinity-cleric',
      'channel-divinity-paladin',
      'second-wind',
    ]) {
      expect(getResourceDefinitionById(id)!.getShortRestReset(5)).toBe(1);
    }
  });

  it('focus and action surge reset all; pools and arcane recovery reset none', () => {
    expect(
      getResourceDefinitionById('focus-points')!.getShortRestReset(5)
    ).toBe('all');
    expect(
      getResourceDefinitionById('action-surge')!.getShortRestReset(5)
    ).toBe('all');
    expect(
      getResourceDefinitionById('sorcery-points')!.getShortRestReset(5)
    ).toBe(0);
    expect(
      getResourceDefinitionById('lay-on-hands')!.getShortRestReset(5)
    ).toBe(0);
    expect(
      getResourceDefinitionById('arcane-recovery')!.getShortRestReset(5)
    ).toBe(0);
  });
});

describe('getActiveClassResources', () => {
  it('returns bardic inspiration for a bard with computed max and die', () => {
    const resources = getActiveClassResources(bard(5, 16));
    expect(resources).toHaveLength(1);
    expect(resources[0].definition.id).toBe('bardic-inspiration');
    expect(resources[0].maxUses).toBe(3);
    expect(resources[0].die).toBe('d8');
    expect(resources[0].usesRemaining).toBe(3);
  });

  it('hides resources below minLevel and zero-max resources', () => {
    const monk1 = makeCharacter({
      classes: [{ className: 'Monk', level: 1, isCustom: false, hitDie: 8 }],
      totalLevel: 1,
    });
    expect(getActiveClassResources(monk1)).toHaveLength(0);
  });

  it('returns both fighter resources at level 2', () => {
    const fighter2 = makeCharacter({
      classes: [
        { className: 'Fighter', level: 2, isCustom: false, hitDie: 10 },
      ],
      totalLevel: 2,
    });
    const ids = getActiveClassResources(fighter2).map(r => r.definition.id);
    expect(ids.sort()).toEqual(['action-surge', 'second-wind']);
  });

  it('multiclass returns resources from every class with per-class levels', () => {
    const multi = makeCharacter({
      classes: [
        { className: 'Bard', level: 3, isCustom: false, hitDie: 8 },
        { className: 'Druid', level: 2, isCustom: false, hitDie: 8 },
      ],
      totalLevel: 5,
    });
    const ids = getActiveClassResources(multi).map(r => r.definition.id);
    expect(ids.sort()).toEqual(['bardic-inspiration', 'wild-shape']);
  });

  it('falls back to legacy single class field', () => {
    const legacy = makeCharacter({
      classes: undefined,
      class: { name: 'Barbarian', isCustom: false, hitDie: 12 },
      level: 3,
    });
    const resources = getActiveClassResources(legacy);
    expect(resources).toHaveLength(1);
    expect(resources[0].definition.id).toBe('rage');
    expect(resources[0].maxUses).toBe(3);
  });

  it('clamps usesExpended to max (CHA drop cannot yield negative remaining)', () => {
    const c = bard(1, 8); // max 1
    (c as unknown as Record<string, unknown>).classResources = {
      'bardic-inspiration': { usesExpended: 3 },
    };
    const [bi] = getActiveClassResources(c);
    expect(bi.usesExpended).toBe(1);
    expect(bi.usesRemaining).toBe(0);
  });

  it('unknown/PHB classSource still resolves to XPHB definitions (2024 default)', () => {
    const c = makeCharacter({
      classes: [
        {
          className: 'Druid',
          level: 2,
          isCustom: false,
          hitDie: 8,
          classSource: 'PHB',
        },
      ],
      totalLevel: 2,
    });
    expect(getActiveClassResources(c).map(r => r.definition.id)).toEqual([
      'wild-shape',
    ]);
  });
});
