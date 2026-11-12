import { describe, expect, it } from 'vitest';
import { emptyDraft, draftFromNpc } from '../npcFormDraft';
import type { NpcFormDraft } from '../npcFormDraft';
import {
  buildNpcPayload,
  canSubmitDraft,
  submitBlocker,
} from '../npcFormPayload';
import {
  CASTER_NPC,
  KI,
  QUICK_NPC_BARE,
  QUICK_NPC_WITH_SCORES,
  STAT_BLOCK_NPC,
  withoutMeta,
} from './npcFormFixtures';

describe('buildNpcPayload round trips', () => {
  it('rebuilds a stat block NPC unchanged', () => {
    expect(
      buildNpcPayload(draftFromNpc(STAT_BLOCK_NPC), STAT_BLOCK_NPC)
    ).toEqual(withoutMeta(STAT_BLOCK_NPC));
  });

  it('rebuilds a caster NPC unchanged', () => {
    expect(buildNpcPayload(draftFromNpc(CASTER_NPC), CASTER_NPC)).toEqual(
      withoutMeta(CASTER_NPC)
    );
  });
});

describe('buildNpcPayload V195', () => {
  it.each([
    ['with ability scores', QUICK_NPC_WITH_SCORES, 16, 2],
    ['with neither scores nor a stat block', QUICK_NPC_BARE, 10, 0],
  ])('keeps the record fields for a quick NPC %s', (_label, npc, wis, init) => {
    const payload = buildNpcPayload(draftFromNpc(npc), npc);
    expect(payload.resources).toEqual([KI]);
    expect(payload.hitDice).toEqual({ max: 3, current: 2, dieType: 'd8' });
    expect(payload.proficiencyBonus).toBe(3);
    expect(payload.passivePerception).toBe(14);
    expect(payload.passiveInsight).toBe(10);
    expect(payload.passiveInvestigation).toBe(10);
    expect(payload.monsterStatBlock?.wis).toBe(wis);
    expect(payload.monsterStatBlock?.passivePerception).toBe(14);
    expect(payload.initiativeModifier).toBe(init);
  });
});

describe('buildNpcPayload stat block and slots', () => {
  it('always builds a stat block, even for a default bestiary-linked draft', () => {
    const payload = buildNpcPayload({
      ...emptyDraft(),
      name: 'X',
      bestiarySourceId: 'mon-goblin',
    });
    expect(payload.monsterStatBlock).toBeDefined();
    expect(payload.bestiarySourceId).toBe('mon-goblin');
  });

  it('drops cleared slot overrides', () => {
    const draft: NpcFormDraft = {
      ...emptyDraft(),
      name: 'X',
      spellcastingEnabled: true,
      spellSlotOverrides: { 1: 2, 2: undefined },
    };
    expect(buildNpcPayload(draft).spellcasting?.slotOverrides).toEqual({
      1: 2,
    });
  });

  it('leaves slotOverrides undefined when there are none', () => {
    const draft: NpcFormDraft = {
      ...emptyDraft(),
      name: 'X',
      spellcastingEnabled: true,
      spellSlotOverrides: {},
    };
    expect(buildNpcPayload(draft).spellcasting?.slotOverrides).toBeUndefined();
  });

  it('takes slotsUsed from the record being edited', () => {
    const payload = buildNpcPayload(draftFromNpc(CASTER_NPC), CASTER_NPC);
    expect(payload.spellcasting?.slotsUsed).toEqual({ 1: 1 });
    expect(
      buildNpcPayload({
        ...emptyDraft(),
        name: 'X',
        spellcastingEnabled: true,
      }).spellcasting?.slotsUsed
    ).toEqual({});
  });

  it('strips a resource cost that names a missing resource', () => {
    const draft: NpcFormDraft = {
      ...emptyDraft(),
      name: 'X',
      actions: [
        {
          id: 'a1',
          name: 'Strike',
          text: '',
          resourceCost: { resourceId: 'gone', amount: 1 },
        },
      ],
    };
    const payload = buildNpcPayload(draft);
    expect(payload.monsterStatBlock?.actions[0].resourceCost).toBeUndefined();
  });

  it('keeps a resource cost that names a kept resource', () => {
    const draft: NpcFormDraft = {
      ...emptyDraft(),
      name: 'X',
      resources: [KI],
      actions: [
        {
          id: 'a1',
          name: 'Strike',
          text: '',
          resourceCost: { resourceId: KI.id, amount: 1 },
        },
      ],
    };
    const payload = buildNpcPayload(draft);
    expect(payload.monsterStatBlock?.actions[0].resourceCost).toEqual({
      resourceId: KI.id,
      amount: 1,
    });
  });
});

describe('canSubmitDraft', () => {
  it('needs a name', () => {
    expect(canSubmitDraft({ ...emptyDraft(), name: '  ' })).toBe(false);
  });

  it('rejects a resource with no max uses', () => {
    expect(
      canSubmitDraft({
        ...emptyDraft(),
        name: 'X',
        resources: [{ ...KI, maxUses: undefined }],
      })
    ).toBe(false);
  });

  it('rejects an entry with an invalid resource cost', () => {
    expect(
      canSubmitDraft({
        ...emptyDraft(),
        name: 'X',
        traits: [
          {
            id: 't',
            name: 'T',
            text: '',
            resourceCost: { resourceId: 'r', amount: 0 },
          },
        ],
      })
    ).toBe(false);
  });

  it('accepts a loaded NPC', () => {
    expect(canSubmitDraft(draftFromNpc(STAT_BLOCK_NPC))).toBe(true);
  });
});

describe('submitBlocker', () => {
  const badResource = { ...KI, maxUses: undefined };

  it('names the blank name first, even when a resource is also invalid', () => {
    expect(
      submitBlocker({ ...emptyDraft(), name: ' ', resources: [badResource] })
    ).toBe('name');
  });

  it('names an invalid resource draft', () => {
    expect(
      submitBlocker({ ...emptyDraft(), name: 'X', resources: [badResource] })
    ).toBe('resources');
  });

  it('names an entry whose resource cost amount is invalid', () => {
    expect(
      submitBlocker({
        ...emptyDraft(),
        name: 'X',
        resources: [KI],
        actions: [
          {
            id: 'a',
            name: 'A',
            text: '',
            resourceCost: { resourceId: KI.id, amount: 0 },
          },
        ],
      })
    ).toBe('costs');
  });

  it('is null for a valid draft', () => {
    expect(submitBlocker(draftFromNpc(STAT_BLOCK_NPC))).toBeNull();
  });
});
