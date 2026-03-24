import { describe, it, expect, beforeEach } from 'vitest';
import { useNPCStore } from '@/store/npcStore';

const CAMPAIGN = 'test-campaign';

describe('npcStore (campaign-scoped)', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  describe('createNPC', () => {
    it('returns an id and adds the NPC to the campaign bucket', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Bartender Bob',
        armorClass: 10,
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
        armorClass: 16,
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
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC('campaign-b', {
        name: 'NPC B',
        armorClass: 12,
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
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore
        .getState()
        .updateNPC(CAMPAIGN, id, { name: 'New Name', armorClass: 14 });

      const npc = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)[0];
      expect(npc.name).toBe('New Name');
      expect(npc.armorClass).toBe(14);
      expect(npc.maxHp).toBe(5);
    });

    it('does not affect other NPCs', () => {
      const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'First',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Second',
        armorClass: 12,
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
        armorClass: 10,
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
        armorClass: 10,
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
        armorClass: 10,
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
        armorClass: 10,
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
