import { describe, expect, it } from 'vitest';
import {
  deriveAutoFields,
  draftFromMonster,
  draftFromNpc,
  draftsEqual,
  emptyDraft,
  withPassiveOverride,
} from '../npcFormDraft';
import type { NpcFormDraft } from '../npcFormDraft';
import {
  CASTER_NPC,
  GOBLIN,
  KI,
  QUICK_NPC_BARE,
  QUICK_NPC_WITH_SCORES,
  STAT_BLOCK_NPC,
} from './npcFormFixtures';
import type { CampaignNPC } from '@/types/encounter';

describe('emptyDraft', () => {
  it('holds the blank-create defaults', () => {
    const d = emptyDraft();
    expect(d.name).toBe('');
    expect(d.ac).toBe('10');
    expect(d.hp).toBe(10);
    expect(d.speed).toBe('30 ft.');
    expect(d.size).toBe('Medium');
    expect(d.creatureType).toBe('Humanoid');
    expect([d.str, d.dex, d.con, d.int, d.wis, d.cha]).toEqual([
      10, 10, 10, 10, 10, 10,
    ]);
    expect(d.hitDieType).toBe('d8');
    expect(d.initiativeOverride).toBeNull();
    expect(d.proficiencyOverride).toBeNull();
    expect(d.passivesOverride).toBeNull();
  });

  it('returns a fresh draft each call', () => {
    const a = emptyDraft();
    const b = emptyDraft();
    expect(a).not.toBe(b);
    expect(a.tags).not.toBe(b.tags);
  });
});

describe('deriveAutoFields', () => {
  it('derives initiative from DEX', () => {
    expect(
      deriveAutoFields({ ...emptyDraft(), dex: 14 }).initiativeModifier
    ).toBe(2);
  });

  it('derives the proficiency bonus from CR', () => {
    expect(
      deriveAutoFields({ ...emptyDraft(), cr: '5' }).proficiencyBonus
    ).toBe(3);
    expect(
      deriveAutoFields({ ...emptyDraft(), cr: 'abc' }).proficiencyBonus
    ).toBe(2);
  });

  it('derives passives from WIS, INT, skills and PB', () => {
    const d = {
      ...emptyDraft(),
      wis: 14,
      int: 8,
      skills: 'Perception +4',
      cr: '5',
    };
    const f = deriveAutoFields(d);
    expect(f.passivePerception).toBe(15);
    expect(f.passiveInsight).toBe(12);
    expect(f.passiveInvestigation).toBe(9);
  });

  it('adds the effective (overridden) PB to perception', () => {
    const f = deriveAutoFields({
      ...emptyDraft(),
      wis: 14,
      skills: 'Perception +4',
      cr: '5',
      proficiencyOverride: 4,
    });
    expect(f.proficiencyBonus).toBe(4);
    expect(f.passivePerception).toBe(16);
  });

  it('lets overrides win', () => {
    const f = deriveAutoFields({
      ...emptyDraft(),
      dex: 14,
      initiativeOverride: 0,
      proficiencyOverride: 6,
      passivesOverride: { perception: 20, insight: 18, investigation: 3 },
    });
    expect(f).toEqual({
      initiativeModifier: 0,
      proficiencyBonus: 6,
      passivePerception: 20,
      passiveInsight: 18,
      passiveInvestigation: 3,
    });
  });
});

describe('withPassiveOverride', () => {
  it('freezes the other passives at their derived values', () => {
    const d = { ...emptyDraft(), wis: 14, int: 8 };
    const patch = withPassiveOverride(d, 'insight', 17);
    expect(patch).toEqual({
      passivesOverride: { perception: 12, insight: 17, investigation: 9 },
    });
  });

  it('keeps already-overridden passives', () => {
    const d: NpcFormDraft = {
      ...emptyDraft(),
      passivesOverride: { perception: 20, insight: 18, investigation: 3 },
    };
    expect(withPassiveOverride(d, 'investigation', 5)).toEqual({
      passivesOverride: { perception: 20, insight: 18, investigation: 5 },
    });
  });
});

describe('draftFromNpc', () => {
  it('keeps resources, hit dice, PB and passives for an NPC with scores only', () => {
    const d = draftFromNpc(QUICK_NPC_WITH_SCORES);
    expect(d.resources).toEqual([KI]);
    expect(d.hitDiceMax).toBe(3);
    expect(d.hitDieCurrent).toBe(2);
    expect(d.hitDieType).toBe('d8');
    expect(d.proficiencyOverride).toBe(3);
    expect(d.passivesOverride).toEqual({
      perception: 14,
      insight: 10,
      investigation: 10,
    });
    expect(d.wis).toBe(16);
    expect(d.initiativeOverride).toBeNull();
  });

  it('keeps the same fields for an NPC with no scores and no stat block', () => {
    const d = draftFromNpc(QUICK_NPC_BARE);
    expect(d.resources).toEqual([KI]);
    expect(d.hitDiceMax).toBe(3);
    expect(d.hitDieCurrent).toBe(2);
    expect(d.proficiencyOverride).toBe(3);
    expect(d.passivesOverride).toEqual({
      perception: 14,
      insight: 10,
      investigation: 10,
    });
    expect([d.str, d.dex, d.con, d.int, d.wis, d.cha]).toEqual([
      10, 10, 10, 10, 10, 10,
    ]);
    expect(d.initiativeOverride).toBeNull();
  });

  it('copies resources instead of sharing them', () => {
    const d = draftFromNpc(QUICK_NPC_WITH_SCORES);
    expect(d.resources[0]).not.toBe(KI);
  });

  it('returns [] for entry arrays missing from an older stat block', () => {
    const sb = { ...STAT_BLOCK_NPC.monsterStatBlock! } as Record<
      string,
      unknown
    >;
    delete sb.bonusActions;
    delete sb.lairActions;
    delete sb.inflictableConditions;
    const npc = {
      ...STAT_BLOCK_NPC,
      monsterStatBlock: sb,
    } as unknown as CampaignNPC;
    const d = draftFromNpc(npc);
    expect(d.bonusActions).toEqual([]);
    expect(d.lairActions).toEqual([]);
    expect(d.inflictableConditions).toEqual([]);
  });

  it('normalises slot override keys and values to numbers', () => {
    const npc: CampaignNPC = {
      ...CASTER_NPC,
      spellcasting: {
        ...CASTER_NPC.spellcasting!,
        slotOverrides: { '1': 2 } as unknown as Record<number, number>,
      },
    };
    expect(draftFromNpc(npc).spellSlotOverrides).toEqual({ 1: 2 });
  });

  it('turns spellcasting on and reads its fields', () => {
    const d = draftFromNpc(CASTER_NPC);
    expect(d.spellcastingEnabled).toBe(true);
    expect(d.casterLevel).toBe(5);
    expect(d.spellcastingAbility).toBe('wisdom');
    expect(d.spellAttackOverride).toBe(7);
    expect(d.spellDCOverride).toBeUndefined();
    expect(draftFromNpc(STAT_BLOCK_NPC).spellcastingEnabled).toBe(false);
  });

  it('reads overrides from the record', () => {
    const d = draftFromNpc(STAT_BLOCK_NPC);
    expect(d.initiativeOverride).toBe(3);
    expect(d.proficiencyOverride).toBe(2);
    expect(d.passivesOverride).toEqual({
      perception: 13,
      insight: 11,
      investigation: 10,
    });
  });
});

describe('draftFromMonster', () => {
  it('imports the monster and keeps the form-only fields', () => {
    const current: NpcFormDraft = {
      ...emptyDraft(),
      group: 'Cave',
      tags: ['x'],
      resources: [KI],
    };
    const d = draftFromMonster(GOBLIN, current);
    expect(d.group).toBe('Cave');
    expect(d.tags).toEqual(['x']);
    expect(d.resources).toEqual([KI]);
    expect(d.hitDiceMax).toBe(2);
    expect(d.hitDieCurrent).toBe(2);
    expect(d.hitDieType).toBe('d6');
    expect(d.initiativeOverride).toBeNull();
    expect(d.proficiencyOverride).toBeNull();
    expect(d.passivesOverride).toBeNull();
    expect(d.bestiarySourceId).toBe('mon-goblin');
    expect(d.bestiarySourceName).toBe('Goblin');
    expect(d.name).toBe('Goblin');
    expect(d.ac).toBe('15');
    expect(d.hp).toBe(7);
  });

  it('derives passive Perception instead of using the listed value', () => {
    const d = draftFromMonster(GOBLIN, emptyDraft());
    expect(deriveAutoFields(d).passivePerception).toBe(9);
  });

  it('leaves hit dice alone when the formula does not parse', () => {
    const current: NpcFormDraft = {
      ...emptyDraft(),
      hitDiceMax: 5,
      hitDieCurrent: 4,
      hitDieType: 'd12',
    };
    const d = draftFromMonster({ ...GOBLIN, hpFormula: '' }, current);
    expect([d.hitDiceMax, d.hitDieCurrent, d.hitDieType]).toEqual([
      5,
      4,
      'd12',
    ]);
  });
});

describe('draftsEqual', () => {
  it('is true for cloned drafts', () => {
    const d = draftFromNpc(CASTER_NPC);
    expect(draftsEqual(d, structuredClone(d))).toBe(true);
  });

  it('is false when a nested entry differs', () => {
    const a = draftFromNpc(STAT_BLOCK_NPC);
    const b = structuredClone(a);
    b.traits[0].text = 'Changed.';
    expect(draftsEqual(a, b)).toBe(false);
  });

  it('treats a cleared slot override like a missing one', () => {
    const a = { ...emptyDraft(), spellSlotOverrides: { 1: undefined } };
    const b = { ...emptyDraft(), spellSlotOverrides: {} };
    expect(draftsEqual(a, b)).toBe(true);
    expect(draftsEqual(b, a)).toBe(true);
  });

  it('compares arrays in order and by length', () => {
    const base = emptyDraft();
    expect(
      draftsEqual({ ...base, tags: ['a'] }, { ...base, tags: ['a', 'b'] })
    ).toBe(false);
    expect(
      draftsEqual({ ...base, tags: ['a', 'b'] }, { ...base, tags: ['b', 'a'] })
    ).toBe(false);
  });

  it('keeps null and 0 apart', () => {
    const base = emptyDraft();
    expect(
      draftsEqual(
        { ...base, initiativeOverride: null },
        { ...base, initiativeOverride: 0 }
      )
    ).toBe(false);
  });

  it('keeps null and undefined apart', () => {
    const a = { ...emptyDraft(), spellAttackOverride: undefined };
    const b = {
      ...emptyDraft(),
      spellAttackOverride: null,
    } as unknown as NpcFormDraft;
    expect(draftsEqual(a, b)).toBe(false);
  });
});
