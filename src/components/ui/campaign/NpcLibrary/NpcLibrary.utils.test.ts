import { describe, expect, it } from 'vitest';

import {
  creatureMetaLine,
  creaturePassives,
  creatureVitals,
  LIBRARY_COPY,
} from './NpcLibrary.utils';

import type { CampaignNPC, MonsterStatBlock } from '@/types/encounter';

const makeNpc = (overrides: Partial<CampaignNPC> = {}): CampaignNPC => ({
  id: 'npc-1',
  campaignCode: 'ABC123',
  name: 'Brenn',
  armorClass: '15',
  maxHp: 44,
  speed: '30 ft.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const statBlock = (overrides: Partial<MonsterStatBlock>): MonsterStatBlock =>
  overrides as MonsterStatBlock;

const casterLevel5 = {
  casterLevel: 5,
} as unknown as CampaignNPC['spellcasting'];

describe('creatureMetaLine', () => {
  it('builds the meta line from size, type, CR and caster level', () => {
    expect(
      creatureMetaLine(
        makeNpc({
          monsterStatBlock: statBlock({
            size: 'Medium',
            type: 'humanoid',
            cr: '2',
          }),
          spellcasting: casterLevel5,
        })
      )
    ).toBe('Medium humanoid · CR 2 · Caster level 5');
    expect(
      creatureMetaLine(
        makeNpc({
          monsterStatBlock: statBlock({
            size: 'Medium',
            type: 'humanoid',
            cr: '',
          }),
        })
      )
    ).toBe('Medium humanoid');
    expect(creatureMetaLine(makeNpc())).toBe('');
    expect(creatureMetaLine(makeNpc({ spellcasting: casterLevel5 }))).toBe(
      'Caster level 5'
    );
  });
});

describe('creatureVitals', () => {
  it('prints AC, HP and speed as stored', () => {
    expect(creatureVitals(makeNpc({ tempAc: '2 (shield)' }))).toEqual([
      'AC 15 (+2)',
      '44 HP',
      'Speed 30 ft.',
    ]);
    expect(
      creatureVitals(makeNpc({ armorClass: '16 (natural armor)' }))[0]
    ).toBe('AC 16 (natural armor)');
    expect(
      creatureVitals(makeNpc({ tempAc: '2 (shield)', speed: '' }))
    ).toEqual(['AC 15 (+2)', '44 HP']);
  });
});

describe('creaturePassives', () => {
  it('lists only the passive scores that are set', () => {
    expect(
      creaturePassives(
        makeNpc({ passivePerception: 14, passiveInvestigation: 11 })
      )
    ).toEqual([
      { label: 'Perception', value: 14 },
      { label: 'Investigation', value: 11 },
    ]);
    expect(creaturePassives(makeNpc())).toEqual([]);
  });
});

describe('LIBRARY_COPY', () => {
  it('holds the copy for each library', () => {
    const {
      moveLabel: npcMove,
      deleteMessage: npcDelete,
      ...npc
    } = LIBRARY_COPY.npc;
    expect(npc).toEqual({
      heading: 'NPCs',
      createLabel: 'Create NPC',
      emptyHeading: 'No NPCs yet',
      emptyBody:
        'NPCs you create here can join any encounter in this campaign.',
      searchLabel: 'Search NPCs',
      searchPlaceholder: 'Brenn',
      noMatch: 'No NPCs match these filters.',
      deleteConfirm: 'Delete NPC',
      entityLabel: 'NPC',
    });
    expect(npcMove('Brenn')).toBe('Move Brenn to custom monsters');
    expect(npcDelete('Brenn')).toBe(
      "Brenn is removed from this campaign's NPCs. Encounters that already include them keep their copy."
    );

    const {
      moveLabel: monsterMove,
      deleteMessage: monsterDelete,
      ...monster
    } = LIBRARY_COPY.monster;
    expect(monster).toEqual({
      heading: 'Custom monsters',
      createLabel: 'Create custom monster',
      emptyHeading: 'No custom monsters yet',
      emptyBody:
        'Custom monsters you create here can join any encounter in this campaign.',
      searchLabel: 'Search custom monsters',
      searchPlaceholder: 'Dire wolf',
      noMatch: 'No custom monsters match these filters.',
      deleteConfirm: 'Delete custom monster',
      entityLabel: 'Custom Monster',
    });
    expect(monsterMove('Dire Wolf')).toBe('Move Dire Wolf to NPCs');
    expect(monsterDelete('Dire Wolf')).toBe(
      "Dire Wolf is removed from this campaign's custom monsters. Encounters that already include them keep their copy."
    );
  });
});
