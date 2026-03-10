import { describe, it, expect, beforeEach } from 'vitest';
import { useNPCStore } from '@/store/npcStore';

describe('npcStore', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcs: [] });
  });

  describe('createNPC', () => {
    it('returns an id and adds the NPC', () => {
      const id = useNPCStore.getState().createNPC({
        name: 'Bartender Bob',
        armorClass: 10,
        maxHp: 8,
        speed: '30 ft.',
      });

      expect(id).toMatch(/^npc-/);
      const { npcs } = useNPCStore.getState();
      expect(npcs).toHaveLength(1);
      expect(npcs[0].name).toBe('Bartender Bob');
      expect(npcs[0].id).toBe(id);
    });

    it('sets createdAt and updatedAt timestamps', () => {
      useNPCStore.getState().createNPC({
        name: 'Guard',
        armorClass: 16,
        maxHp: 11,
        speed: '30 ft.',
      });

      const npc = useNPCStore.getState().npcs[0];
      expect(npc.createdAt).toBeTruthy();
      expect(npc.updatedAt).toBeTruthy();
      expect(npc.createdAt).toBe(npc.updatedAt);
    });

    it('adds multiple NPCs', () => {
      useNPCStore.getState().createNPC({
        name: 'NPC 1',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC({
        name: 'NPC 2',
        armorClass: 12,
        maxHp: 10,
        speed: '25 ft.',
      });

      expect(useNPCStore.getState().npcs).toHaveLength(2);
    });
  });

  describe('updateNPC', () => {
    it('merges updates and preserves unchanged fields', () => {
      const id = useNPCStore.getState().createNPC({
        name: 'Old Name',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore
        .getState()
        .updateNPC(id, { name: 'New Name', armorClass: 14 });

      const npc = useNPCStore.getState().npcs[0];
      expect(npc.name).toBe('New Name');
      expect(npc.armorClass).toBe(14);
      expect(npc.maxHp).toBe(5); // unchanged
      expect(npc.updatedAt).toBeTruthy();
    });

    it('does not affect other NPCs', () => {
      const id1 = useNPCStore.getState().createNPC({
        name: 'First',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC({
        name: 'Second',
        armorClass: 12,
        maxHp: 10,
        speed: '30 ft.',
      });

      useNPCStore.getState().updateNPC(id1, { name: 'Updated First' });

      const npcs = useNPCStore.getState().npcs;
      expect(npcs[0].name).toBe('Updated First');
      expect(npcs[1].name).toBe('Second');
    });
  });

  describe('deleteNPC', () => {
    it('removes the NPC by id', () => {
      const id = useNPCStore.getState().createNPC({
        name: 'Doomed NPC',
        armorClass: 10,
        maxHp: 1,
        speed: '30 ft.',
      });

      useNPCStore.getState().deleteNPC(id);
      expect(useNPCStore.getState().npcs).toHaveLength(0);
    });

    it('is a no-op for unknown id', () => {
      useNPCStore.getState().createNPC({
        name: 'Safe NPC',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore.getState().deleteNPC('nonexistent');
      expect(useNPCStore.getState().npcs).toHaveLength(1);
    });
  });

  describe('getNPC', () => {
    it('returns matching NPC', () => {
      const id = useNPCStore.getState().createNPC({
        name: 'Findable',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      const found = useNPCStore.getState().getNPC(id);
      expect(found?.name).toBe('Findable');
    });

    it('returns undefined for unknown id', () => {
      const found = useNPCStore.getState().getNPC('nonexistent');
      expect(found).toBeUndefined();
    });
  });
});
