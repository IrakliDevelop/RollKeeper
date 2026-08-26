import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import {
  makeCharacter,
  makeWizard,
  makeWarlock,
} from '@/utils/__tests__/test-utils';
import type { ProcessedSpell } from '@/types/spells';
import type { Spell } from '@/types/character';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter({ ...makeWizard(), ...overrides }),
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
    settings: {
      enableDeathAnimation: false,
      enableLevelUpAnimation: false,
      enableCombatStartBanner: false,
    },
    lastSelectedCharacterId: null,
  });
}

const BASE_SPELL_SLOTS = {
  1: { max: 4, used: 2 },
  2: { max: 3, used: 1 },
  3: { max: 2, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

function makeTestSpell(
  overrides: Partial<ProcessedSpell> = {}
): ProcessedSpell {
  return {
    id: 'custom-fireball',
    name: 'Fireball',
    level: 3,
    school: 'E',
    schoolName: 'Evocation',
    source: 'PHB',
    isRitual: false,
    concentration: false,
    castingTime: '1 action',
    range: '150 feet',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialComponent: 'a tiny ball of bat guano',
    },
    duration: 'Instantaneous',
    description:
      'A bright streak flashes from your pointing finger to a point you choose.',
    classes: ['wizard', 'sorcerer'],
    tags: ['damage', 'fire'],
    isCantrip: false,
    isSrd: true,
    ...overrides,
  };
}

// ─── Spell Slots ──────────────────────────────────────────────────────────────

describe('characterStore — spell slots', () => {
  beforeEach(() => resetStore({ spellSlots: BASE_SPELL_SLOTS }));

  describe('updateSpellSlot', () => {
    it('sets used count for a given level', () => {
      useCharacterStore.getState().updateSpellSlot(1, 3);
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(3);
    });

    it('does not affect other slot levels', () => {
      useCharacterStore.getState().updateSpellSlot(1, 3);
      expect(useCharacterStore.getState().character.spellSlots[2].used).toBe(1);
      expect(useCharacterStore.getState().character.spellSlots[3].used).toBe(0);
    });

    it('clamps used to max (cannot exceed max)', () => {
      useCharacterStore.getState().updateSpellSlot(1, 10);
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(4);
    });

    it('clamps used to 0 (cannot go below 0)', () => {
      useCharacterStore.getState().updateSpellSlot(1, -5);
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(0);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().updateSpellSlot(1, 3);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
      expect(useCharacterStore.getState().saveStatus).toBe('saving');
    });

    it('works for higher slot levels', () => {
      useCharacterStore.getState().updateSpellSlot(2, 2);
      expect(useCharacterStore.getState().character.spellSlots[2].used).toBe(2);
    });

    it('setting used to 0 clears the slot', () => {
      useCharacterStore.getState().updateSpellSlot(1, 0);
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(0);
    });
  });

  describe('resetSpellSlots', () => {
    it('resets all used counts to 0', () => {
      useCharacterStore.getState().resetSpellSlots();
      const slots = useCharacterStore.getState().character.spellSlots;
      expect(slots[1].used).toBe(0);
      expect(slots[2].used).toBe(0);
      expect(slots[3].used).toBe(0);
    });

    it('preserves max values when resetting', () => {
      useCharacterStore.getState().resetSpellSlots();
      const slots = useCharacterStore.getState().character.spellSlots;
      expect(slots[1].max).toBe(4);
      expect(slots[2].max).toBe(3);
      expect(slots[3].max).toBe(2);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().resetSpellSlots();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});

// ─── Pact Magic ──────────────────────────────────────────────────────────────

describe('characterStore — pact magic slots', () => {
  beforeEach(() =>
    resetStore({
      ...makeWarlock(),
      pactMagic: { slots: { max: 2, used: 0 }, level: 3 },
    })
  );

  describe('updatePactMagicSlot', () => {
    it('sets used count for pact magic', () => {
      useCharacterStore.getState().updatePactMagicSlot(1);
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
        1
      );
    });

    it('clamps used to max', () => {
      useCharacterStore.getState().updatePactMagicSlot(10);
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
        2
      );
    });

    it('clamps used to 0', () => {
      useCharacterStore.getState().updatePactMagicSlot(-1);
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
        0
      );
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().updatePactMagicSlot(1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('does nothing when pactMagic is not set', () => {
      // Use a wizard (no pact magic)
      resetStore();
      const before = useCharacterStore.getState().hasUnsavedChanges;
      useCharacterStore.getState().updatePactMagicSlot(1);
      expect(useCharacterStore.getState().character.pactMagic).toBeUndefined();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(before);
    });
  });

  describe('resetPactMagicSlots', () => {
    it('resets pact magic used to 0', () => {
      useCharacterStore.getState().updatePactMagicSlot(2);
      useCharacterStore.getState().resetPactMagicSlots();
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
        0
      );
    });

    it('preserves pact magic max and level', () => {
      useCharacterStore.getState().resetPactMagicSlots();
      expect(useCharacterStore.getState().character.pactMagic?.slots.max).toBe(
        2
      );
      expect(useCharacterStore.getState().character.pactMagic?.level).toBe(3);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().resetPactMagicSlots();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('does nothing when pactMagic is not set', () => {
      resetStore();
      useCharacterStore.getState().resetPactMagicSlots();
      expect(useCharacterStore.getState().character.pactMagic).toBeUndefined();
    });
  });
});

// ─── Concentration ────────────────────────────────────────────────────────────

describe('characterStore — concentration', () => {
  beforeEach(() => resetStore());

  describe('startConcentration', () => {
    it('sets isConcentrating to true', () => {
      useCharacterStore
        .getState()
        .startConcentration('Hold Person', 'hold-person');
      expect(
        useCharacterStore.getState().character.concentration.isConcentrating
      ).toBe(true);
    });

    it('stores spell name and ID', () => {
      useCharacterStore
        .getState()
        .startConcentration('Hold Person', 'hold-person');
      const conc = useCharacterStore.getState().character.concentration;
      expect(conc.spellName).toBe('Hold Person');
      expect(conc.spellId).toBe('hold-person');
    });

    it('stores optional castAt level', () => {
      useCharacterStore
        .getState()
        .startConcentration('Hold Monster', 'hold-monster', 5);
      expect(useCharacterStore.getState().character.concentration.castAt).toBe(
        5
      );
    });

    it('sets startedAt timestamp', () => {
      const before = new Date().toISOString();
      useCharacterStore.getState().startConcentration('Fog Cloud', 'fog-cloud');
      const startedAt =
        useCharacterStore.getState().character.concentration.startedAt;
      expect(startedAt).toBeDefined();
      expect(startedAt! >= before).toBe(true);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().startConcentration('Fog Cloud', 'fog-cloud');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('replaces existing concentration with new spell', () => {
      useCharacterStore.getState().startConcentration('Spell A', 'spell-a');
      useCharacterStore.getState().startConcentration('Spell B', 'spell-b');
      expect(
        useCharacterStore.getState().character.concentration.spellName
      ).toBe('Spell B');
    });
  });

  describe('stopConcentration', () => {
    beforeEach(() => {
      useCharacterStore
        .getState()
        .startConcentration('Hold Person', 'hold-person', 2);
    });

    it('sets isConcentrating to false', () => {
      useCharacterStore.getState().stopConcentration();
      expect(
        useCharacterStore.getState().character.concentration.isConcentrating
      ).toBe(false);
    });

    it('clears spellName and spellId', () => {
      useCharacterStore.getState().stopConcentration();
      const conc = useCharacterStore.getState().character.concentration;
      expect(conc.spellName).toBeUndefined();
      expect(conc.spellId).toBeUndefined();
    });

    it('clears castAt and startedAt', () => {
      useCharacterStore.getState().stopConcentration();
      const conc = useCharacterStore.getState().character.concentration;
      expect(conc.castAt).toBeUndefined();
      expect(conc.startedAt).toBeUndefined();
    });

    it('marks unsaved changes', () => {
      useCharacterStore.setState({ hasUnsavedChanges: false });
      useCharacterStore.getState().stopConcentration();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('removes concentration-required summons', () => {
      // Seed a concentration summon
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          summons: [
            {
              id: 's1',
              type: 'familiar' as const,
              name: 'Familiar',
              requiresConcentration: false,
              sourceSpellName: 'Find Familiar',
              createdAt: '',
              entity: {
                id: 's1',
                type: 'monster' as const,
                name: 'Familiar',
                initiative: 0,
                initiativeModifier: 0,
                currentHp: 10,
                maxHp: 10,
                tempHp: 0,
                armorClass: 12,
                conditions: [],
              },
            },
            {
              id: 's2',
              type: 'summon' as const,
              name: 'Spirit',
              requiresConcentration: true,
              sourceSpellName: 'Conjure Animals',
              createdAt: '',
              entity: {
                id: 's2',
                type: 'monster' as const,
                name: 'Spirit',
                initiative: 0,
                initiativeModifier: 0,
                currentHp: 8,
                maxHp: 8,
                tempHp: 0,
                armorClass: 11,
                conditions: [],
              },
            },
          ],
        },
      }));
      useCharacterStore.getState().stopConcentration();
      const summons = useCharacterStore.getState().character.summons;
      expect(summons?.some(s => s.id === 's2')).toBe(false);
      expect(summons?.some(s => s.id === 's1')).toBe(true);
    });
  });
});

// ─── Spellbook ────────────────────────────────────────────────────────────────

describe('characterStore — spellbook management', () => {
  beforeEach(() =>
    resetStore({
      spellbook: {
        knownSpells: ['magic-missile', 'mage-armor'],
        preparedSpells: ['magic-missile'],
        favoriteSpells: [],
        customSpells: [],
        spellbookSettings: {
          showOnlyClassSpells: true,
          showOnlyKnownSpells: false,
          preferredSources: ['PHB'],
          spellbookName: 'My Spellbook',
          theme: 'classic' as const,
        },
      },
    })
  );

  describe('addSpellToSpellbook', () => {
    it('adds a new spell ID to known spells', () => {
      useCharacterStore.getState().addSpellToSpellbook('fireball');
      expect(
        useCharacterStore.getState().character.spellbook.knownSpells
      ).toContain('fireball');
    });

    it('does not duplicate an already-known spell', () => {
      useCharacterStore.getState().addSpellToSpellbook('magic-missile');
      const known =
        useCharacterStore.getState().character.spellbook.knownSpells;
      expect(known.filter(id => id === 'magic-missile').length).toBe(1);
    });

    it('preserves existing known spells', () => {
      useCharacterStore.getState().addSpellToSpellbook('fireball');
      expect(
        useCharacterStore.getState().character.spellbook.knownSpells
      ).toContain('magic-missile');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().addSpellToSpellbook('fireball');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('removeSpellFromSpellbook', () => {
    it('removes the spell from known spells', () => {
      useCharacterStore.getState().removeSpellFromSpellbook('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.knownSpells
      ).not.toContain('magic-missile');
    });

    it('also removes the spell from prepared spells', () => {
      useCharacterStore.getState().removeSpellFromSpellbook('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.preparedSpells
      ).not.toContain('magic-missile');
    });

    it('also removes the spell from favorite spells', () => {
      useCharacterStore.getState().toggleSpellFavorite('magic-missile');
      useCharacterStore.getState().removeSpellFromSpellbook('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.favoriteSpells
      ).not.toContain('magic-missile');
    });

    it('preserves other spells', () => {
      useCharacterStore.getState().removeSpellFromSpellbook('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.knownSpells
      ).toContain('mage-armor');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().removeSpellFromSpellbook('magic-missile');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('toggleSpellFavorite', () => {
    it('adds spell to favorites when not yet favorited', () => {
      useCharacterStore.getState().toggleSpellFavorite('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.favoriteSpells
      ).toContain('magic-missile');
    });

    it('removes spell from favorites when already favorited', () => {
      useCharacterStore.getState().toggleSpellFavorite('magic-missile');
      useCharacterStore.getState().toggleSpellFavorite('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.favoriteSpells
      ).not.toContain('magic-missile');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().toggleSpellFavorite('magic-missile');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('prepareSpell', () => {
    it('adds spell to prepared list', () => {
      useCharacterStore.getState().prepareSpell('mage-armor');
      expect(
        useCharacterStore.getState().character.spellbook.preparedSpells
      ).toContain('mage-armor');
    });

    it('does not duplicate an already-prepared spell', () => {
      useCharacterStore.getState().prepareSpell('magic-missile');
      const prepared =
        useCharacterStore.getState().character.spellbook.preparedSpells;
      expect(prepared.filter(id => id === 'magic-missile').length).toBe(1);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().prepareSpell('mage-armor');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('unprepareSpell', () => {
    it('removes spell from prepared list', () => {
      useCharacterStore.getState().unprepareSpell('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.preparedSpells
      ).not.toContain('magic-missile');
    });

    it('preserves other prepared spells', () => {
      useCharacterStore.getState().prepareSpell('mage-armor');
      useCharacterStore.getState().unprepareSpell('magic-missile');
      expect(
        useCharacterStore.getState().character.spellbook.preparedSpells
      ).toContain('mage-armor');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().unprepareSpell('magic-missile');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('addCustomSpell', () => {
    it('adds a custom spell to the spellbook', () => {
      const spell = makeTestSpell();
      useCharacterStore.getState().addCustomSpell(spell);
      expect(
        useCharacterStore.getState().character.spellbook.customSpells
      ).toHaveLength(1);
      expect(
        useCharacterStore.getState().character.spellbook.customSpells[0].id
      ).toBe('custom-fireball');
    });

    it('accumulates multiple custom spells', () => {
      useCharacterStore
        .getState()
        .addCustomSpell(makeTestSpell({ id: 'spell-a', name: 'Spell A' }));
      useCharacterStore
        .getState()
        .addCustomSpell(makeTestSpell({ id: 'spell-b', name: 'Spell B' }));
      expect(
        useCharacterStore.getState().character.spellbook.customSpells
      ).toHaveLength(2);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().addCustomSpell(makeTestSpell());
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('reorderSpells', () => {
    beforeEach(() => {
      // Seed the character.spells array
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          spells: [
            { id: 'sp1', name: 'Spell 1', level: 1 },
            { id: 'sp2', name: 'Spell 2', level: 2 },
            { id: 'sp3', name: 'Spell 3', level: 3 },
          ] as Spell[],
        },
      }));
    });

    it('moves a spell from source to destination index', () => {
      useCharacterStore.getState().reorderSpells(0, 2);
      const spells = useCharacterStore.getState().character.spells;
      expect(spells[0].id).toBe('sp2');
      expect(spells[1].id).toBe('sp3');
      expect(spells[2].id).toBe('sp1');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().reorderSpells(0, 1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('reorderPreparedSpells', () => {
    beforeEach(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          spellbook: {
            ...state.character.spellbook,
            preparedSpells: ['sp-a', 'sp-b', 'sp-c'],
          },
        },
      }));
    });

    it('reorders prepared spells', () => {
      useCharacterStore.getState().reorderPreparedSpells(0, 2);
      const prepared =
        useCharacterStore.getState().character.spellbook.preparedSpells;
      expect(prepared[0]).toBe('sp-b');
      expect(prepared[1]).toBe('sp-c');
      expect(prepared[2]).toBe('sp-a');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().reorderPreparedSpells(0, 1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateSpellbookSettings', () => {
    it('updates showOnlyClassSpells setting', () => {
      useCharacterStore
        .getState()
        .updateSpellbookSettings({ showOnlyClassSpells: false });
      expect(
        useCharacterStore.getState().character.spellbook.spellbookSettings
          .showOnlyClassSpells
      ).toBe(false);
    });

    it('updates showOnlyKnownSpells setting', () => {
      useCharacterStore
        .getState()
        .updateSpellbookSettings({ showOnlyKnownSpells: true });
      expect(
        useCharacterStore.getState().character.spellbook.spellbookSettings
          .showOnlyKnownSpells
      ).toBe(true);
    });

    it('updates spellbookName setting', () => {
      useCharacterStore
        .getState()
        .updateSpellbookSettings({ spellbookName: 'Tome of Secrets' });
      expect(
        useCharacterStore.getState().character.spellbook.spellbookSettings
          .spellbookName
      ).toBe('Tome of Secrets');
    });

    it('merges settings — preserves unrelated settings', () => {
      useCharacterStore
        .getState()
        .updateSpellbookSettings({ showOnlyKnownSpells: true });
      expect(
        useCharacterStore.getState().character.spellbook.spellbookSettings
          .showOnlyClassSpells
      ).toBe(true);
    });

    it('marks unsaved changes', () => {
      useCharacterStore
        .getState()
        .updateSpellbookSettings({ showOnlyKnownSpells: true });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});
