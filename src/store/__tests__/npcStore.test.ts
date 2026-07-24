import { describe, it, expect, beforeEach } from 'vitest';
import { useNPCStore, migrateNpcPersistedState } from '@/store/npcStore';

const CAMPAIGN = 'test-campaign';

describe('npcStore (campaign-scoped)', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  describe('createNPC', () => {
    it('returns an id and adds the NPC to the campaign bucket', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Bartender Bob',
        armorClass: '10',
        maxHp: 8,
        speed: '30 ft.',
      });

      expect(id).toMatch(/^npc-/);
      const npcs = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN);
      expect(npcs).toHaveLength(1);
      expect(npcs[0].name).toBe('Bartender Bob');
      expect(npcs[0].campaignCode).toBe(CAMPAIGN);
    });

    it('sets createdAt and updatedAt timestamps', () => {
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Guard',
        armorClass: '16',
        maxHp: 11,
        speed: '30 ft.',
      });

      const npc = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)[0];
      expect(npc.createdAt).toBeTruthy();
      expect(npc.updatedAt).toBeTruthy();
      expect(npc.createdAt).toBe(npc.updatedAt);
    });

    it('isolates NPCs between campaigns', () => {
      useNPCStore.getState().createNPC('campaign-a', {
        name: 'NPC A',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC('campaign-b', {
        name: 'NPC B',
        armorClass: '12',
        maxHp: 10,
        speed: '25 ft.',
      });

      expect(
        useNPCStore.getState().getNPCsForCampaign('campaign-a')
      ).toHaveLength(1);
      expect(
        useNPCStore.getState().getNPCsForCampaign('campaign-b')
      ).toHaveLength(1);
      expect(
        useNPCStore.getState().getNPCsForCampaign('campaign-a')[0].name
      ).toBe('NPC A');
    });
  });

  describe('updateNPC', () => {
    it('merges updates and preserves unchanged fields', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Old Name',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore
        .getState()
        .updateNPC(CAMPAIGN, id, { name: 'New Name', armorClass: '14' });

      const npc = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)[0];
      expect(npc.name).toBe('New Name');
      expect(npc.armorClass).toBe('14');
      expect(npc.maxHp).toBe(5);
    });

    it('does not affect other NPCs', () => {
      const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'First',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Second',
        armorClass: '12',
        maxHp: 10,
        speed: '30 ft.',
      });

      useNPCStore
        .getState()
        .updateNPC(CAMPAIGN, id1, { name: 'Updated First' });

      const npcs = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN);
      expect(npcs[0].name).toBe('Updated First');
      expect(npcs[1].name).toBe('Second');
    });
  });

  describe('deleteNPC', () => {
    it('removes the NPC by id within the campaign', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Doomed NPC',
        armorClass: '10',
        maxHp: 1,
        speed: '30 ft.',
      });

      useNPCStore.getState().deleteNPC(CAMPAIGN, id);
      expect(useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)).toHaveLength(
        0
      );
    });

    it('is a no-op for unknown id', () => {
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Safe NPC',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore.getState().deleteNPC(CAMPAIGN, 'nonexistent');
      expect(useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)).toHaveLength(
        1
      );
    });
  });

  describe('getNPC', () => {
    it('returns matching NPC within the campaign', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Findable',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
      });

      const found = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(found?.name).toBe('Findable');
    });

    it('returns undefined for unknown id', () => {
      const found = useNPCStore.getState().getNPC(CAMPAIGN, 'nonexistent');
      expect(found).toBeUndefined();
    });

    it('returns undefined when searching wrong campaign', () => {
      const id = useNPCStore.getState().createNPC('campaign-a', {
        name: 'Wrong Campaign',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
      });

      const found = useNPCStore.getState().getNPC('campaign-b', id);
      expect(found).toBeUndefined();
    });
  });

  describe('getNPCsForCampaign', () => {
    it('returns empty array for unknown campaign', () => {
      expect(useNPCStore.getState().getNPCsForCampaign('unknown')).toEqual([]);
    });
  });
});

// ─── Additional action coverage ──────────────────────────────────────────────

const SPELL_BASE = {
  id: 'spell-1',
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  castingTime: '1 action',
  range: '150 feet',
  components: { verbal: true, somatic: true, material: true },
  duration: 'Instantaneous',
  description: 'A bright streak flashes from your pointing finger.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SPELLCASTING_BASE = {
  casterLevel: 5,
  ability: 'intelligence' as const,
  slotsUsed: {},
  spells: [],
};

function createNPCWithSpellcasting(campaignCode: string) {
  const id = useNPCStore.getState().createNPC(campaignCode, {
    name: 'Mage',
    armorClass: '12',
    maxHp: 40,
    speed: '30 ft.',
    spellcasting: { ...SPELLCASTING_BASE },
  });
  return id;
}

describe('npcStore — reorderNPCsSubset', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('moves an NPC from one position to another within the subset', () => {
    const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Alpha',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
    });
    const id2 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Beta',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
    });
    const id3 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Gamma',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
    });

    // Move Beta (index 1) to index 0
    useNPCStore.getState().reorderNPCsSubset(CAMPAIGN, [id1, id2, id3], 1, 0);

    const npcs = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN);
    expect(npcs[0].id).toBe(id2);
    expect(npcs[1].id).toBe(id1);
    expect(npcs[2].id).toBe(id3);
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Alpha',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
    });
    const id2 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Beta',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
    });

    useNPCStore.getState().reorderNPCsSubset(CAMPAIGN, [id1, id2], 0, 0);

    const npcs = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN);
    expect(npcs[0].id).toBe(id1);
    expect(npcs[1].id).toBe(id2);
  });
});

describe('npcStore — updateDeathSaves', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('sets death saves on the target NPC', () => {
    const id = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Dying Hero',
      armorClass: '10',
      maxHp: 10,
      speed: '30 ft.',
    });

    useNPCStore
      .getState()
      .updateDeathSaves(CAMPAIGN, id, { successes: 2, failures: 1 });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.deathSaves).toEqual({ successes: 2, failures: 1 });
  });

  it('does not affect other NPCs', () => {
    const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'NPC 1',
      armorClass: '10',
      maxHp: 10,
      speed: '30 ft.',
    });
    const id2 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'NPC 2',
      armorClass: '10',
      maxHp: 10,
      speed: '30 ft.',
    });

    useNPCStore
      .getState()
      .updateDeathSaves(CAMPAIGN, id1, { successes: 3, failures: 0 });

    const npc2 = useNPCStore.getState().getNPC(CAMPAIGN, id2);
    expect(npc2?.deathSaves).toBeUndefined();
  });
});

describe('npcStore — spell management', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  describe('addSpellToNPC', () => {
    it('appends a spell to the spellcasting spells array', () => {
      const id = createNPCWithSpellcasting(CAMPAIGN);
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(npc?.spellcasting?.spells).toHaveLength(1);
      expect(npc?.spellcasting?.spells[0].name).toBe('Fireball');
    });

    it('does nothing when NPC has no spellcasting block', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Warrior',
        armorClass: '16',
        maxHp: 50,
        speed: '30 ft.',
      });

      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(npc?.spellcasting).toBeUndefined();
    });
  });

  describe('updateSpellOnNPC', () => {
    it('merges updates into the target spell', () => {
      const id = createNPCWithSpellcasting(CAMPAIGN);
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });

      useNPCStore
        .getState()
        .updateSpellOnNPC(CAMPAIGN, id, 'spell-1', { name: 'Cone of Cold' });

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(npc?.spellcasting?.spells[0].name).toBe('Cone of Cold');
    });

    it('leaves other spells untouched', () => {
      const id = createNPCWithSpellcasting(CAMPAIGN);
      const spell2 = { ...SPELL_BASE, id: 'spell-2', name: 'Shield' };
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, spell2);

      useNPCStore
        .getState()
        .updateSpellOnNPC(CAMPAIGN, id, 'spell-1', { name: 'Thunderwave' });

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(npc?.spellcasting?.spells[1].name).toBe('Shield');
    });
  });

  describe('removeSpellFromNPC', () => {
    it('removes the specified spell by id', () => {
      const id = createNPCWithSpellcasting(CAMPAIGN);
      const spell2 = { ...SPELL_BASE, id: 'spell-2', name: 'Shield' };
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, spell2);

      useNPCStore.getState().removeSpellFromNPC(CAMPAIGN, id, 'spell-1');

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(npc?.spellcasting?.spells).toHaveLength(1);
      expect(npc?.spellcasting?.spells[0].id).toBe('spell-2');
    });

    it('is a no-op for unknown spell id', () => {
      const id = createNPCWithSpellcasting(CAMPAIGN);
      useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });

      useNPCStore.getState().removeSpellFromNPC(CAMPAIGN, id, 'no-such-spell');

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(npc?.spellcasting?.spells).toHaveLength(1);
    });
  });
});

describe('npcStore — setNPCSpellSlotUsed', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('sets used slots for the given level', () => {
    const id = createNPCWithSpellcasting(CAMPAIGN);

    // casterLevel 5 has { 1: 4, 2: 3, 3: 2 }
    useNPCStore.getState().setNPCSpellSlotUsed(CAMPAIGN, id, 3, 2);

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.spellcasting?.slotsUsed[3]).toBe(2);
  });

  it('clamps used slots to the maximum available', () => {
    const id = createNPCWithSpellcasting(CAMPAIGN);

    // Level 3 max is 2 for casterLevel 5; request 99
    useNPCStore.getState().setNPCSpellSlotUsed(CAMPAIGN, id, 3, 99);

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.spellcasting?.slotsUsed[3]).toBe(2);
  });

  it('clamps negative values to 0', () => {
    const id = createNPCWithSpellcasting(CAMPAIGN);

    useNPCStore.getState().setNPCSpellSlotUsed(CAMPAIGN, id, 1, -5);

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.spellcasting?.slotsUsed[1]).toBe(0);
  });
});

describe('npcStore — useNPCFreeCast', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('increments freeCastsUsed on the target spell', () => {
    const id = createNPCWithSpellcasting(CAMPAIGN);
    const spell = { ...SPELL_BASE, freeCastMax: 3, freeCastsUsed: 0 };
    useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, spell);

    useNPCStore.getState().useNPCFreeCast(CAMPAIGN, id, 'spell-1');

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.spellcasting?.spells[0].freeCastsUsed).toBe(1);
  });

  it('initialises from 0 when freeCastsUsed is undefined', () => {
    const id = createNPCWithSpellcasting(CAMPAIGN);
    // SPELL_BASE has no freeCastsUsed field
    useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, { ...SPELL_BASE });

    useNPCStore.getState().useNPCFreeCast(CAMPAIGN, id, 'spell-1');

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.spellcasting?.spells[0].freeCastsUsed).toBe(1);
  });
});

describe('npcStore — longRestNPC', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('restores HP to max and clears tempHp and deathSaves', () => {
    const id = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Battered Fighter',
      armorClass: '16',
      maxHp: 40,
      currentHp: 5,
      tempHp: 3,
      speed: '30 ft.',
    });
    useNPCStore
      .getState()
      .updateDeathSaves(CAMPAIGN, id, { successes: 1, failures: 2 });

    useNPCStore.getState().longRestNPC(CAMPAIGN, id);

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.currentHp).toBe(40);
    expect(npc?.tempHp).toBe(0);
    expect(npc?.deathSaves).toBeUndefined();
  });

  it('restores hit dice to max', () => {
    const id = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Fighter',
      armorClass: '16',
      maxHp: 40,
      speed: '30 ft.',
      hitDice: { current: 2, max: 5, dieType: 'd10' },
    });

    useNPCStore.getState().longRestNPC(CAMPAIGN, id);

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.hitDice?.current).toBe(5);
  });

  it('resets spell slots and freeCastsUsed for spellcasters', () => {
    const id = createNPCWithSpellcasting(CAMPAIGN);
    const spell = { ...SPELL_BASE, freeCastMax: 2, freeCastsUsed: 2 };
    useNPCStore.getState().addSpellToNPC(CAMPAIGN, id, spell);
    useNPCStore.getState().setNPCSpellSlotUsed(CAMPAIGN, id, 1, 4);

    useNPCStore.getState().longRestNPC(CAMPAIGN, id);

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id);
    expect(npc?.spellcasting?.slotsUsed).toEqual({});
    expect(npc?.spellcasting?.spells[0].freeCastsUsed).toBe(0);
  });

  it('does not affect other NPCs', () => {
    const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Resting',
      armorClass: '10',
      maxHp: 30,
      currentHp: 1,
      speed: '30 ft.',
    });
    const id2 = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Not Resting',
      armorClass: '10',
      maxHp: 30,
      currentHp: 10,
      speed: '30 ft.',
    });

    useNPCStore.getState().longRestNPC(CAMPAIGN, id1);

    const npc2 = useNPCStore.getState().getNPC(CAMPAIGN, id2);
    expect(npc2?.currentHp).toBe(10);
  });
});

describe('migrateNpcPersistedState v2 → v3 (AoE back-fill)', () => {
  const FIREBALL_DESC =
    'Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw.';

  const makeV2State = () =>
    JSON.parse(
      JSON.stringify({
        npcsByCampaign: {
          'camp-1': [
            {
              id: 'npc-1',
              campaignCode: 'camp-1',
              name: 'Cult Mage',
              armorClass: '12',
              maxHp: 22,
              speed: '30 ft.',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
              spellcasting: {
                casterLevel: 5,
                ability: 'intelligence',
                slotsUsed: {},
                spells: [
                  {
                    id: 'spell-fb',
                    name: 'Fireball',
                    level: 3,
                    school: 'Evocation',
                    castingTime: '1 action',
                    range: '150 feet',
                    components: {
                      verbal: true,
                      somatic: true,
                      material: false,
                    },
                    duration: 'Instantaneous',
                    description: FIREBALL_DESC,
                    createdAt: '2025-01-01T00:00:00.000Z',
                    updatedAt: '2025-01-01T00:00:00.000Z',
                  },
                  {
                    id: 'spell-user',
                    name: 'Custom Blast',
                    level: 1,
                    school: 'Evocation',
                    castingTime: '1 action',
                    range: '60 feet',
                    components: {
                      verbal: true,
                      somatic: false,
                      material: false,
                    },
                    duration: 'Instantaneous',
                    description: FIREBALL_DESC,
                    aoe: null, // DM explicitly cleared it
                    createdAt: '2025-01-01T00:00:00.000Z',
                    updatedAt: '2025-01-01T00:00:00.000Z',
                  },
                ],
              },
            },
            {
              id: 'npc-2',
              campaignCode: 'camp-1',
              name: 'Guard',
              armorClass: '16',
              maxHp: 11,
              speed: '30 ft.',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
              // no spellcasting — must not crash
            },
          ],
        },
      })
    );

  it('back-fills aoe on NPC spells when migrating from v2', () => {
    const migrated = migrateNpcPersistedState(makeV2State(), 2) as {
      npcsByCampaign: Record<
        string,
        { spellcasting?: { spells: { name: string; aoe?: unknown }[] } }[]
      >;
    };
    const spells = migrated.npcsByCampaign['camp-1'][0].spellcasting!.spells;
    expect(spells.find(s => s.name === 'Fireball')?.aoe).toEqual({
      shape: 'circle',
      sizeFeet: 20,
    });
  });

  it('preserves explicit null and tolerates NPCs without spellcasting', () => {
    const migrated = migrateNpcPersistedState(makeV2State(), 2) as {
      npcsByCampaign: Record<
        string,
        { spellcasting?: { spells: { name: string; aoe?: unknown }[] } }[]
      >;
    };
    const spells = migrated.npcsByCampaign['camp-1'][0].spellcasting!.spells;
    expect(spells.find(s => s.name === 'Custom Blast')?.aoe).toBeNull();
    expect(migrated.npcsByCampaign['camp-1'][1]).toBeDefined(); // Guard survived
  });

  it('still handles the legacy v1 flat-array shape', () => {
    const v1 = {
      npcs: [
        {
          id: 'npc-old',
          name: 'Old Timer',
          armorClass: '10',
          maxHp: 5,
          speed: '30 ft.',
          campaignCode: 'camp-x',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };
    const migrated = migrateNpcPersistedState(v1, 1) as {
      npcsByCampaign: Record<string, { name: string }[]>;
    };
    expect(migrated.npcsByCampaign['camp-x']).toHaveLength(1);
  });
});
