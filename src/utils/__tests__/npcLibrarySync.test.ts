import { describe, it, expect } from 'vitest';
import {
  buildNpcLibraryPatch,
  replaceArmorClassNumber,
} from '@/utils/npcLibrarySync';
import type {
  CampaignNPC,
  EncounterEntity,
  MonsterStatBlock,
} from '@/types/encounter';

function makeStatBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  return {
    str: 18,
    dex: 12,
    con: 16,
    int: 6,
    wis: 10,
    cha: 8,
    saves: '',
    skills: 'Perception +2',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: 'darkvision 60 ft.',
    passivePerception: 12,
    traits: [
      {
        id: 'trait-1',
        name: 'Keen Smell',
        text: 'Advantage on Perception (smell).',
      },
    ],
    actions: [
      { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
    ],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '2',
    type: 'beast',
    size: 'Large',
    languages: '',
    alignment: 'unaligned',
    hpFormula: '9d10+18',
    ...overrides,
  };
}

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'entity-1',
    type: 'npc',
    name: 'Grommash',
    initiative: 10,
    initiativeModifier: 2,
    proficiencyBonus: 3,
    currentHp: 40,
    maxHp: 50,
    tempHp: 0,
    armorClass: 16,
    conditions: [],
    monsterStatBlock: makeStatBlock(),
    npcSourceId: 'npc-1',
    campaignCode: 'ABCD',
    ...overrides,
  };
}

function makeNpc(overrides: Partial<CampaignNPC> = {}): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: 'ABCD',
    name: 'Grommash',
    armorClass: '16 (natural armor)',
    maxHp: 50,
    speed: '30 ft.',
    monsterStatBlock: makeStatBlock(),
    initiativeModifier: 2,
    proficiencyBonus: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('replaceArmorClassNumber', () => {
  it('replaces the leading number while keeping the annotation', () => {
    expect(replaceArmorClassNumber('16 (natural armor)', 18)).toBe(
      '18 (natural armor)'
    );
  });

  it('writes a plain number when the text is empty', () => {
    expect(replaceArmorClassNumber('', 18)).toBe('18');
  });

  it('writes a plain number when the text has no digits', () => {
    expect(replaceArmorClassNumber('unarmored', 18)).toBe('18');
  });

  it('stringifies a numeric input', () => {
    expect(replaceArmorClassNumber(16, 18)).toBe('18');
  });
});

describe('buildNpcLibraryPatch — top-level fields', () => {
  it('syncs armorClass, preserving the annotation', () => {
    const before = makeEntity({ armorClass: 16 });
    const after = makeEntity({ armorClass: 18 });
    const npc = makeNpc({ armorClass: '16 (natural armor)' });

    const patch = buildNpcLibraryPatch(before, after, npc);

    expect(patch).toEqual({ armorClass: '18 (natural armor)' });
  });

  it('syncs maxHp', () => {
    const before = makeEntity({ maxHp: 50 });
    const after = makeEntity({ maxHp: 60 });
    const npc = makeNpc({ maxHp: 50 });

    expect(buildNpcLibraryPatch(before, after, npc)).toEqual({ maxHp: 60 });
  });

  it('syncs initiativeModifier', () => {
    const before = makeEntity({ initiativeModifier: 2 });
    const after = makeEntity({ initiativeModifier: 4 });
    const npc = makeNpc({ initiativeModifier: 2 });

    expect(buildNpcLibraryPatch(before, after, npc)).toEqual({
      initiativeModifier: 4,
    });
  });

  it('syncs proficiencyBonus', () => {
    const before = makeEntity({ proficiencyBonus: 3 });
    const after = makeEntity({ proficiencyBonus: 4 });
    const npc = makeNpc({ proficiencyBonus: 3 });

    expect(buildNpcLibraryPatch(before, after, npc)).toEqual({
      proficiencyBonus: 4,
    });
  });

  it('handles a plain-number NPC armorClass', () => {
    const before = makeEntity({ armorClass: 16 });
    const after = makeEntity({ armorClass: 18 });
    const npc = makeNpc({ armorClass: '16' });

    expect(buildNpcLibraryPatch(before, after, npc)).toEqual({
      armorClass: '18',
    });
  });

  it('handles NPC armorClass text with no digits', () => {
    const before = makeEntity({ armorClass: 16 });
    const after = makeEntity({ armorClass: 18 });
    const npc = makeNpc({ armorClass: 'unarmored' });

    expect(buildNpcLibraryPatch(before, after, npc)).toEqual({
      armorClass: '18',
    });
  });

  it('returns null when the field changed but already matches the NPC', () => {
    const before = makeEntity({ maxHp: 50 });
    const after = makeEntity({ maxHp: 60 });
    const npc = makeNpc({ maxHp: 60 });

    expect(buildNpcLibraryPatch(before, after, npc)).toBeNull();
  });

  it('returns null when before and after are unchanged', () => {
    const before = makeEntity();
    const after = makeEntity();
    const npc = makeNpc();

    expect(buildNpcLibraryPatch(before, after, npc)).toBeNull();
  });

  it.each([
    ['name', { name: 'Grommash' }, { name: 'Grommash the Terrible' }],
    ['playerAlias', {}, { playerAlias: 'Mystery Foe' }],
    ['playerDisposition', {}, { playerDisposition: 'enemy' as const }],
    ['isHidden', {}, { isHidden: true }],
    ['hpVisibleToPlayers', {}, { hpVisibleToPlayers: true }],
    ['tempAc', {}, { tempAc: 2 }],
    [
      'conditions',
      { conditions: [] },
      {
        conditions: [{ id: 'c1', name: 'Prone' }],
      },
    ],
    ['concentrationSpell', {}, { concentrationSpell: 'Bless' }],
  ])('does not sync %s', (_label, beforeOverrides, afterOverrides) => {
    const before = makeEntity(beforeOverrides);
    const after = makeEntity(afterOverrides);
    const npc = makeNpc();

    expect(buildNpcLibraryPatch(before, after, npc)).toBeNull();
  });
});

describe('buildNpcLibraryPatch — stat block scalars', () => {
  it('syncs a single scalar key and leaves the rest of the NPC block untouched', () => {
    const before = makeEntity({ monsterStatBlock: makeStatBlock({ str: 18 }) });
    const after = makeEntity({ monsterStatBlock: makeStatBlock({ str: 20 }) });
    // NPC has a newer `skills` value than the entity's stale copy.
    const npc = makeNpc({
      monsterStatBlock: makeStatBlock({ str: 18, skills: 'Perception +5' }),
    });

    const patch = buildNpcLibraryPatch(before, after, npc);

    expect(patch).toEqual({
      monsterStatBlock: makeStatBlock({ str: 20, skills: 'Perception +5' }),
    });
  });

  it('syncs saveProficiencies by deep comparison', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({ saveProficiencies: ['str'] }),
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({ saveProficiencies: ['str', 'con'] }),
    });
    const npc = makeNpc({
      monsterStatBlock: makeStatBlock({ saveProficiencies: ['str'] }),
    });

    const patch = buildNpcLibraryPatch(before, after, npc);

    expect(patch).toEqual({
      monsterStatBlock: makeStatBlock({ saveProficiencies: ['str', 'con'] }),
    });
  });

  it('returns null when the stat block changed but already matches the NPC', () => {
    const before = makeEntity({ monsterStatBlock: makeStatBlock({ str: 18 }) });
    const after = makeEntity({ monsterStatBlock: makeStatBlock({ str: 20 }) });
    const npc = makeNpc({ monsterStatBlock: makeStatBlock({ str: 20 }) });

    expect(buildNpcLibraryPatch(before, after, npc)).toBeNull();
  });

  it('ignores stat-block sync when the NPC has no stat block, but still syncs top-level fields', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({ str: 18 }),
      maxHp: 50,
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({ str: 20 }),
      maxHp: 60,
    });
    const npc = makeNpc({ monsterStatBlock: undefined, maxHp: 50 });

    expect(buildNpcLibraryPatch(before, after, npc)).toEqual({ maxHp: 60 });
  });

  it('does not throw on a legacy NPC block missing bonusActions/lairActions', () => {
    const before = makeEntity({ monsterStatBlock: makeStatBlock({ str: 18 }) });
    const after = makeEntity({ monsterStatBlock: makeStatBlock({ str: 20 }) });
    const legacyBlock = makeStatBlock({
      str: 18,
    }) as unknown as Record<string, unknown>;
    // Simulate a legacy record missing these arrays entirely.
    delete legacyBlock.bonusActions;
    delete legacyBlock.lairActions;
    const npc = makeNpc({
      monsterStatBlock: legacyBlock as unknown as MonsterStatBlock,
    });

    expect(() => buildNpcLibraryPatch(before, after, npc)).not.toThrow();
    const patch = buildNpcLibraryPatch(before, after, npc);
    expect(patch?.monsterStatBlock?.str).toBe(20);
  });
});

describe('buildNpcLibraryPatch — stat block entries', () => {
  it('replaces an edited owned entry (same id)', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
        ],
      }),
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+7 to hit, 1d8+6 piercing.' },
        ],
      }),
    });
    const npc = makeNpc({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
        ],
      }),
    });

    const patch = buildNpcLibraryPatch(before, after, npc);

    expect(patch?.monsterStatBlock?.actions).toEqual([
      { id: 'action-1', name: 'Bite', text: '+7 to hit, 1d8+6 piercing.' },
    ]);
  });

  it('does not push a combat-added entry (id not on the NPC)', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
        ],
      }),
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
          { id: 'action-2', name: 'Claw', text: '+5 to hit, 1d6+4 slashing.' },
        ],
      }),
    });
    const npc = makeNpc({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
        ],
      }),
    });

    expect(buildNpcLibraryPatch(before, after, npc)).toBeNull();
  });

  it('keeps a combat-deleted entry on the NPC', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
          { id: 'action-2', name: 'Claw', text: '+5 to hit, 1d6+4 slashing.' },
        ],
      }),
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
        ],
      }),
    });
    const npc = makeNpc({
      monsterStatBlock: makeStatBlock({
        actions: [
          { id: 'action-1', name: 'Bite', text: '+5 to hit, 1d8+4 piercing.' },
          { id: 'action-2', name: 'Claw', text: '+5 to hit, 1d6+4 slashing.' },
        ],
      }),
    });

    expect(buildNpcLibraryPatch(before, after, npc)).toBeNull();
  });
});

describe('buildNpcLibraryPatch — speed', () => {
  it('updates both the stat block speed and the top-level speed', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({ speed: '30 ft.' }),
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({ speed: '30 ft., fly 60 ft.' }),
    });
    const npc = makeNpc({
      speed: '30 ft.',
      monsterStatBlock: makeStatBlock({ speed: '30 ft.' }),
    });

    const patch = buildNpcLibraryPatch(before, after, npc);

    expect(patch?.speed).toBe('30 ft., fly 60 ft.');
    expect(patch?.monsterStatBlock?.speed).toBe('30 ft., fly 60 ft.');
  });

  it('does not set top-level speed when it already matches the NPC', () => {
    const before = makeEntity({
      monsterStatBlock: makeStatBlock({ speed: '30 ft.' }),
    });
    const after = makeEntity({
      monsterStatBlock: makeStatBlock({ speed: '30 ft., fly 60 ft.' }),
    });
    const npc = makeNpc({
      speed: '30 ft., fly 60 ft.',
      monsterStatBlock: makeStatBlock({ speed: '30 ft.' }),
    });

    const patch = buildNpcLibraryPatch(before, after, npc);

    expect(patch?.speed).toBeUndefined();
    expect(patch?.monsterStatBlock?.speed).toBe('30 ft., fly 60 ft.');
  });
});
