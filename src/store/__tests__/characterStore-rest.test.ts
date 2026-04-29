import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { Weapon } from '@/types/character';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStoreWithUsedResources() {
  useCharacterStore.setState({
    character: makeCharacter({
      trackableTraits: [
        {
          id: 't1',
          name: 'Action Surge',
          maxUses: 1,
          usedUses: 1,
          restType: 'short',
          scaleWithProficiency: false,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 't2',
          name: 'Second Wind',
          maxUses: 1,
          usedUses: 1,
          restType: 'long',
          scaleWithProficiency: false,
          createdAt: '',
          updatedAt: '',
        },
      ],
      extendedFeatures: [
        {
          id: 'ef1',
          name: 'Channel Divinity',
          description: '',
          sourceType: 'class',
          maxUses: 1,
          usedUses: 1,
          restType: 'short',
          isPassive: false,
          displayOrder: 0,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'ef2',
          name: 'Wild Shape',
          description: '',
          sourceType: 'class',
          maxUses: 2,
          usedUses: 2,
          restType: 'long',
          isPassive: false,
          displayOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      weapons: [
        {
          id: 'w1',
          name: 'Rod',
          category: 'simple',
          weaponType: ['melee'],
          damage: [],
          enhancementBonus: 0,
          isEquipped: true,
          properties: [],
          createdAt: '',
          updatedAt: '',
          charges: [
            {
              id: 'c1',
              name: 'Charge',
              maxCharges: 3,
              usedCharges: 2,
              restType: 'short',
            },
          ],
        } as Weapon,
      ],
      pactMagic: { slots: { max: 2, used: 2 }, level: 3 },
      reaction: { hasUsedReaction: true },
      spellSlots: {
        1: { max: 4, used: 3 },
        2: { max: 3, used: 2 },
        3: { max: 2, used: 1 },
        4: { max: 0, used: 0 },
        5: { max: 0, used: 0 },
        6: { max: 0, used: 0 },
        7: { max: 0, used: 0 },
        8: { max: 0, used: 0 },
        9: { max: 0, used: 0 },
      },
      hitPoints: {
        current: 20,
        max: 44,
        temporary: 5,
        calculationMode: 'auto' as const,
      },
      hitDicePools: { d10: { max: 5, used: 3 } },
    }),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

describe('characterStore — rests', () => {
  beforeEach(resetStoreWithUsedResources);

  describe('takeShortRest', () => {
    it('resets short rest trackable traits only', () => {
      useCharacterStore.getState().takeShortRest();
      const { character } = useCharacterStore.getState();
      expect(character.trackableTraits[0].usedUses).toBe(0);
      expect(character.trackableTraits[1].usedUses).toBe(1);
    });

    it('resets short rest extended features only', () => {
      useCharacterStore.getState().takeShortRest();
      const { character } = useCharacterStore.getState();
      expect(character.extendedFeatures[0].usedUses).toBe(0);
      expect(character.extendedFeatures[1].usedUses).toBe(2);
    });

    it('resets pact magic slots', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
        0
      );
    });

    it('resets reaction', () => {
      useCharacterStore.getState().takeShortRest();
      expect(
        useCharacterStore.getState().character.reaction.hasUsedReaction
      ).toBe(false);
    });

    it('resets short rest weapon charges only', () => {
      useCharacterStore.getState().takeShortRest();
      expect(
        useCharacterStore.getState().character.weapons[0].charges![0]
          .usedCharges
      ).toBe(0);
    });

    it('does NOT reset spell slots', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(3);
    });

    it('does NOT reset hit points', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(20);
    });
  });

  describe('takeLongRest', () => {
    it('resets ALL trackable traits', () => {
      useCharacterStore.getState().takeLongRest();
      const { character } = useCharacterStore.getState();
      expect(character.trackableTraits[0].usedUses).toBe(0);
      expect(character.trackableTraits[1].usedUses).toBe(0);
    });

    it('resets ALL extended features', () => {
      useCharacterStore.getState().takeLongRest();
      const { character } = useCharacterStore.getState();
      expect(character.extendedFeatures[0].usedUses).toBe(0);
      expect(character.extendedFeatures[1].usedUses).toBe(0);
    });

    it('resets ALL spell slots', () => {
      useCharacterStore.getState().takeLongRest();
      const { character } = useCharacterStore.getState();
      expect(character.spellSlots[1].used).toBe(0);
      expect(character.spellSlots[2].used).toBe(0);
      expect(character.spellSlots[3].used).toBe(0);
    });

    it('resets pact magic', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
        0
      );
    });

    it('resets hit dice', () => {
      useCharacterStore.getState().takeLongRest();
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10?.used
      ).toBe(0);
    });

    it('heals to max HP', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
    });

    it('clears temporary HP', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.hitPoints.temporary).toBe(
        0
      );
    });

    it('resets reaction', () => {
      useCharacterStore.getState().takeLongRest();
      expect(
        useCharacterStore.getState().character.reaction.hasUsedReaction
      ).toBe(false);
    });

    it('clears death saves', () => {
      useCharacterStore.getState().takeLongRest();
      expect(
        useCharacterStore.getState().character.hitPoints.deathSaves
      ).toBeUndefined();
    });
  });
});
