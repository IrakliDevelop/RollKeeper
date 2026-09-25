import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import type {
  ArmorItem,
  CharacterState,
  MagicItem,
  Weapon,
} from '@/types/character';

import { buildPartyPublicSheet } from '../partyPublicSheet';

function fixture(overrides: Partial<CharacterState> = {}): CharacterState {
  const base = useCharacterStore.getState().character;
  return {
    ...base,
    name: 'Kaelen Voss',
    race: 'Half-Elf',
    background: 'Outlander',
    level: 5,
    totalLevel: 5,
    classes: [{ className: 'Ranger', level: 5, isCustom: false, hitDie: 10 }],
    abilities: {
      strength: 12,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 16,
      charisma: 8,
    },
    skills: {
      ...base.skills,
      perception: { proficient: true, expertise: false },
    },
    speed: 30,
    hitPoints: { current: 30, max: 100, temporary: 0, calculationMode: 'auto' },
    ...overrides,
  } as CharacterState;
}

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'w1',
    name: 'Longsword',
    category: 'martial',
    weaponType: ['melee'],
    damage: [{ dice: '1d8', type: 'slashing' }],
    enhancementBonus: 0,
    properties: [],
    isEquipped: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Weapon;
}

function armorItem(overrides: Partial<ArmorItem> = {}): ArmorItem {
  return {
    id: 'a1',
    name: 'Breastplate',
    category: 'medium',
    type: 'breastplate',
    baseAC: 14,
    stealthDisadvantage: false,
    enhancementBonus: 0,
    isEquipped: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as ArmorItem;
}

function magicItem(overrides: Partial<MagicItem> = {}): MagicItem {
  return {
    id: 'm1',
    name: 'Ring of Protection',
    category: 'ring',
    rarity: 'rare',
    description: '',
    properties: [],
    requiresAttunement: true,
    isAttuned: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as MagicItem;
}

describe('buildPartyPublicSheet', () => {
  it('computes subtitle, hp state, speed, passive perception, conditions, concentration and gear', () => {
    const sheet = buildPartyPublicSheet(
      fixture({
        conditionsAndDiseases: {
          activeConditions: [
            {
              id: 'c1',
              name: 'Prone',
              source: 'XPHB',
              description: 'You are lying on the ground.',
              stackable: false,
              count: 1,
              appliedAt: '',
            },
            {
              id: 'c2',
              name: 'Exhaustion',
              source: 'XPHB',
              description: 'You are exhausted.',
              stackable: true,
              count: 2,
              appliedAt: '',
              notes: 'Secret DM note',
            },
          ],
          activeDiseases: [],
          exhaustionVariant: '2014',
        },
        concentration: { isConcentrating: true, spellName: "Hunter's Mark" },
        temporaryBuffs: [
          {
            id: 'buff-haste',
            name: 'Haste',
            effects: [
              { id: 'eff-1', targetStat: 'speed', mode: 'add', value: 10 },
            ],
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        weapons: [
          weapon({ id: 'w1', name: 'Secret Sword', isEquipped: true }),
          weapon({ id: 'w2', name: 'Hidden Dagger', isEquipped: false }),
        ],
        armorItems: [
          armorItem({ id: 'a1', name: 'Secret Armor', isEquipped: true }),
        ],
        magicItems: [
          magicItem({
            id: 'm1',
            name: 'Attuned Ring',
            isEquipped: false,
            isAttuned: true,
          }),
          magicItem({
            id: 'm2',
            name: 'Non-attuned Wand',
            isEquipped: false,
            isAttuned: false,
          }),
        ],
      })
    );

    expect(sheet).not.toBeNull();
    expect(sheet!.subtitle).toBe('Half-Elf · Ranger 5 · Outlander');
    expect(sheet!.hpState).toBe('Bloodied');
    expect(sheet!.speed).toBe(40);
    expect(sheet!.passivePerception).toBe(16);
    expect(sheet!.conditions).toEqual(['Prone', 'Exhaustion 2']);
    expect(sheet!.concentration).toBe("Hunter's Mark");
    expect(sheet!.equippedGear).toEqual([
      'Attuned Ring',
      'Secret Armor',
      'Secret Sword',
    ]);
  });

  it('dedupes and sorts equipped gear names across sources', () => {
    const sheet = buildPartyPublicSheet(
      fixture({
        weapons: [weapon({ id: 'w1', name: 'Zweihander', isEquipped: true })],
        armorItems: [
          armorItem({ id: 'a1', name: 'Amulet of Health', isEquipped: true }),
        ],
        magicItems: [
          magicItem({
            id: 'm1',
            name: 'Zweihander',
            isEquipped: true,
            isAttuned: false,
          }),
        ],
      })
    );

    expect(sheet!.equippedGear).toEqual(['Amulet of Health', 'Zweihander']);
  });

  it('returns null when sharePartyView is false', () => {
    const sheet = buildPartyPublicSheet(fixture({ sharePartyView: false }));
    expect(sheet).toBeNull();
  });

  it('returns a sheet even when shareHpWithParty is false (hp state is not exact hp)', () => {
    const sheet = buildPartyPublicSheet(fixture({ shareHpWithParty: false }));
    expect(sheet).not.toBeNull();
    expect(sheet!.hpState).toBe('Bloodied');
  });

  it('tolerates missing arrays from persisted old characters', () => {
    const sheet = buildPartyPublicSheet(
      fixture({
        weapons: undefined,
        armorItems: undefined,
        magicItems: undefined,
        conditionsAndDiseases: undefined,
      } as Partial<CharacterState>)
    );

    expect(sheet).not.toBeNull();
    expect(sheet!.equippedGear).toEqual([]);
    expect(sheet!.conditions).toEqual([]);
  });
});
