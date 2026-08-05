import { describe, it, expect } from 'vitest';
import {
  ensureStatBlockEntryIds,
  getEntryAbilityConfig,
  buildAbilitiesFromNormalizedBlock,
  reconcileEntityAbilities,
  findEntryById,
  formatAbilityUsageLabel,
} from '@/utils/statBlockAbilities';
import type {
  MonsterStatBlock,
  StatBlockEntry,
  MonsterAbility,
} from '@/types/encounter';

function block(overrides: Partial<MonsterStatBlock> = {}): MonsterStatBlock {
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
    type: 'Humanoid',
    size: 'Medium',
    languages: '',
    alignment: '',
    hpFormula: '',
    ...overrides,
  };
}

/**
 * Simulates a pre-2026-03-24 persisted stat block that predates the
 * bonusActions/lairActions fields entirely (not just empty arrays — the
 * keys are absent). Cast through `unknown` since the real MonsterStatBlock
 * type requires them.
 */
function legacyBlockMissingSections(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  const full = block(overrides);
  const legacy = { ...full } as Partial<MonsterStatBlock>;
  delete legacy.bonusActions;
  delete legacy.lairActions;
  return legacy as unknown as MonsterStatBlock;
}

describe('legacy stat blocks missing bonusActions/lairActions', () => {
  it('ensureStatBlockEntryIds does not throw and backfills both arrays with ids assigned', () => {
    const legacy = legacyBlockMissingSections({
      traits: [{ name: 'T', text: '' }],
      actions: [{ name: 'A', text: '' }],
      reactions: [{ name: 'R', text: '' }],
    });
    let out!: MonsterStatBlock;
    expect(() => {
      out = ensureStatBlockEntryIds(legacy);
    }).not.toThrow();
    expect(out.bonusActions).toEqual([]);
    expect(out.lairActions).toEqual([]);
    expect(out.traits[0].id).toMatch(/^entry-/);
    expect(out.actions[0].id).toMatch(/^entry-/);
    expect(out.reactions[0].id).toMatch(/^entry-/);
  });

  it('findEntryById does not throw on a block missing sections', () => {
    const legacy = legacyBlockMissingSections({
      actions: [{ id: 'entry-a', name: 'A', text: '' }],
    });
    expect(() => findEntryById(legacy, 'entry-a')).not.toThrow();
    expect(findEntryById(legacy, 'entry-a')?.id).toBe('entry-a');
    expect(findEntryById(legacy, 'no-such-id')).toBeUndefined();
  });

  it('buildAbilitiesFromNormalizedBlock does not throw on a block missing sections', () => {
    const normalized = ensureStatBlockEntryIds(
      legacyBlockMissingSections({
        actions: [{ name: 'Smite', text: '', uses: 3 }],
      })
    );
    expect(() => buildAbilitiesFromNormalizedBlock(normalized)).not.toThrow();
    expect(buildAbilitiesFromNormalizedBlock(normalized)).toHaveLength(1);
  });

  it('reconcileEntityAbilities does not throw on a block missing sections', () => {
    const normalized = ensureStatBlockEntryIds(
      legacyBlockMissingSections({
        actions: [{ name: 'Smite', text: '', uses: 3 }],
      })
    );
    expect(() => reconcileEntityAbilities(normalized, [])).not.toThrow();
    expect(reconcileEntityAbilities(normalized, [])).toHaveLength(1);
  });
});

describe('ensureStatBlockEntryIds', () => {
  it('assigns ids to entries missing them across all five sections', () => {
    const out = ensureStatBlockEntryIds(
      block({
        traits: [{ name: 'T', text: '' }],
        actions: [{ name: 'A', text: '' }],
        bonusActions: [{ name: 'B', text: '' }],
        reactions: [{ name: 'R', text: '' }],
        lairActions: [{ name: 'L', text: '' }],
      })
    );
    const ids = [
      out.traits[0].id,
      out.actions[0].id,
      out.bonusActions[0].id,
      out.reactions[0].id,
      out.lairActions[0].id,
    ];
    for (const id of ids) expect(id).toMatch(/^entry-/);
    expect(new Set(ids).size).toBe(5);
  });

  it('preserves existing ids and is idempotent', () => {
    const input = block({
      actions: [
        { id: 'entry-keep', name: 'A', text: '' },
        { name: 'B', text: '' },
      ],
    });
    const once = ensureStatBlockEntryIds(input);
    expect(once.actions[0].id).toBe('entry-keep');
    const twice = ensureStatBlockEntryIds(once);
    expect(twice.actions.map(e => e.id)).toEqual(once.actions.map(e => e.id));
  });

  it('repairs duplicate ids (first keeps, later duplicates get fresh unique ids)', () => {
    const out = ensureStatBlockEntryIds(
      block({
        traits: [{ id: 'dup', name: 'T', text: '' }],
        actions: [{ id: 'dup', name: 'A', text: '' }],
      })
    );
    expect(out.traits[0].id).toBe('dup');
    expect(out.actions[0].id).not.toBe('dup');
    expect(out.actions[0].id).toMatch(/^entry-/);
  });

  it('does not mutate the input', () => {
    const input = block({ actions: [{ name: 'A', text: '' }] });
    ensureStatBlockEntryIds(input);
    expect(input.actions[0].id).toBeUndefined();
  });
});

describe('getEntryAbilityConfig', () => {
  it('uses > 0 takes precedence over name parse', () => {
    const cfg = getEntryAbilityConfig({
      name: 'Breath (Recharge 5-6)',
      text: '',
      uses: 3,
    });
    expect(cfg).toEqual({
      maxUses: 3,
      usageType: 'recharge',
      rechargeOn: 5,
      restType: undefined,
    });
  });

  it('uses > 0 on an unmarked name defaults to per-day', () => {
    expect(getEntryAbilityConfig({ name: 'Smite', text: '', uses: 2 })).toEqual(
      {
        maxUses: 2,
        usageType: 'per-day',
        rechargeOn: undefined,
        restType: undefined,
      }
    );
  });

  it('parsed per-day uses the parsed maximum', () => {
    expect(
      getEntryAbilityConfig({ name: 'Teleport (3/Day)', text: '' })?.maxUses
    ).toBe(3);
  });

  it('recharge and per-rest entries get maximum 1', () => {
    expect(
      getEntryAbilityConfig({ name: 'Breath (Recharge 5-6)', text: '' })
    ).toMatchObject({ maxUses: 1, usageType: 'recharge', rechargeOn: 5 });
    expect(
      getEntryAbilityConfig({
        name: 'Chains (Recharges after a Short or Long Rest)',
        text: '',
      })
    ).toMatchObject({ maxUses: 1, usageType: 'per-rest', restType: 'short' });
  });

  it('unmarked entries without uses are untrackable (null)', () => {
    expect(getEntryAbilityConfig({ name: 'Bite', text: '' })).toBeNull();
    expect(
      getEntryAbilityConfig({ name: 'Bite', text: '', uses: 0 })
    ).toBeNull();
  });
});

describe('buildAbilitiesFromNormalizedBlock', () => {
  const nb = ensureStatBlockEntryIds(
    block({
      actions: [
        { name: 'Breath (Recharge 5-6)', text: 'fire' },
        { name: 'Bite', text: 'chomp' },
      ],
      reactions: [{ name: 'Parry (2/Day)', text: 'blocks' }],
      lairActions: [{ name: 'Tremor (1/Day)', text: 'shakes' }],
    })
  );

  it('builds abilities for trackable entries in all five sections with id === entry.id', () => {
    const abilities = buildAbilitiesFromNormalizedBlock(nb);
    expect(abilities).toHaveLength(3);
    expect(abilities.map(a => a.id)).toEqual([
      nb.actions[0].id,
      nb.reactions[0].id,
      nb.lairActions[0].id,
    ]);
    expect(abilities[0]).toMatchObject({
      usageType: 'recharge',
      maxUses: 1,
      usedUses: 0,
    });
  });

  it('seeds usedUses from the usage map, clamped to max', () => {
    const abilities = buildAbilitiesFromNormalizedBlock(nb, {
      [nb.reactions[0].id as string]: 5, // max is 2 → clamps
      [nb.actions[0].id as string]: 1,
    });
    expect(abilities.find(a => a.id === nb.reactions[0].id)!.usedUses).toBe(2);
    expect(abilities.find(a => a.id === nb.actions[0].id)!.usedUses).toBe(1);
  });

  it('stamps provenance: default entity, explicit npc', () => {
    expect(buildAbilitiesFromNormalizedBlock(nb)[0].source).toBe('entity');
    expect(
      buildAbilitiesFromNormalizedBlock(nb, undefined, 'npc')[0].source
    ).toBe('npc');
  });
});

describe('formatAbilityUsageLabel', () => {
  it('derives labels from ability config, never a name string', () => {
    expect(formatAbilityUsageLabel({ usageType: 'per-day', maxUses: 3 })).toBe(
      '3/Day'
    );
    expect(
      formatAbilityUsageLabel({
        usageType: 'recharge',
        maxUses: 1,
        rechargeOn: 5,
      })
    ).toBe('Recharge 5-6');
    expect(
      formatAbilityUsageLabel({
        usageType: 'per-rest',
        maxUses: 1,
        restType: 'short',
      })
    ).toBe('Recharges after a Short or Long Rest');
    expect(
      formatAbilityUsageLabel({
        usageType: 'per-rest',
        maxUses: 1,
        restType: 'long',
      })
    ).toBe('Recharges after a Long Rest');
  });
});

describe('reconcileEntityAbilities', () => {
  const nb = ensureStatBlockEntryIds(
    block({
      actions: [
        { name: 'Smite', text: '', uses: 3 },
        { name: 'Bite', text: '' },
      ],
    })
  );
  const smiteId = nb.actions[0].id as string;
  const prev: MonsterAbility[] = [
    {
      id: smiteId,
      name: 'Smite',
      description: '',
      usageType: 'per-day',
      maxUses: 3,
      usedUses: 2,
      source: 'npc',
    },
  ];

  it('preserves usedUses by id through text edits', () => {
    const edited = {
      ...nb,
      actions: [
        { ...nb.actions[0], text: 'now with more smiting' },
        nb.actions[1],
      ],
    };
    const out = reconcileEntityAbilities(edited, prev);
    expect(out.find(a => a.id === smiteId)!.usedUses).toBe(2);
  });

  it('clamps usedUses when max decreased and drops untrackable/deleted entries', () => {
    const edited = {
      ...nb,
      actions: [{ ...nb.actions[0], uses: 1 }], // Bite deleted, Smite max 3→1
    };
    const out = reconcileEntityAbilities(edited, prev);
    expect(out).toHaveLength(1);
    expect(out[0].usedUses).toBe(1);
  });

  it('adds an ability when an entry becomes trackable', () => {
    const edited = {
      ...nb,
      actions: [nb.actions[0], { ...nb.actions[1], uses: 2 }],
    };
    const out = reconcileEntityAbilities(edited, prev);
    expect(out).toHaveLength(2);
    expect(out.find(a => a.id === nb.actions[1].id)!.usedUses).toBe(0);
  });

  it('resolveAuthoritativeEntry wins over the entity-edited entry (NPC config wins)', () => {
    const edited = {
      ...nb,
      actions: [{ ...nb.actions[0], uses: 9 }, nb.actions[1]], // entity edit says 9
    };
    const npcEntry: StatBlockEntry = {
      id: smiteId,
      name: 'Smite',
      text: '',
      uses: 3,
    };
    const out = reconcileEntityAbilities(edited, prev, id =>
      id === smiteId ? npcEntry : undefined
    );
    expect(out.find(a => a.id === smiteId)!.maxUses).toBe(3); // NPC's 3, not 9
    expect(out.find(a => a.id === smiteId)!.source).toBe('npc');
  });

  it("drops a source 'npc' ability whose entry was deleted on the NPC (never demotes to entity-local)", () => {
    // Entity block still contains the entry, but the resolver (NPC) no longer knows it.
    const out = reconcileEntityAbilities(nb, prev, () => undefined);
    expect(out.some(a => a.id === smiteId)).toBe(false);
  });

  it("entries unknown to the resolver with no prior 'npc' provenance stay entity-local (combat-added)", () => {
    const edited = {
      ...nb,
      actions: [
        ...nb.actions,
        { id: 'entry-new', name: 'Roar (1/Day)', text: '' },
      ],
    };
    const out = reconcileEntityAbilities(edited, [], id =>
      id === smiteId ? nb.actions[0] : undefined
    );
    const roar = out.find(a => a.id === 'entry-new')!;
    expect(roar.source).toBe('entity');
    // And an entity-sourced ability survives later reconciles even though the resolver doesn't know it.
    const again = reconcileEntityAbilities(edited, out, id =>
      id === smiteId ? nb.actions[0] : undefined
    );
    expect(again.some(a => a.id === 'entry-new')).toBe(true);
  });
});
