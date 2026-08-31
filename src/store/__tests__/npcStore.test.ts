import { describe, it, expect, beforeEach } from 'vitest';
import type { NpcResource, MonsterStatBlock } from '@/types/encounter';
import { useNPCStore, migrateNpcPersistedState } from '@/store/npcStore';

const CAMPAIGN = 'test-campaign';

describe('npcStore (campaign-scoped)', () => {
  beforeEach(() => {
    localStorage.clear();
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

    it('mints cross-device stable ids and persists the versioned envelope', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Bartender Bob',
        armorClass: '10',
        maxHp: 8,
        speed: '30 ft.',
      });
      expect(id).toMatch(/^npc-[0-9a-f-]{36}$/);

      const persisted = JSON.parse(
        localStorage.getItem('rollkeeper-npc-data')!
      );
      expect(persisted.version).toBe(4);
      expect(Object.keys(persisted.state)).toEqual(['npcsByCampaign']);
      expect(persisted.state.npcsByCampaign[CAMPAIGN]).toHaveLength(1);
      expect(persisted.state.npcsByCampaign[CAMPAIGN][0]).toMatchObject({
        id,
        campaignCode: CAMPAIGN,
        name: 'Bartender Bob',
      });
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

  describe('duplicateNPC', () => {
    it('copies all NPC data with a fresh identity and independent nested data', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Town Guard',
        armorClass: '16 (chain mail)',
        maxHp: 18,
        currentHp: 11,
        speed: '30 ft.',
        tags: ['guard', 'human'],
        inventory: [
          { id: 'item-1', name: 'Spear', quantity: 1, equipped: true },
        ],
      });

      const duplicateId = useNPCStore.getState().duplicateNPC(CAMPAIGN, id);
      const [source, duplicate] = useNPCStore
        .getState()
        .getNPCsForCampaign(CAMPAIGN);

      expect(duplicateId).toMatch(/^npc-/);
      expect(duplicateId).not.toBe(id);
      expect(duplicate).toMatchObject({
        name: 'Town Guard (Copy)',
        armorClass: source.armorClass,
        maxHp: source.maxHp,
        currentHp: source.currentHp,
        speed: source.speed,
        tags: source.tags,
        inventory: source.inventory,
      });
      expect(duplicate.tags).not.toBe(source.tags);
      expect(duplicate.inventory).not.toBe(source.inventory);
      expect(duplicate.inventory?.[0]).not.toBe(source.inventory?.[0]);
    });

    it('numbers repeated copies without colliding with existing names', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Bandit',
        armorClass: '12',
        maxHp: 11,
        speed: '30 ft.',
      });

      useNPCStore.getState().duplicateNPC(CAMPAIGN, id);
      useNPCStore.getState().duplicateNPC(CAMPAIGN, id);
      const copyId = useNPCStore
        .getState()
        .getNPCsForCampaign(CAMPAIGN)
        .find(npc => npc.name === 'Bandit (Copy)')!.id;
      useNPCStore.getState().duplicateNPC(CAMPAIGN, copyId);

      expect(
        useNPCStore
          .getState()
          .getNPCsForCampaign(CAMPAIGN)
          .map(npc => npc.name)
      ).toEqual([
        'Bandit',
        'Bandit (Copy)',
        'Bandit (Copy 2)',
        'Bandit (Copy 3)',
      ]);
    });

    it('does nothing when the source NPC does not exist', () => {
      expect(
        useNPCStore.getState().duplicateNPC(CAMPAIGN, 'missing')
      ).toBeUndefined();
      expect(useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)).toEqual([]);
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

function makeResource(overrides: Partial<NpcResource> = {}): NpcResource {
  return {
    id: 'res-ws',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    maxUses: 4,
    usesExpended: 0,
    shortRestReset: 1,
    ...overrides,
  };
}

function createNpcWithResources(resources: NpcResource[]): string {
  const id = useNPCStore.getState().createNPC(CAMPAIGN, {
    name: 'Druid Elder',
    armorClass: '13',
    maxHp: 45,
    speed: '30 ft.',
    resources,
  });
  return id;
}

describe('npcStore — class resources', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  describe('spendNpcResource', () => {
    it('spends exactly amount and returns true when affordable', () => {
      const id = createNpcWithResources([makeResource({ usesExpended: 1 })]);
      const ok = useNPCStore
        .getState()
        .spendNpcResource(CAMPAIGN, id, 'res-ws', 2);
      expect(ok).toBe(true);
      expect(
        useNPCStore.getState().getNPC(CAMPAIGN, id)!.resources![0].usesExpended
      ).toBe(3);
    });

    it('is atomic: cost 2 with only 1 remaining mutates nothing and returns false', () => {
      const id = createNpcWithResources([makeResource({ usesExpended: 3 })]);
      const ok = useNPCStore
        .getState()
        .spendNpcResource(CAMPAIGN, id, 'res-ws', 2);
      expect(ok).toBe(false);
      expect(
        useNPCStore.getState().getNPC(CAMPAIGN, id)!.resources![0].usesExpended
      ).toBe(3);
    });

    it('unknown resourceId is a no-op returning false', () => {
      const id = createNpcWithResources([makeResource()]);
      expect(
        useNPCStore.getState().spendNpcResource(CAMPAIGN, id, 'nope', 1)
      ).toBe(false);
    });

    it('rejects zero, negative, and fractional amounts without mutation', () => {
      const id = createNpcWithResources([makeResource({ usesExpended: 2 })]);
      for (const bad of [0, -1, 1.5]) {
        expect(
          useNPCStore.getState().spendNpcResource(CAMPAIGN, id, 'res-ws', bad)
        ).toBe(false);
      }
      expect(
        useNPCStore.getState().getNPC(CAMPAIGN, id)!.resources![0].usesExpended
      ).toBe(2);
    });
  });

  describe('restoreNpcResource', () => {
    it('restores amount, flooring at 0', () => {
      const id = createNpcWithResources([makeResource({ usesExpended: 1 })]);
      useNPCStore.getState().restoreNpcResource(CAMPAIGN, id, 'res-ws', 3);
      expect(
        useNPCStore.getState().getNPC(CAMPAIGN, id)!.resources![0].usesExpended
      ).toBe(0);
    });

    it('ignores zero, negative, and fractional amounts (a negative restore must not raise expenditure)', () => {
      const id = createNpcWithResources([makeResource({ usesExpended: 2 })]);
      for (const bad of [0, -3, 0.5]) {
        useNPCStore.getState().restoreNpcResource(CAMPAIGN, id, 'res-ws', bad);
      }
      expect(
        useNPCStore.getState().getNPC(CAMPAIGN, id)!.resources![0].usesExpended
      ).toBe(2);
    });
  });

  describe('shortRestNPC', () => {
    it('applies per-resource short rest rules and touches nothing else', () => {
      const id = createNpcWithResources([
        makeResource({ id: 'a', usesExpended: 3, shortRestReset: 1 }),
        makeResource({ id: 'b', usesExpended: 2, shortRestReset: 'all' }),
        makeResource({ id: 'c', usesExpended: 2, shortRestReset: 0 }),
      ]);
      useNPCStore.getState().updateNPC(CAMPAIGN, id, { currentHp: 10 });
      useNPCStore.getState().shortRestNPC(CAMPAIGN, id);
      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
      expect(npc.resources!.map(r => r.usesExpended)).toEqual([2, 0, 2]);
      expect(npc.currentHp).toBe(10); // HP untouched by short rest
    });

    it('is a no-op for legacy NPCs without resources', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Legacy Bob',
        armorClass: '10',
        maxHp: 8,
        speed: '30 ft.',
      });
      expect(() =>
        useNPCStore.getState().shortRestNPC(CAMPAIGN, id)
      ).not.toThrow();
      expect(
        useNPCStore.getState().getNPC(CAMPAIGN, id)!.resources
      ).toBeUndefined();
    });
  });

  describe('longRestNPC — resources', () => {
    it('zeroes every resource regardless of shortRestReset', () => {
      const id = createNpcWithResources([
        makeResource({ id: 'a', usesExpended: 3, shortRestReset: 0 }),
        makeResource({ id: 'b', usesExpended: 2, shortRestReset: 'all' }),
      ]);
      useNPCStore.getState().longRestNPC(CAMPAIGN, id);
      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
      expect(npc.resources!.map(r => r.usesExpended)).toEqual([0, 0]);
    });

    it('still works for legacy NPCs without resources', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Legacy Bob',
        armorClass: '10',
        maxHp: 8,
        currentHp: 3,
        speed: '30 ft.',
      });
      useNPCStore.getState().longRestNPC(CAMPAIGN, id);
      expect(useNPCStore.getState().getNPC(CAMPAIGN, id)!.currentHp).toBe(8);
    });
  });
});

function statBlockFixture(): MonsterStatBlock {
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
    actions: [
      { id: 'entry-smite', name: 'Smite', text: 'holy', uses: 3 },
      { id: 'entry-bite', name: 'Bite', text: 'chomp' },
      {
        id: 'entry-elemental',
        name: 'Elemental Form',
        text: 'transforms',
        uses: 2,
        resourceCost: { resourceId: 'res-ws', amount: 2 },
      },
    ],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'Humanoid',
    size: 'Medium',
    languages: '',
    alignment: '',
    hpFormula: '',
  };
}

function createAbilityNpc(): string {
  return useNPCStore.getState().createNPC(CAMPAIGN, {
    name: 'Druid Elder',
    armorClass: '13',
    maxHp: 45,
    speed: '30 ft.',
    monsterStatBlock: statBlockFixture(),
    resources: [
      {
        id: 'res-ws',
        name: 'Wild Shape',
        icon: 'paw-print',
        color: 'emerald',
        displayStyle: 'pips',
        maxUses: 4,
        usesExpended: 0,
        shortRestReset: 1,
      },
    ],
  });
}

describe('npc inventory costs', () => {
  beforeEach(() => {
    localStorage.clear();
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('atomically consumes inventory for an unlimited action', () => {
    const block = statBlockFixture();
    block.actions[1] = {
      ...block.actions[1],
      inventoryCost: { inventoryItemId: 'arrows', quantity: 1 },
    };
    const id = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'Archer',
      armorClass: '14',
      maxHp: 12,
      speed: '30 ft.',
      monsterStatBlock: block,
      inventory: [{ id: 'arrows', name: 'Arrows', quantity: 1 }],
    });

    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-bite')
    ).toBe(true);
    expect(
      useNPCStore.getState().getNPC(CAMPAIGN, id)?.inventory?.[0].quantity
    ).toBe(0);
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-bite')
    ).toBe(false);
    expect(
      useNPCStore.getState().getNPC(CAMPAIGN, id)?.inventory?.[0].quantity
    ).toBe(0);
  });
});

describe('npcStore — entry id enforcement', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('returns a migrated copy instead of mutating persisted NPC state', () => {
    const persisted = { npcsByCampaign: { [CAMPAIGN]: [] } };

    const out = migrateNpcPersistedState(persisted, 3);

    expect(out).not.toBe(persisted);
    expect(out.npcsByCampaign).not.toBe(persisted.npcsByCampaign);
  });

  it('migration v4 backfills missing ids and is idempotent', () => {
    const legacy = {
      npcsByCampaign: {
        [CAMPAIGN]: [
          {
            id: 'npc-old',
            campaignCode: CAMPAIGN,
            name: 'Old NPC',
            armorClass: '10',
            maxHp: 8,
            speed: '30 ft.',
            monsterStatBlock: {
              ...statBlockFixture(),
              actions: [{ name: 'Slam', text: 'thud' }], // no id
            },
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
      },
    };
    const once = migrateNpcPersistedState(structuredClone(legacy), 3);
    const npc = once.npcsByCampaign[CAMPAIGN][0];
    expect(npc.monsterStatBlock!.actions[0].id).toMatch(/^entry-/);
    const twice = migrateNpcPersistedState(structuredClone(once), 4);
    expect(
      twice.npcsByCampaign[CAMPAIGN][0].monsterStatBlock!.actions[0].id
    ).toBe(npc.monsterStatBlock!.actions[0].id);
  });

  it('migration v4 does not throw on a legacy monsterStatBlock missing bonusActions/lairActions entirely', () => {
    const fixture = statBlockFixture() as Partial<MonsterStatBlock>;
    delete fixture.bonusActions;
    delete fixture.lairActions;
    const legacy = {
      npcsByCampaign: {
        [CAMPAIGN]: [
          {
            id: 'npc-old',
            campaignCode: CAMPAIGN,
            name: 'Old NPC',
            armorClass: '10',
            maxHp: 8,
            speed: '30 ft.',
            monsterStatBlock: fixture,
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
      },
    };
    let migrated!: ReturnType<typeof migrateNpcPersistedState>;
    expect(() => {
      migrated = migrateNpcPersistedState(structuredClone(legacy), 3);
    }).not.toThrow();
    const npc = migrated.npcsByCampaign[CAMPAIGN][0];
    expect(npc.monsterStatBlock!.bonusActions).toEqual([]);
    expect(npc.monsterStatBlock!.lairActions).toEqual([]);
    expect(npc.monsterStatBlock!.actions[0].id).toBe('entry-smite');
  });

  it('createNPC normalizes missing ids; updateNPC preserves existing ids and prunes orphan usage', () => {
    const id = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'N',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
      monsterStatBlock: {
        ...statBlockFixture(),
        actions: [{ name: 'Slam', text: 'thud', uses: 1 }],
      },
    });
    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    const entryId = npc.monsterStatBlock!.actions[0].id!;
    expect(entryId).toMatch(/^entry-/);

    useNPCStore.getState().updateNPC(CAMPAIGN, id, {
      abilityUsage: { [entryId]: 1, 'entry-ghost': 2 },
    });
    // Update the stat block: entry survives with same id; ghost usage pruned.
    useNPCStore.getState().updateNPC(CAMPAIGN, id, {
      monsterStatBlock: npc.monsterStatBlock,
    });
    const after = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    expect(after.monsterStatBlock!.actions[0].id).toBe(entryId);
    expect(after.abilityUsage).toEqual({ [entryId]: 1 });
  });

  it('updateNPC clamps usage when an entry maximum decreased', () => {
    const id = createAbilityNpc();
    useNPCStore
      .getState()
      .updateNPC(CAMPAIGN, id, { abilityUsage: { 'entry-smite': 3 } });
    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    const sb = structuredClone(npc.monsterStatBlock!);
    sb.actions[0].uses = 1; // Smite 3 → 1
    useNPCStore.getState().updateNPC(CAMPAIGN, id, { monsterStatBlock: sb });
    expect(
      useNPCStore.getState().getNPC(CAMPAIGN, id)!.abilityUsage!['entry-smite']
    ).toBe(1);
  });
});

describe('npcStore — useNpcAbility / restoreNpcAbility', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('increments abilityUsage and returns true; at max returns false without mutation', () => {
    const id = createAbilityNpc();
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-smite')
    ).toBe(true);
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-smite')
    ).toBe(true);
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-smite')
    ).toBe(true);
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-smite')
    ).toBe(false);
    expect(
      useNPCStore.getState().getNPC(CAMPAIGN, id)!.abilityUsage!['entry-smite']
    ).toBe(3);
  });

  it('combined cost is atomic: both counters move on success', () => {
    const id = createAbilityNpc();
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-elemental')
    ).toBe(true);
    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    expect(npc.abilityUsage!['entry-elemental']).toBe(1);
    expect(npc.resources![0].usesExpended).toBe(2);
  });

  it('combined cost with insufficient resource: NEITHER counter moves, returns false', () => {
    const id = createAbilityNpc();
    useNPCStore.getState().spendNpcResource(CAMPAIGN, id, 'res-ws', 3); // 1 remaining < cost 2
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-elemental')
    ).toBe(false);
    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    expect(npc.abilityUsage?.['entry-elemental'] ?? 0).toBe(0);
    expect(npc.resources![0].usesExpended).toBe(3);
  });

  it('combined cost with deleted resource: rejected, ability counter unchanged', () => {
    const id = createAbilityNpc();
    useNPCStore.getState().updateNPC(CAMPAIGN, id, { resources: [] });
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-elemental')
    ).toBe(false);
  });

  it('restore floors at 0 and never refunds the resource', () => {
    const id = createAbilityNpc();
    useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-elemental');
    useNPCStore.getState().restoreNpcAbility(CAMPAIGN, id, 'entry-elemental');
    useNPCStore.getState().restoreNpcAbility(CAMPAIGN, id, 'entry-elemental');
    const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    expect(npc.abilityUsage!['entry-elemental']).toBe(0);
    expect(npc.resources![0].usesExpended).toBe(2); // NOT refunded
  });

  it('unknown entry id and untrackable entries are no-ops returning false', () => {
    const id = createAbilityNpc();
    expect(useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'nope')).toBe(
      false
    );
    expect(
      useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-bite')
    ).toBe(false);
  });

  it('malformed cost amounts (zero/negative/fractional/non-finite) are atomic rejections', () => {
    for (const bad of [0, -2, 1.5, NaN, Infinity]) {
      useNPCStore.setState({ npcsByCampaign: {} });
      const id = createAbilityNpc();
      const npc0 = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
      const sb = structuredClone(npc0.monsterStatBlock!);
      sb.actions = sb.actions.map(a =>
        a.id === 'entry-elemental'
          ? { ...a, resourceCost: { resourceId: 'res-ws', amount: bad } }
          : a
      );
      useNPCStore.getState().updateNPC(CAMPAIGN, id, { monsterStatBlock: sb });
      expect(
        useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-elemental')
      ).toBe(false);
      const npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
      expect(npc.abilityUsage?.['entry-elemental'] ?? 0).toBe(0);
      expect(npc.resources![0].usesExpended).toBe(0);
    }
  });

  it('restoreNpcAbility is a no-op for orphaned usage keys (entry deleted or untrackable)', () => {
    const id = createAbilityNpc();
    useNPCStore.getState().useNpcAbility(CAMPAIGN, id, 'entry-smite');
    const npc0 = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    // Simulate a stale orphan key surviving alongside a block that lost the entry
    // (bypass updateNPC's prune by writing state directly).
    const sb = structuredClone(npc0.monsterStatBlock!);
    sb.actions = sb.actions.filter(a => a.id !== 'entry-smite');
    useNPCStore.setState(state => ({
      npcsByCampaign: {
        ...state.npcsByCampaign,
        [CAMPAIGN]: state.npcsByCampaign[CAMPAIGN].map(n =>
          n.id === id
            ? { ...n, monsterStatBlock: sb, abilityUsage: { 'entry-smite': 1 } }
            : n
        ),
      },
    }));
    useNPCStore.getState().restoreNpcAbility(CAMPAIGN, id, 'entry-smite');
    expect(
      useNPCStore.getState().getNPC(CAMPAIGN, id)!.abilityUsage!['entry-smite']
    ).toBe(1); // untouched — entry no longer exists
  });
});

describe('npcStore — rests reset ability usage', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('long rest clears all usage; short rest clears only short-rest entries', () => {
    const id = useNPCStore.getState().createNPC(CAMPAIGN, {
      name: 'N',
      armorClass: '10',
      maxHp: 5,
      speed: '30 ft.',
      monsterStatBlock: {
        ...statBlockFixture(),
        actions: [
          {
            id: 'entry-short',
            name: 'Chains (Recharges after a Short or Long Rest)',
            text: '',
          },
          { id: 'entry-day', name: 'Teleport (3/Day)', text: '' },
        ],
      },
      abilityUsage: { 'entry-short': 1, 'entry-day': 2 },
    });
    useNPCStore.getState().shortRestNPC(CAMPAIGN, id);
    let npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    expect(npc.abilityUsage!['entry-short'] ?? 0).toBe(0);
    expect(npc.abilityUsage!['entry-day']).toBe(2);
    useNPCStore.getState().longRestNPC(CAMPAIGN, id);
    npc = useNPCStore.getState().getNPC(CAMPAIGN, id)!;
    expect(Object.values(npc.abilityUsage ?? {}).every(v => v === 0)).toBe(
      true
    );
  });
});
