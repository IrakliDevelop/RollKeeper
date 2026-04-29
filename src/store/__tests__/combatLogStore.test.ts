import { describe, it, expect, beforeEach } from 'vitest';
import { useCombatLogStore } from '@/store/combatLogStore';
import type {
  CombatLogFilters,
  DamageEvent,
  HealingEvent,
  TurnEvent,
  SpellCastEvent,
  AbilityUseEvent,
  RoundEvent,
  CombatStatusEvent,
  DeathEvent,
  ConditionEvent,
} from '@/types/combatLog';

// ── Helpers ────────────────────────────────────────────────────────────────

const ENC_A = 'enc-alpha';
const ENC_B = 'enc-beta';

function resetStore() {
  useCombatLogStore.setState({
    encounters: {},
    activeEncounterId: null,
  });
}

/** Minimal damage event payload (no id/timestamp) */
function makeDamagePayload(
  overrides: Partial<Omit<DamageEvent, 'id' | 'timestamp'>> = {}
): Omit<DamageEvent, 'id' | 'timestamp'> {
  return {
    type: 'damage',
    encounterId: ENC_A,
    round: 1,
    turn: 1,
    sourceId: 'src-1',
    sourceName: 'Goblin',
    targetId: 'tgt-1',
    targetName: 'Hero',
    amount: 5,
    damageType: 'slashing',
    ...overrides,
  };
}

function makeHealingPayload(
  overrides: Partial<Omit<HealingEvent, 'id' | 'timestamp'>> = {}
): Omit<HealingEvent, 'id' | 'timestamp'> {
  return {
    type: 'healing',
    encounterId: ENC_A,
    round: 1,
    turn: 2,
    sourceId: 'src-2',
    sourceName: 'Cleric',
    targetId: 'tgt-1',
    targetName: 'Hero',
    amount: 8,
    actualHealing: 8,
    ...overrides,
  };
}

function makeTurnPayload(
  entityId: string,
  round = 1
): Omit<TurnEvent, 'id' | 'timestamp'> {
  return {
    type: 'turn_start',
    encounterId: ENC_A,
    round,
    turn: 1,
    entityId,
    entityName: `Entity-${entityId}`,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('combatLogStore', () => {
  beforeEach(resetStore);

  // ── startEncounterLog ────────────────────────────────────────────────────

  describe('startEncounterLog', () => {
    it('creates an encounter entry', () => {
      useCombatLogStore.getState().startEncounterLog(ENC_A);
      const state = useCombatLogStore.getState();
      expect(state.encounters[ENC_A]).toBeDefined();
      expect(state.encounters[ENC_A].events).toEqual([]);
      expect(state.encounters[ENC_A].startedAt).toBeTruthy();
      expect(state.encounters[ENC_A].endedAt).toBeUndefined();
    });

    it('sets activeEncounterId', () => {
      useCombatLogStore.getState().startEncounterLog(ENC_A);
      expect(useCombatLogStore.getState().activeEncounterId).toBe(ENC_A);
    });

    it('overwrites an existing encounter with the same id', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload());
      store.startEncounterLog(ENC_A); // restart
      expect(
        useCombatLogStore.getState().encounters[ENC_A].events
      ).toHaveLength(0);
    });

    it('prunes old encounters when more than 10 exist', () => {
      const store = useCombatLogStore.getState();
      // Pre-populate 10 encounters with older timestamps
      const oldEncounters: Record<string, { events: []; startedAt: string }> =
        {};
      for (let i = 0; i < 10; i++) {
        oldEncounters[`old-enc-${i}`] = {
          events: [],
          startedAt: new Date(Date.now() - (11 - i) * 10000).toISOString(),
        };
      }
      useCombatLogStore.setState({ encounters: oldEncounters });
      store.startEncounterLog('new-enc-11');
      const remaining = Object.keys(useCombatLogStore.getState().encounters);
      expect(remaining).toHaveLength(10);
      expect(remaining).toContain('new-enc-11');
    });
  });

  // ── endEncounterLog ──────────────────────────────────────────────────────

  describe('endEncounterLog', () => {
    it('sets endedAt on an existing encounter', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.endEncounterLog(ENC_A);
      const enc = useCombatLogStore.getState().encounters[ENC_A];
      expect(enc.endedAt).toBeTruthy();
    });

    it('is a no-op for a non-existent encounter', () => {
      useCombatLogStore.getState().endEncounterLog('ghost-enc');
      expect(
        useCombatLogStore.getState().encounters['ghost-enc']
      ).toBeUndefined();
    });

    it('preserves existing events when ending', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload());
      store.endEncounterLog(ENC_A);
      expect(
        useCombatLogStore.getState().encounters[ENC_A].events
      ).toHaveLength(1);
    });
  });

  // ── setActiveEncounterLog ────────────────────────────────────────────────

  describe('setActiveEncounterLog', () => {
    it('updates activeEncounterId', () => {
      useCombatLogStore.getState().setActiveEncounterLog(ENC_B);
      expect(useCombatLogStore.getState().activeEncounterId).toBe(ENC_B);
    });

    it('accepts null to clear active', () => {
      useCombatLogStore.getState().startEncounterLog(ENC_A);
      useCombatLogStore.getState().setActiveEncounterLog(null);
      expect(useCombatLogStore.getState().activeEncounterId).toBeNull();
    });
  });

  // ── logEvent ─────────────────────────────────────────────────────────────

  describe('logEvent', () => {
    it('appends event with generated id and timestamp', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload());
      const events = useCombatLogStore.getState().encounters[ENC_A].events;
      expect(events).toHaveLength(1);
      expect(events[0].id).toMatch(/^log-/);
      expect(events[0].timestamp).toBeTruthy();
    });

    it('appends multiple events in order', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload({ round: 1 }));
      store.logEvent(makeDamagePayload({ round: 2 }));
      const events = useCombatLogStore.getState().encounters[ENC_A].events;
      expect(events).toHaveLength(2);
      expect(events[0].round).toBe(1);
      expect(events[1].round).toBe(2);
    });

    it('creates encounter entry on-the-fly if not started first', () => {
      // logEvent lazily creates the encounter when it doesn't exist
      useCombatLogStore
        .getState()
        .logEvent(makeDamagePayload({ encounterId: ENC_B }));
      const enc = useCombatLogStore.getState().encounters[ENC_B];
      expect(enc).toBeDefined();
      expect(enc.events).toHaveLength(1);
    });

    it('assigns unique ids to consecutive events', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload());
      store.logEvent(makeDamagePayload());
      const events = useCombatLogStore.getState().encounters[ENC_A].events;
      expect(events[0].id).not.toBe(events[1].id);
    });
  });

  // ── getEvents ─────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns all events for an encounter', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload());
      store.logEvent(makeHealingPayload());
      expect(store.getEvents(ENC_A)).toHaveLength(2);
    });

    it('returns empty array for unknown encounter', () => {
      expect(useCombatLogStore.getState().getEvents('no-such-enc')).toEqual([]);
    });
  });

  // ── getFilteredEvents ─────────────────────────────────────────────────────

  describe('getFilteredEvents', () => {
    beforeEach(() => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(
        makeDamagePayload({ round: 1, sourceId: 'src-1', targetId: 'tgt-1' })
      );
      store.logEvent(
        makeHealingPayload({ round: 2, sourceId: 'src-2', targetId: 'tgt-1' })
      );
      store.logEvent(
        makeDamagePayload({
          round: 3,
          sourceId: 'src-3',
          targetId: 'tgt-2',
          damageType: 'fire',
        })
      );
    });

    it('returns all events when filters are empty', () => {
      const result = useCombatLogStore.getState().getFilteredEvents(ENC_A, {});
      expect(result).toHaveLength(3);
    });

    it('filters by type', () => {
      const filters: CombatLogFilters = { types: ['damage'] };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(2);
      result.forEach(e => expect(e.type).toBe('damage'));
    });

    it('filters by multiple types', () => {
      const filters: CombatLogFilters = { types: ['damage', 'healing'] };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(3);
    });

    it('filters by entityId matching sourceId', () => {
      const filters: CombatLogFilters = { entityId: 'src-2' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('healing');
    });

    it('filters by entityId matching targetId', () => {
      const filters: CombatLogFilters = { entityId: 'tgt-2' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect((result[0] as DamageEvent).damageType).toBe('fire');
    });

    it('filters by entityId matching entityId field on TurnEvent', () => {
      const store = useCombatLogStore.getState();
      store.logEvent(makeTurnPayload('hero-id'));
      const filters: CombatLogFilters = { entityId: 'hero-id' };
      const result = store.getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('turn_start');
    });

    it('filters by entityId matching casterId on SpellCastEvent', () => {
      const store = useCombatLogStore.getState();
      const spellPayload: Omit<SpellCastEvent, 'id' | 'timestamp'> = {
        type: 'spell_cast',
        encounterId: ENC_A,
        round: 4,
        turn: 1,
        casterId: 'wizard-1',
        casterName: 'Gandalf',
        spellName: 'Fireball',
        spellLevel: 3,
      };
      store.logEvent(spellPayload);
      const filters: CombatLogFilters = { entityId: 'wizard-1' };
      const result = store.getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('spell_cast');
    });

    it('filters by entityId matching userId on AbilityUseEvent', () => {
      const store = useCombatLogStore.getState();
      const abilityPayload: Omit<AbilityUseEvent, 'id' | 'timestamp'> = {
        type: 'ability_use',
        encounterId: ENC_A,
        round: 4,
        turn: 2,
        userId: 'dragon-1',
        userName: 'Ancient Dragon',
        abilityName: 'Breath Weapon',
        abilityType: 'recharge',
      };
      store.logEvent(abilityPayload);
      const filters: CombatLogFilters = { entityId: 'dragon-1' };
      const result = store.getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ability_use');
    });

    it('filters by roundRange min', () => {
      const filters: CombatLogFilters = { roundRange: { min: 2 } };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(2);
      result.forEach(e => expect(e.round).toBeGreaterThanOrEqual(2));
    });

    it('filters by roundRange max', () => {
      const filters: CombatLogFilters = { roundRange: { max: 2 } };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(2);
      result.forEach(e => expect(e.round).toBeLessThanOrEqual(2));
    });

    it('filters by roundRange min and max', () => {
      const filters: CombatLogFilters = { roundRange: { min: 2, max: 2 } };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect(result[0].round).toBe(2);
    });

    it('filters by searchQuery (case-insensitive)', () => {
      const filters: CombatLogFilters = { searchQuery: 'FIRE' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect((result[0] as DamageEvent).damageType).toBe('fire');
    });

    it('returns empty array when no events match filters', () => {
      const filters: CombatLogFilters = { types: ['spell_cast'] };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for unknown encounter', () => {
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents('ghost', { types: ['damage'] });
      expect(result).toHaveLength(0);
    });

    it('combines type and entityId filters', () => {
      const filters: CombatLogFilters = {
        types: ['damage'],
        entityId: 'tgt-1',
      };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(ENC_A, filters);
      expect(result).toHaveLength(1);
      expect((result[0] as DamageEvent).sourceId).toBe('src-1');
    });
  });

  // ── exportEncounter ───────────────────────────────────────────────────────

  describe('exportEncounter', () => {
    beforeEach(() => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.logEvent(makeDamagePayload());
      store.logEvent(makeHealingPayload());
    });

    it('returns empty string for unknown encounter', () => {
      expect(
        useCombatLogStore.getState().exportEncounter('ghost', 'json')
      ).toBe('');
      expect(
        useCombatLogStore.getState().exportEncounter('ghost', 'text')
      ).toBe('');
    });

    describe('json format', () => {
      it('returns valid JSON', () => {
        const raw = useCombatLogStore.getState().exportEncounter(ENC_A, 'json');
        expect(() => JSON.parse(raw)).not.toThrow();
      });

      it('includes events array and startedAt', () => {
        const parsed = JSON.parse(
          useCombatLogStore.getState().exportEncounter(ENC_A, 'json')
        );
        expect(parsed.events).toHaveLength(2);
        expect(parsed.startedAt).toBeTruthy();
      });
    });

    describe('text format', () => {
      it('returns a non-empty string', () => {
        const text = useCombatLogStore
          .getState()
          .exportEncounter(ENC_A, 'text');
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });

      it('includes round prefix for damage events', () => {
        const text = useCombatLogStore
          .getState()
          .exportEncounter(ENC_A, 'text');
        expect(text).toContain('[R1]');
      });

      it('formats damage event correctly', () => {
        const text = useCombatLogStore
          .getState()
          .exportEncounter(ENC_A, 'text');
        expect(text).toContain('Goblin');
        expect(text).toContain('Hero');
        expect(text).toContain('5');
        expect(text).toContain('slashing');
      });

      it('formats healing event correctly', () => {
        const text = useCombatLogStore
          .getState()
          .exportEncounter(ENC_A, 'text');
        expect(text).toContain('Cleric');
        expect(text).toContain('8 HP');
      });

      it('formats critical hit with CRITICAL marker', () => {
        const store = useCombatLogStore.getState();
        useCombatLogStore.setState({ encounters: {}, activeEncounterId: null });
        store.startEncounterLog(ENC_A);
        store.logEvent(makeDamagePayload({ isCritical: true }));
        const text = store.exportEncounter(ENC_A, 'text');
        expect(text).toContain('CRITICAL');
      });

      it('formats spell_cast event', () => {
        useCombatLogStore.setState({ encounters: {}, activeEncounterId: null });
        const store = useCombatLogStore.getState();
        store.startEncounterLog(ENC_A);
        const spellPayload: Omit<SpellCastEvent, 'id' | 'timestamp'> = {
          type: 'spell_cast',
          encounterId: ENC_A,
          round: 1,
          turn: 1,
          casterId: 'w1',
          casterName: 'Merlin',
          spellName: 'Magic Missile',
          spellLevel: 1,
          slotUsed: 1,
        };
        store.logEvent(spellPayload);
        const text = store.exportEncounter(ENC_A, 'text');
        expect(text).toContain('Merlin cast Magic Missile');
        expect(text).toContain('level 1 slot');
      });

      it('formats round_start event with separator', () => {
        useCombatLogStore.setState({ encounters: {}, activeEncounterId: null });
        const store = useCombatLogStore.getState();
        store.startEncounterLog(ENC_A);
        const roundPayload: Omit<RoundEvent, 'id' | 'timestamp'> = {
          type: 'round_start',
          encounterId: ENC_A,
          round: 2,
          turn: 0,
          roundNumber: 2,
        };
        store.logEvent(roundPayload);
        const text = store.exportEncounter(ENC_A, 'text');
        expect(text).toContain('Round 2');
      });

      it('formats combat_start event with participants', () => {
        useCombatLogStore.setState({ encounters: {}, activeEncounterId: null });
        const store = useCombatLogStore.getState();
        store.startEncounterLog(ENC_A);
        const combatPayload: Omit<CombatStatusEvent, 'id' | 'timestamp'> = {
          type: 'combat_start',
          encounterId: ENC_A,
          round: 0,
          turn: 0,
          participantNames: ['Alice', 'Bob', 'Orc'],
        };
        store.logEvent(combatPayload);
        const text = store.exportEncounter(ENC_A, 'text');
        expect(text).toContain('COMBAT STARTED');
        expect(text).toContain('Alice, Bob, Orc');
      });

      it('formats death event', () => {
        useCombatLogStore.setState({ encounters: {}, activeEncounterId: null });
        const store = useCombatLogStore.getState();
        store.startEncounterLog(ENC_A);
        const deathPayload: Omit<DeathEvent, 'id' | 'timestamp'> = {
          type: 'death',
          encounterId: ENC_A,
          round: 3,
          turn: 1,
          entityId: 'goblin-1',
          entityName: 'Goblin Chief',
        };
        store.logEvent(deathPayload);
        const text = store.exportEncounter(ENC_A, 'text');
        expect(text).toContain('Goblin Chief died');
      });

      it('formats condition_applied event', () => {
        useCombatLogStore.setState({ encounters: {}, activeEncounterId: null });
        const store = useCombatLogStore.getState();
        store.startEncounterLog(ENC_A);
        const condPayload: Omit<ConditionEvent, 'id' | 'timestamp'> = {
          type: 'condition_applied',
          encounterId: ENC_A,
          round: 1,
          turn: 1,
          targetId: 'tgt-1',
          targetName: 'Hero',
          conditionName: 'Poisoned',
          sourceName: 'Viper',
        };
        store.logEvent(condPayload);
        const text = store.exportEncounter(ENC_A, 'text');
        expect(text).toContain('Hero gained Poisoned');
        expect(text).toContain('from Viper');
      });
    });
  });

  // ── pruneOldEncounters ────────────────────────────────────────────────────

  describe('pruneOldEncounters', () => {
    it('keeps all encounters when count is <= 10', () => {
      for (let i = 0; i < 5; i++) {
        useCombatLogStore.getState().startEncounterLog(`enc-${i}`);
      }
      useCombatLogStore.getState().pruneOldEncounters();
      expect(Object.keys(useCombatLogStore.getState().encounters)).toHaveLength(
        5
      );
    });

    it('prunes to 10 when there are more than 10', () => {
      const encounters: Record<string, { events: []; startedAt: string }> = {};
      for (let i = 0; i < 12; i++) {
        encounters[`enc-${i}`] = {
          events: [],
          startedAt: new Date(Date.now() - (12 - i) * 1000).toISOString(),
        };
      }
      useCombatLogStore.setState({ encounters });
      useCombatLogStore.getState().pruneOldEncounters();
      expect(Object.keys(useCombatLogStore.getState().encounters)).toHaveLength(
        10
      );
    });

    it('keeps the newest encounters when pruning', () => {
      const now = Date.now();
      const encounters: Record<string, { events: []; startedAt: string }> = {};
      for (let i = 0; i < 12; i++) {
        encounters[`enc-${i}`] = {
          events: [],
          // enc-11 is newest, enc-0 is oldest
          startedAt: new Date(now - (12 - i) * 10000).toISOString(),
        };
      }
      useCombatLogStore.setState({ encounters });
      useCombatLogStore.getState().pruneOldEncounters();
      const remaining = Object.keys(useCombatLogStore.getState().encounters);
      // Newest 10: enc-2 through enc-11
      expect(remaining).toContain('enc-11');
      expect(remaining).toContain('enc-2');
      expect(remaining).not.toContain('enc-0');
      expect(remaining).not.toContain('enc-1');
    });
  });

  // ── clearEncounterLog ─────────────────────────────────────────────────────

  describe('clearEncounterLog', () => {
    it('removes the encounter from state', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.clearEncounterLog(ENC_A);
      expect(useCombatLogStore.getState().encounters[ENC_A]).toBeUndefined();
    });

    it('is a no-op for an unknown encounter', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.clearEncounterLog('ghost-enc');
      expect(useCombatLogStore.getState().encounters[ENC_A]).toBeDefined();
    });

    it('preserves other encounters when clearing one', () => {
      const store = useCombatLogStore.getState();
      store.startEncounterLog(ENC_A);
      store.startEncounterLog(ENC_B);
      store.clearEncounterLog(ENC_A);
      expect(useCombatLogStore.getState().encounters[ENC_B]).toBeDefined();
    });
  });
});
