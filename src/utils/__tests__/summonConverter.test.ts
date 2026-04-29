import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSummoningSpell,
  getSummonType,
  isSpiritSummonSpell,
  getSpiritScaling,
  createFamiliarFromMonster,
  createSummonFromMonster,
  createSpiritSummon,
  SUMMON_SPELL_SCALING,
  createFamiliarFromSavedCreature,
  createSummonFromSavedCreature,
} from '@/utils/summonConverter';
import { createMockProcessedMonster } from '@/test/helpers';
import type { Spell } from '@/types/character';
import type { SavedCreature } from '@/types/summon';

// Minimal spell factory — only the fields summonConverter reads
function makeSpell(name: string): Spell {
  return { id: `spell-${name}`, name } as Spell;
}

function makeSavedCreature(
  overrides: Partial<SavedCreature> = {}
): SavedCreature {
  return {
    id: 'saved-cat',
    name: 'Cat',
    size: 'Tiny',
    type: 'beast',
    alignment: 'Unaligned',
    ac: 12,
    hp: 2,
    speed: '40 ft.',
    str: 3,
    dex: 15,
    con: 10,
    int: 3,
    wis: 12,
    cha: 7,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SUMMON_SPELL_SCALING constant
// ---------------------------------------------------------------------------

describe('SUMMON_SPELL_SCALING', () => {
  it("contains all ten Tasha's summon spells", () => {
    const expectedSpells = [
      'Summon Beast',
      'Summon Celestial',
      'Summon Construct',
      'Summon Dragon',
      'Summon Elemental',
      'Summon Fey',
      'Summon Fiend',
      'Summon Shadowspawn',
      'Summon Undead',
      'Summon Aberration',
    ];
    for (const spell of expectedSpells) {
      expect(SUMMON_SPELL_SCALING).toHaveProperty(spell);
    }
  });

  it('each entry has required numeric fields', () => {
    for (const [, data] of Object.entries(SUMMON_SPELL_SCALING)) {
      expect(typeof data.baseAC).toBe('number');
      expect(typeof data.baseHP).toBe('number');
      expect(typeof data.hpPerLevel).toBe('number');
      expect(typeof data.baseLevel).toBe('number');
      expect(typeof data.spiritName).toBe('string');
    }
  });

  it('Summon Beast has correct scaling values', () => {
    const beastScaling = SUMMON_SPELL_SCALING['Summon Beast'];
    expect(beastScaling.baseAC).toBe(11);
    expect(beastScaling.baseHP).toBe(30);
    expect(beastScaling.hpPerLevel).toBe(5);
    expect(beastScaling.baseLevel).toBe(2);
    expect(beastScaling.spiritName).toBe('Bestial Spirit');
    expect(beastScaling.subtypes).toEqual(['Air', 'Land', 'Water']);
  });

  it('Summon Fey has correct scaling values', () => {
    const feyScaling = SUMMON_SPELL_SCALING['Summon Fey'];
    expect(feyScaling.baseAC).toBe(12);
    expect(feyScaling.baseHP).toBe(30);
    expect(feyScaling.hpPerLevel).toBe(10);
    expect(feyScaling.baseLevel).toBe(3);
    expect(feyScaling.spiritName).toBe('Fey Spirit');
  });
});

// ---------------------------------------------------------------------------
// isSummoningSpell
// ---------------------------------------------------------------------------

describe('isSummoningSpell', () => {
  it('returns true for Find Familiar', () => {
    expect(isSummoningSpell(makeSpell('Find Familiar'))).toBe(true);
  });

  it("returns true for all Tasha's Summon X spells", () => {
    const summonSpells = [
      'Summon Beast',
      'Summon Celestial',
      'Summon Construct',
      'Summon Dragon',
      'Summon Elemental',
      'Summon Fey',
      'Summon Fiend',
      'Summon Shadowspawn',
      'Summon Undead',
      'Summon Aberration',
    ];
    for (const name of summonSpells) {
      expect(isSummoningSpell(makeSpell(name))).toBe(true);
    }
  });

  it('returns true for Conjure-family spells', () => {
    const conjureSpells = [
      'Conjure Animals',
      'Conjure Celestial',
      'Conjure Elemental',
      'Conjure Fey',
      'Conjure Minor Elementals',
      'Conjure Woodland Beings',
    ];
    for (const name of conjureSpells) {
      expect(isSummoningSpell(makeSpell(name))).toBe(true);
    }
  });

  it('returns true for Find Steed and Find Greater Steed', () => {
    expect(isSummoningSpell(makeSpell('Find Steed'))).toBe(true);
    expect(isSummoningSpell(makeSpell('Find Greater Steed'))).toBe(true);
  });

  it('returns true for unknown Summon-prefixed spells', () => {
    expect(isSummoningSpell(makeSpell('Summon Greater Demon'))).toBe(true);
  });

  it('returns false for non-summoning spells', () => {
    expect(isSummoningSpell(makeSpell('Fireball'))).toBe(false);
    expect(isSummoningSpell(makeSpell('Cure Wounds'))).toBe(false);
    expect(isSummoningSpell(makeSpell('Magic Missile'))).toBe(false);
    expect(isSummoningSpell(makeSpell('Polymorph'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSummonType
// ---------------------------------------------------------------------------

describe('getSummonType', () => {
  it('returns "familiar" for Find Familiar', () => {
    expect(getSummonType(makeSpell('Find Familiar'))).toBe('familiar');
  });

  it('returns "summon" for Summon Beast', () => {
    expect(getSummonType(makeSpell('Summon Beast'))).toBe('summon');
  });

  it('returns "summon" for Conjure Animals', () => {
    expect(getSummonType(makeSpell('Conjure Animals'))).toBe('summon');
  });

  it('returns "summon" for Find Steed', () => {
    expect(getSummonType(makeSpell('Find Steed'))).toBe('summon');
  });
});

// ---------------------------------------------------------------------------
// isSpiritSummonSpell
// ---------------------------------------------------------------------------

describe('isSpiritSummonSpell', () => {
  it("returns true for Tasha's spirit summon spell names", () => {
    expect(isSpiritSummonSpell('Summon Beast')).toBe(true);
    expect(isSpiritSummonSpell('Summon Fey')).toBe(true);
    expect(isSpiritSummonSpell('Summon Undead')).toBe(true);
    expect(isSpiritSummonSpell('Summon Dragon')).toBe(true);
  });

  it('returns false for non-spirit summon spells', () => {
    expect(isSpiritSummonSpell('Conjure Animals')).toBe(false);
    expect(isSpiritSummonSpell('Find Familiar')).toBe(false);
    expect(isSpiritSummonSpell('Find Steed')).toBe(false);
    expect(isSpiritSummonSpell('Fireball')).toBe(false);
    expect(isSpiritSummonSpell('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSpiritScaling
// ---------------------------------------------------------------------------

describe('getSpiritScaling', () => {
  it('returns scaling data for known spirit summon spells', () => {
    const data = getSpiritScaling('Summon Beast');
    expect(data).not.toBeNull();
    expect(data?.spiritName).toBe('Bestial Spirit');
    expect(data?.baseLevel).toBe(2);
  });

  it('returns null for unknown spell names', () => {
    expect(getSpiritScaling('Conjure Animals')).toBeNull();
    expect(getSpiritScaling('Find Familiar')).toBeNull();
    expect(getSpiritScaling('Nonexistent Spell')).toBeNull();
    expect(getSpiritScaling('')).toBeNull();
  });

  it('returns correct data for Summon Fiend', () => {
    const data = getSpiritScaling('Summon Fiend');
    expect(data?.baseAC).toBe(12);
    expect(data?.baseHP).toBe(50);
    expect(data?.hpPerLevel).toBe(15);
    expect(data?.baseLevel).toBe(6);
    expect(data?.subtypes).toEqual(['Demon', 'Devil', 'Yugoloth']);
  });

  it('returns correct data for Summon Construct', () => {
    const data = getSpiritScaling('Summon Construct');
    expect(data?.baseAC).toBe(13);
    expect(data?.hpPerLevel).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// createFamiliarFromMonster
// ---------------------------------------------------------------------------

describe('createFamiliarFromMonster', () => {
  it('returns a Summon with type "familiar"', () => {
    const monster = createMockProcessedMonster({ name: 'Owl' });
    const result = createFamiliarFromMonster(monster);
    expect(result.type).toBe('familiar');
  });

  it('uses monster name as entity name when no customName given', () => {
    const monster = createMockProcessedMonster({ name: 'Raven' });
    const result = createFamiliarFromMonster(monster);
    expect(result.entity.name).toBe('Raven');
  });

  it('uses customName when provided', () => {
    const monster = createMockProcessedMonster({ name: 'Cat' });
    const result = createFamiliarFromMonster(monster, undefined, 'Whiskers');
    expect(result.entity.name).toBe('Whiskers');
    expect(result.customName).toBe('Whiskers');
  });

  it('sets sourceSpellName to "Find Familiar"', () => {
    const result = createFamiliarFromMonster(createMockProcessedMonster());
    expect(result.sourceSpellName).toBe('Find Familiar');
  });

  it('sets requiresConcentration to false', () => {
    const result = createFamiliarFromMonster(createMockProcessedMonster());
    expect(result.requiresConcentration).toBe(false);
  });

  it('sets duration to "Until dismissed"', () => {
    const result = createFamiliarFromMonster(createMockProcessedMonster());
    expect(result.duration).toBe('Until dismissed');
  });

  it('attaches the provided spellId', () => {
    const result = createFamiliarFromMonster(
      createMockProcessedMonster(),
      'spell-abc'
    );
    expect(result.sourceSpellId).toBe('spell-abc');
  });

  it('generates a non-empty id and createdAt', () => {
    const result = createFamiliarFromMonster(createMockProcessedMonster());
    expect(result.id).toBeTruthy();
    expect(result.createdAt).toBeTruthy();
  });

  it('populates entity HP and AC from monster data', () => {
    const monster = createMockProcessedMonster({ hpAverage: 256, acValue: 19 });
    const result = createFamiliarFromMonster(monster);
    expect(result.entity.currentHp).toBe(256);
    expect(result.entity.maxHp).toBe(256);
    expect(result.entity.armorClass).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// createSummonFromMonster
// ---------------------------------------------------------------------------

describe('createSummonFromMonster', () => {
  it('returns a Summon with type "summon"', () => {
    const monster = createMockProcessedMonster({ name: 'Wolf' });
    const result = createSummonFromMonster(monster, 'Conjure Animals');
    expect(result.type).toBe('summon');
  });

  it('stores the spell name', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals'
    );
    expect(result.sourceSpellName).toBe('Conjure Animals');
  });

  it('uses monster name by default', () => {
    const monster = createMockProcessedMonster({ name: 'Brown Bear' });
    const result = createSummonFromMonster(monster, 'Conjure Animals');
    expect(result.entity.name).toBe('Brown Bear');
  });

  it('uses customName when provided', () => {
    const monster = createMockProcessedMonster({ name: 'Wolf' });
    const result = createSummonFromMonster(
      monster,
      'Conjure Animals',
      undefined,
      undefined,
      true,
      '1 hour',
      'Fang'
    );
    expect(result.entity.name).toBe('Fang');
    expect(result.customName).toBe('Fang');
  });

  it('defaults requiresConcentration to true', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals'
    );
    expect(result.requiresConcentration).toBe(true);
  });

  it('accepts custom requiresConcentration value', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Find Steed',
      undefined,
      undefined,
      false
    );
    expect(result.requiresConcentration).toBe(false);
  });

  it('defaults duration to "1 hour"', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals'
    );
    expect(result.duration).toBe('1 hour');
  });

  it('accepts custom duration', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Find Steed',
      undefined,
      undefined,
      false,
      'Until dismissed'
    );
    expect(result.duration).toBe('Until dismissed');
  });

  it('stores castAtLevel when provided', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals',
      undefined,
      5
    );
    expect(result.castAtLevel).toBe(5);
  });

  it('stores spellId when provided', () => {
    const result = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals',
      'spell-xyz'
    );
    expect(result.sourceSpellId).toBe('spell-xyz');
  });

  it('generates unique ids for summon and entity', () => {
    const r1 = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals'
    );
    const r2 = createSummonFromMonster(
      createMockProcessedMonster(),
      'Conjure Animals'
    );
    expect(r1.id).not.toBe(r2.id);
    expect(r1.entity.id).not.toBe(r2.entity.id);
  });
});

// ---------------------------------------------------------------------------
// createFamiliarFromSavedCreature
// ---------------------------------------------------------------------------

describe('createFamiliarFromSavedCreature', () => {
  it('returns type "familiar"', () => {
    const creature = makeSavedCreature();
    expect(createFamiliarFromSavedCreature(creature).type).toBe('familiar');
  });

  it('uses creature name by default', () => {
    const creature = makeSavedCreature({ name: 'Cat' });
    expect(createFamiliarFromSavedCreature(creature).entity.name).toBe('Cat');
  });

  it('uses customName when provided', () => {
    const creature = makeSavedCreature({ name: 'Cat' });
    const result = createFamiliarFromSavedCreature(
      creature,
      undefined,
      'Mittens'
    );
    expect(result.entity.name).toBe('Mittens');
    expect(result.customName).toBe('Mittens');
  });

  it('sets sourceSpellName to "Find Familiar"', () => {
    expect(
      createFamiliarFromSavedCreature(makeSavedCreature()).sourceSpellName
    ).toBe('Find Familiar');
  });

  it('sets requiresConcentration to false', () => {
    expect(
      createFamiliarFromSavedCreature(makeSavedCreature()).requiresConcentration
    ).toBe(false);
  });

  it('sets duration to "Until dismissed"', () => {
    expect(createFamiliarFromSavedCreature(makeSavedCreature()).duration).toBe(
      'Until dismissed'
    );
  });

  it('uses creature HP and AC', () => {
    const creature = makeSavedCreature({ hp: 10, ac: 14 });
    const result = createFamiliarFromSavedCreature(creature);
    expect(result.entity.currentHp).toBe(10);
    expect(result.entity.maxHp).toBe(10);
    expect(result.entity.armorClass).toBe(14);
  });

  it('calculates initiative modifier from DEX', () => {
    // DEX 15 → mod +2
    const result = createFamiliarFromSavedCreature(
      makeSavedCreature({ dex: 15 })
    );
    expect(result.entity.initiativeModifier).toBe(2);
  });

  it('calculates negative initiative modifier from low DEX', () => {
    // DEX 8 → mod -1
    const result = createFamiliarFromSavedCreature(
      makeSavedCreature({ dex: 8 })
    );
    expect(result.entity.initiativeModifier).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// createSummonFromSavedCreature
// ---------------------------------------------------------------------------

describe('createSummonFromSavedCreature', () => {
  it('returns type "summon"', () => {
    const creature = makeSavedCreature();
    expect(
      createSummonFromSavedCreature(creature, 'Conjure Animals').type
    ).toBe('summon');
  });

  it('stores the spell name', () => {
    const result = createSummonFromSavedCreature(
      makeSavedCreature(),
      'Summon Fey'
    );
    expect(result.sourceSpellName).toBe('Summon Fey');
  });

  it('defaults requiresConcentration to true', () => {
    const result = createSummonFromSavedCreature(
      makeSavedCreature(),
      'Conjure Animals'
    );
    expect(result.requiresConcentration).toBe(true);
  });

  it('accepts custom requiresConcentration', () => {
    const result = createSummonFromSavedCreature(
      makeSavedCreature(),
      'Find Steed',
      undefined,
      undefined,
      false
    );
    expect(result.requiresConcentration).toBe(false);
  });

  it('defaults duration to "1 hour"', () => {
    const result = createSummonFromSavedCreature(
      makeSavedCreature(),
      'Conjure Animals'
    );
    expect(result.duration).toBe('1 hour');
  });

  it('uses creature HP and AC', () => {
    const creature = makeSavedCreature({ hp: 20, ac: 16 });
    const result = createSummonFromSavedCreature(creature, 'Conjure Animals');
    expect(result.entity.currentHp).toBe(20);
    expect(result.entity.maxHp).toBe(20);
    expect(result.entity.armorClass).toBe(16);
  });

  it('stores castAtLevel', () => {
    const result = createSummonFromSavedCreature(
      makeSavedCreature(),
      'Conjure Animals',
      undefined,
      3
    );
    expect(result.castAtLevel).toBe(3);
  });

  it('uses customName when provided', () => {
    const result = createSummonFromSavedCreature(
      makeSavedCreature({ name: 'Wolf' }),
      'Conjure Animals',
      undefined,
      undefined,
      true,
      '1 hour',
      'Shadow'
    );
    expect(result.entity.name).toBe('Shadow');
    expect(result.customName).toBe('Shadow');
  });
});

// ---------------------------------------------------------------------------
// createSpiritSummon (async, with fetch mock)
// ---------------------------------------------------------------------------

describe('createSpiritSummon', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for an unknown spell name', async () => {
    const result = await createSpiritSummon('Conjure Animals', 5);
    expect(result).toBeNull();
  });

  it('returns a Summon with correct type on API failure (fallback path)', async () => {
    // Make fetch reject so the fetchSpiritMonster helper returns null
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon('Summon Beast', 3);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('summon');
  });

  it('calculates scaled HP correctly in fallback path', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    // Summon Beast: baseHP=30, hpPerLevel=5, baseLevel=2
    // castAtLevel=4 → 30 + 5*(4-2) = 40
    const result = await createSpiritSummon('Summon Beast', 4);
    expect(result?.entity.currentHp).toBe(40);
    expect(result?.entity.maxHp).toBe(40);
  });

  it('calculates scaled AC correctly in fallback path', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    // Summon Beast: baseAC=11, castAtLevel=3 → AC = 11+3 = 14
    const result = await createSpiritSummon('Summon Beast', 3);
    expect(result?.entity.armorClass).toBe(14);
  });

  it('uses subtype in entity name in fallback path', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon('Summon Fey', 3, 'Mirthful');
    expect(result?.entity.name).toBe('Fey Spirit (Mirthful)');
  });

  it('uses plain spirit name when no subtype given in fallback path', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon('Summon Undead', 4);
    expect(result?.entity.name).toBe('Undead Spirit');
  });

  it('sets requiresConcentration to true', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon('Summon Beast', 3);
    expect(result?.requiresConcentration).toBe(true);
  });

  it('sets duration to "1 hour"', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon('Summon Beast', 3);
    expect(result?.duration).toBe('1 hour');
  });

  it('stores castAtLevel', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon('Summon Fey', 5);
    expect(result?.castAtLevel).toBe(5);
  });

  it('stores sourceSpellName and sourceSpellId', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await createSpiritSummon(
      'Summon Fey',
      3,
      undefined,
      'spell-99'
    );
    expect(result?.sourceSpellName).toBe('Summon Fey');
    expect(result?.sourceSpellId).toBe('spell-99');
  });

  it('HP scaling: Summon Fiend at base level 6 equals baseHP', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    // Summon Fiend: baseHP=50, hpPerLevel=15, baseLevel=6
    // castAtLevel=6 → 50 + 15*(6-6) = 50
    const result = await createSpiritSummon('Summon Fiend', 6);
    expect(result?.entity.currentHp).toBe(50);
  });

  it('HP scaling: Summon Fiend at level 8', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    // 50 + 15*(8-6) = 80
    const result = await createSpiritSummon('Summon Fiend', 8);
    expect(result?.entity.currentHp).toBe(80);
  });

  it('uses bestiary data when fetch succeeds', async () => {
    const mockMonsterData = {
      monsters: [
        {
          id: 'bestial-spirit',
          name: 'Bestial Spirit',
          size: ['Small'],
          type: 'Beast',
          alignment: 'Unaligned',
          ac: '11',
          hp: '30',
          speed: '30 ft.',
          str: 18,
          dex: 11,
          con: 16,
          int: 4,
          wis: 14,
          cha: 5,
          saves: '',
          skills: '',
          resistances: '',
          immunities: '',
          vulnerabilities: '',
          senses: 'Darkvision 60 ft.',
          passivePerception: 12,
          languages: '',
          cr: '—',
          traits: [
            { name: 'Flyby (Air Only)', text: 'The spirit does not provoke.' },
          ],
          actions: [
            {
              name: 'Multiattack',
              text: 'The spirit makes summonSpellLevel attacks.',
            },
          ],
          reactions: [],
          legendaryActions: [],
          source: 'TCE',
          page: 109,
          acValue: 11,
          hpAverage: 30,
          hpFormula: '30',
          legendaryActionCount: 0,
          conditionImmunities: [],
        },
      ],
      total: 1,
      hasMore: false,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMonsterData,
    });

    const result = await createSpiritSummon('Summon Beast', 3, 'Air');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('summon');
    expect(result?.entity.name).toBe('Bestial Spirit (Air)');
    // AC should be overridden: 11 + 3 = 14
    expect(result?.entity.armorClass).toBe(14);
    // HP should be overridden: 30 + 5*(3-2) = 35
    expect(result?.entity.currentHp).toBe(35);
  });
});
