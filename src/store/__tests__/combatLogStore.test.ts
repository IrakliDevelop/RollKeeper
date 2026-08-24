import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useCombatLogStore,
  migrateCombatLogPersistedState,
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES,
  COMBAT_LOG_ARCHIVE_MAX_ITEMS,
  COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES,
} from '@/store/combatLogStore';
import { writeCombatLogArchiveAuthorityMarker } from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import type {
  CombatLogState,
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
const ENC_C = 'enc-gamma';

function resetStore() {
  useCombatLogStore.setState({
    encounters: {},
    combatLogTombstones: {},
    activeArchiveId: null,
    lastAdmissionError: null,
  });
}

/**
 * Independent byte oracle for the tests. The store measures canonical JSON
 * (recursively key-sorted) UTF-8 bytes; sorting keys is a permutation of the
 * same characters, so the encoded length is identical to plain
 * `JSON.stringify`. Measuring here without importing the store's helper keeps
 * the fixtures from silently tracking a wrong implementation.
 */
function recordBytes(archive: CombatLogState): number {
  return new TextEncoder().encode(JSON.stringify(archive)).byteLength;
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

/** Writes an unrouted archive straight into state, bypassing `startArchive`. */
function putArchive(
  archiveId: string,
  archive: Partial<CombatLogState> = {}
): string {
  useCombatLogStore.setState(state => ({
    encounters: {
      ...state.encounters,
      [archiveId]: {
        encounterId: ENC_A,
        events: [],
        startedAt: new Date().toISOString(),
        ...archive,
      },
    },
  }));
  return archiveId;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('combatLogStore', () => {
  beforeEach(resetStore);

  // ── startArchive ─────────────────────────────────────────────────────────

  describe('startArchive', () => {
    it('creates an archive entry stamped with the encounter id', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      const state = useCombatLogStore.getState();
      expect(id).toBeTruthy();
      expect(state.encounters[id]).toBeDefined();
      expect(state.encounters[id].encounterId).toBe(ENC_A);
      expect(state.encounters[id].events).toEqual([]);
      expect(state.encounters[id].startedAt).toBeTruthy();
      expect(state.encounters[id].endedAt).toBeUndefined();
    });

    it('records the campaign code when one is supplied', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1')!;
      expect(useCombatLogStore.getState().encounters[id].campaignCode).toBe(
        'SYNTH1'
      );
    });

    it('leaves campaignCode undefined for an unscoped archive', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      expect(
        useCombatLogStore.getState().encounters[id].campaignCode
      ).toBeUndefined();
    });

    it('sets activeArchiveId', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      expect(useCombatLogStore.getState().activeArchiveId).toBe(id);
    });

    it('prunes old unrouted archives when more than 10 exist', () => {
      for (let i = 0; i < 10; i++) {
        putArchive(`old-archive-${i}`, {
          encounterId: `old-enc-${i}`,
          startedAt: new Date(Date.now() - (11 - i) * 10000).toISOString(),
        });
      }
      const fresh = useCombatLogStore.getState().startArchive('new-enc-11')!;
      const remaining = Object.keys(useCombatLogStore.getState().encounters);
      expect(remaining).toHaveLength(10);
      expect(remaining).toContain(fresh);
    });
  });

  // ── endArchive ───────────────────────────────────────────────────────────

  describe('endArchive', () => {
    it('sets endedAt on an existing archive', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().endArchive(id);
      expect(useCombatLogStore.getState().encounters[id].endedAt).toBeTruthy();
    });

    it('is a no-op for a non-existent archive', () => {
      useCombatLogStore.getState().endArchive('ghost-archive');
      expect(
        useCombatLogStore.getState().encounters['ghost-archive']
      ).toBeUndefined();
    });

    it('preserves existing events when ending', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().logEvent(id, makeDamagePayload());
      useCombatLogStore.getState().endArchive(id);
      expect(useCombatLogStore.getState().encounters[id].events).toHaveLength(
        1
      );
    });
  });

  // ── setActiveArchive ─────────────────────────────────────────────────────

  describe('setActiveArchive', () => {
    it('updates activeArchiveId', () => {
      useCombatLogStore.getState().setActiveArchive('archive-xyz');
      expect(useCombatLogStore.getState().activeArchiveId).toBe('archive-xyz');
    });

    it('accepts null to clear active', () => {
      useCombatLogStore.getState().startArchive(ENC_A);
      useCombatLogStore.getState().setActiveArchive(null);
      expect(useCombatLogStore.getState().activeArchiveId).toBeNull();
    });
  });

  // ── logEvent ─────────────────────────────────────────────────────────────

  describe('logEvent', () => {
    it('appends event with generated id and timestamp', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().logEvent(id, makeDamagePayload());
      const events = useCombatLogStore.getState().encounters[id].events;
      expect(events).toHaveLength(1);
      expect(events[0].id).toMatch(/^log-/);
      expect(events[0].timestamp).toBeTruthy();
    });

    it('appends multiple events in order', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore
        .getState()
        .logEvent(id, makeDamagePayload({ round: 1 }));
      useCombatLogStore
        .getState()
        .logEvent(id, makeDamagePayload({ round: 2 }));
      const events = useCombatLogStore.getState().encounters[id].events;
      expect(events).toHaveLength(2);
      expect(events[0].round).toBe(1);
      expect(events[1].round).toBe(2);
    });

    it('assigns unique ids to consecutive events', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().logEvent(id, makeDamagePayload());
      useCombatLogStore.getState().logEvent(id, makeDamagePayload());
      const events = useCombatLogStore.getState().encounters[id].events;
      expect(events[0].id).not.toBe(events[1].id);
    });

    it('replaces the archive object rather than mutating it in place', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      const before = useCombatLogStore.getState().encounters[id];
      useCombatLogStore.getState().logEvent(id, makeDamagePayload());
      const after = useCombatLogStore.getState().encounters[id];
      expect(after).not.toBe(before);
      expect(before.events).toHaveLength(0);
    });
  });

  // ── getEvents ─────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns all events for an archive', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().logEvent(id, makeDamagePayload());
      useCombatLogStore.getState().logEvent(id, makeHealingPayload());
      expect(useCombatLogStore.getState().getEvents(id)).toHaveLength(2);
    });

    it('returns empty array for unknown archive', () => {
      expect(useCombatLogStore.getState().getEvents('no-such-archive')).toEqual(
        []
      );
    });
  });

  // ── getFilteredEvents ─────────────────────────────────────────────────────

  describe('getFilteredEvents', () => {
    let archiveId: string;

    beforeEach(() => {
      archiveId = useCombatLogStore.getState().startArchive(ENC_A)!;
      const store = useCombatLogStore.getState();
      store.logEvent(
        archiveId,
        makeDamagePayload({ round: 1, sourceId: 'src-1', targetId: 'tgt-1' })
      );
      store.logEvent(
        archiveId,
        makeHealingPayload({ round: 2, sourceId: 'src-2', targetId: 'tgt-1' })
      );
      store.logEvent(
        archiveId,
        makeDamagePayload({
          round: 3,
          sourceId: 'src-3',
          targetId: 'tgt-2',
          damageType: 'fire',
        })
      );
    });

    it('returns all events when filters are empty', () => {
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, {});
      expect(result).toHaveLength(3);
    });

    it('filters by type', () => {
      const filters: CombatLogFilters = { types: ['damage'] };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(2);
      result.forEach(e => expect(e.type).toBe('damage'));
    });

    it('filters by multiple types', () => {
      const filters: CombatLogFilters = { types: ['damage', 'healing'] };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(3);
    });

    it('filters by entityId matching sourceId', () => {
      const filters: CombatLogFilters = { entityId: 'src-2' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('healing');
    });

    it('filters by entityId matching targetId', () => {
      const filters: CombatLogFilters = { entityId: 'tgt-2' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect((result[0] as DamageEvent).damageType).toBe('fire');
    });

    it('filters by entityId matching entityId field on TurnEvent', () => {
      useCombatLogStore
        .getState()
        .logEvent(archiveId, makeTurnPayload('hero-id'));
      const filters: CombatLogFilters = { entityId: 'hero-id' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('turn_start');
    });

    it('filters by entityId matching casterId on SpellCastEvent', () => {
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
      useCombatLogStore.getState().logEvent(archiveId, spellPayload);
      const filters: CombatLogFilters = { entityId: 'wizard-1' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('spell_cast');
    });

    it('filters by entityId matching userId on AbilityUseEvent', () => {
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
      useCombatLogStore.getState().logEvent(archiveId, abilityPayload);
      const filters: CombatLogFilters = { entityId: 'dragon-1' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ability_use');
    });

    it('filters by roundRange min', () => {
      const filters: CombatLogFilters = { roundRange: { min: 2 } };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(2);
      result.forEach(e => expect(e.round).toBeGreaterThanOrEqual(2));
    });

    it('filters by roundRange max', () => {
      const filters: CombatLogFilters = { roundRange: { max: 2 } };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(2);
      result.forEach(e => expect(e.round).toBeLessThanOrEqual(2));
    });

    it('filters by roundRange min and max', () => {
      const filters: CombatLogFilters = { roundRange: { min: 2, max: 2 } };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect(result[0].round).toBe(2);
    });

    it('filters by searchQuery (case-insensitive)', () => {
      const filters: CombatLogFilters = { searchQuery: 'FIRE' };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect((result[0] as DamageEvent).damageType).toBe('fire');
    });

    it('returns empty array when no events match filters', () => {
      const filters: CombatLogFilters = { types: ['spell_cast'] };
      const result = useCombatLogStore
        .getState()
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for unknown archive', () => {
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
        .getFilteredEvents(archiveId, filters);
      expect(result).toHaveLength(1);
      expect((result[0] as DamageEvent).sourceId).toBe('src-1');
    });
  });

  // ── exportArchive ─────────────────────────────────────────────────────────

  describe('exportArchive', () => {
    let archiveId: string;

    beforeEach(() => {
      archiveId = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().logEvent(archiveId, makeDamagePayload());
      useCombatLogStore.getState().logEvent(archiveId, makeHealingPayload());
    });

    it('returns empty string for unknown archive', () => {
      expect(useCombatLogStore.getState().exportArchive('ghost', 'json')).toBe(
        ''
      );
      expect(useCombatLogStore.getState().exportArchive('ghost', 'text')).toBe(
        ''
      );
    });

    describe('json format', () => {
      it('returns valid JSON', () => {
        const raw = useCombatLogStore
          .getState()
          .exportArchive(archiveId, 'json');
        expect(() => JSON.parse(raw)).not.toThrow();
      });

      it('includes events array and startedAt', () => {
        const parsed = JSON.parse(
          useCombatLogStore.getState().exportArchive(archiveId, 'json')
        );
        expect(parsed.events).toHaveLength(2);
        expect(parsed.startedAt).toBeTruthy();
      });
    });

    describe('text format', () => {
      it('returns a non-empty string', () => {
        const text = useCombatLogStore
          .getState()
          .exportArchive(archiveId, 'text');
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });

      it('includes round prefix for damage events', () => {
        const text = useCombatLogStore
          .getState()
          .exportArchive(archiveId, 'text');
        expect(text).toContain('[R1]');
      });

      it('formats damage event correctly', () => {
        const text = useCombatLogStore
          .getState()
          .exportArchive(archiveId, 'text');
        expect(text).toContain('Goblin');
        expect(text).toContain('Hero');
        expect(text).toContain('5');
        expect(text).toContain('slashing');
      });

      it('formats healing event correctly', () => {
        const text = useCombatLogStore
          .getState()
          .exportArchive(archiveId, 'text');
        expect(text).toContain('Cleric');
        expect(text).toContain('8 HP');
      });

      it('formats critical hit with CRITICAL marker', () => {
        resetStore();
        const id = useCombatLogStore.getState().startArchive(ENC_A)!;
        useCombatLogStore
          .getState()
          .logEvent(id, makeDamagePayload({ isCritical: true }));
        const text = useCombatLogStore.getState().exportArchive(id, 'text');
        expect(text).toContain('CRITICAL');
      });

      it('formats spell_cast event', () => {
        resetStore();
        const id = useCombatLogStore.getState().startArchive(ENC_A)!;
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
        useCombatLogStore.getState().logEvent(id, spellPayload);
        const text = useCombatLogStore.getState().exportArchive(id, 'text');
        expect(text).toContain('Merlin cast Magic Missile');
        expect(text).toContain('level 1 slot');
      });

      it('formats round_start event with separator', () => {
        resetStore();
        const id = useCombatLogStore.getState().startArchive(ENC_A)!;
        const roundPayload: Omit<RoundEvent, 'id' | 'timestamp'> = {
          type: 'round_start',
          encounterId: ENC_A,
          round: 2,
          turn: 0,
          roundNumber: 2,
        };
        useCombatLogStore.getState().logEvent(id, roundPayload);
        const text = useCombatLogStore.getState().exportArchive(id, 'text');
        expect(text).toContain('Round 2');
      });

      it('formats combat_start event with participants', () => {
        resetStore();
        const id = useCombatLogStore.getState().startArchive(ENC_A)!;
        const combatPayload: Omit<CombatStatusEvent, 'id' | 'timestamp'> = {
          type: 'combat_start',
          encounterId: ENC_A,
          round: 0,
          turn: 0,
          participantNames: ['Alice', 'Bob', 'Orc'],
        };
        useCombatLogStore.getState().logEvent(id, combatPayload);
        const text = useCombatLogStore.getState().exportArchive(id, 'text');
        expect(text).toContain('COMBAT STARTED');
        expect(text).toContain('Alice, Bob, Orc');
      });

      it('formats death event', () => {
        resetStore();
        const id = useCombatLogStore.getState().startArchive(ENC_A)!;
        const deathPayload: Omit<DeathEvent, 'id' | 'timestamp'> = {
          type: 'death',
          encounterId: ENC_A,
          round: 3,
          turn: 1,
          entityId: 'goblin-1',
          entityName: 'Goblin Chief',
        };
        useCombatLogStore.getState().logEvent(id, deathPayload);
        const text = useCombatLogStore.getState().exportArchive(id, 'text');
        expect(text).toContain('Goblin Chief died');
      });

      it('formats condition_applied event', () => {
        resetStore();
        const id = useCombatLogStore.getState().startArchive(ENC_A)!;
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
        useCombatLogStore.getState().logEvent(id, condPayload);
        const text = useCombatLogStore.getState().exportArchive(id, 'text');
        expect(text).toContain('Hero gained Poisoned');
        expect(text).toContain('from Viper');
      });
    });
  });

  // ── getArchivesForEncounter / getLatestArchiveForEncounter ────────────────

  describe('getArchivesForEncounter', () => {
    it('returns every archive for the encounter, oldest first', () => {
      putArchive('archive-old', {
        encounterId: ENC_A,
        startedAt: '2026-01-01T00:00:00.000Z',
      });
      putArchive('archive-new', {
        encounterId: ENC_A,
        startedAt: '2026-01-02T00:00:00.000Z',
      });
      putArchive('archive-other', { encounterId: ENC_B });

      const result = useCombatLogStore
        .getState()
        .getArchivesForEncounter(ENC_A);
      expect(result.map(a => a.archiveId)).toEqual([
        'archive-old',
        'archive-new',
      ]);
    });

    it('returns an empty array for an encounter with no archives', () => {
      expect(
        useCombatLogStore.getState().getArchivesForEncounter('no-such-enc')
      ).toEqual([]);
    });
  });

  describe('getLatestArchiveForEncounter', () => {
    it('returns the newest archive for the encounter', () => {
      putArchive('archive-old', {
        encounterId: ENC_A,
        startedAt: '2026-01-01T00:00:00.000Z',
      });
      putArchive('archive-new', {
        encounterId: ENC_A,
        startedAt: '2026-01-02T00:00:00.000Z',
      });
      expect(
        useCombatLogStore.getState().getLatestArchiveForEncounter(ENC_A)
          ?.archiveId
      ).toBe('archive-new');
    });

    it('returns null when the encounter has no archives', () => {
      expect(
        useCombatLogStore.getState().getLatestArchiveForEncounter('no-such-enc')
      ).toBeNull();
    });
  });

  // ── pruneOldArchives ──────────────────────────────────────────────────────

  describe('pruneOldArchives', () => {
    it('keeps all archives when count is <= 10', () => {
      for (let i = 0; i < 5; i++) {
        useCombatLogStore.getState().startArchive(`enc-${i}`);
      }
      useCombatLogStore.getState().pruneOldArchives();
      expect(Object.keys(useCombatLogStore.getState().encounters)).toHaveLength(
        5
      );
    });

    it('prunes to 10 when there are more than 10', () => {
      for (let i = 0; i < 12; i++) {
        putArchive(`archive-${i}`, {
          encounterId: `enc-${i}`,
          startedAt: new Date(Date.now() - (12 - i) * 1000).toISOString(),
        });
      }
      useCombatLogStore.getState().pruneOldArchives();
      expect(Object.keys(useCombatLogStore.getState().encounters)).toHaveLength(
        10
      );
    });

    it('keeps the newest archives when pruning', () => {
      const now = Date.now();
      for (let i = 0; i < 12; i++) {
        putArchive(`archive-${i}`, {
          encounterId: `enc-${i}`,
          // archive-11 is newest, archive-0 is oldest
          startedAt: new Date(now - (12 - i) * 10000).toISOString(),
        });
      }
      useCombatLogStore.getState().pruneOldArchives();
      const remaining = Object.keys(useCombatLogStore.getState().encounters);
      // Newest 10: archive-2 through archive-11
      expect(remaining).toContain('archive-11');
      expect(remaining).toContain('archive-2');
      expect(remaining).not.toContain('archive-0');
      expect(remaining).not.toContain('archive-1');
    });
  });

  // ── clearArchive ──────────────────────────────────────────────────────────

  describe('clearArchive', () => {
    it('removes the archive from state', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().clearArchive(id);
      expect(useCombatLogStore.getState().encounters[id]).toBeUndefined();
    });

    it('is a no-op for an unknown archive', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().clearArchive('ghost-archive');
      expect(useCombatLogStore.getState().encounters[id]).toBeDefined();
    });

    it('preserves other archives when clearing one', () => {
      const a = useCombatLogStore.getState().startArchive(ENC_A)!;
      const b = useCombatLogStore.getState().startArchive(ENC_B)!;
      useCombatLogStore.getState().clearArchive(a);
      expect(useCombatLogStore.getState().encounters[b]).toBeDefined();
    });

    it('writes a tombstone with the before-image for a campaign-scoped archive', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1')!;
      const beforeImage = useCombatLogStore.getState().encounters[id];
      useCombatLogStore.getState().clearArchive(id);
      const tombstone = useCombatLogStore.getState().combatLogTombstones[id];
      expect(tombstone).toBeDefined();
      expect(tombstone.legacyId).toBe(id);
      expect(tombstone.beforeImage).toEqual(beforeImage);
      expect(tombstone.deletedAt).toBeTruthy();
    });

    it('writes no tombstone for an archive with no campaign code', () => {
      const id = useCombatLogStore.getState().startArchive(ENC_A)!;
      useCombatLogStore.getState().clearArchive(id);
      expect(useCombatLogStore.getState().combatLogTombstones).toEqual({});
    });
  });

  // ── dismissAdmissionError ─────────────────────────────────────────────────

  describe('dismissAdmissionError', () => {
    it('clears a recorded admission error', () => {
      useCombatLogStore.setState({
        lastAdmissionError: {
          archiveId: 'archive-1',
          reason: 'record-bytes',
          at: '2026-01-01T00:00:00.000Z',
        },
      });
      useCombatLogStore.getState().dismissAdmissionError();
      expect(useCombatLogStore.getState().lastAdmissionError).toBeNull();
    });
  });
});

// ── Slice 11F: archive identity (rulings 6 & 7) ─────────────────────────────

describe('combatLogStore archive identity (Slice 11F)', () => {
  beforeEach(resetStore);

  it('does not create an archive when logging to an unknown id', () => {
    const before = JSON.stringify(useCombatLogStore.getState().encounters);
    expect(() =>
      useCombatLogStore
        .getState()
        .logEvent('missing-archive', makeDamagePayload())
    ).not.toThrow();
    const after = useCombatLogStore.getState();
    expect(after.encounters).toEqual(JSON.parse(before));
    expect(after.encounters['missing-archive']).toBeUndefined();
  });

  it('mints a distinct archive on every start for the same encounter', () => {
    const store = useCombatLogStore.getState();
    const first = store.startArchive(ENC_A, 'SYNTH1');
    useCombatLogStore.getState().logEvent(first!, makeDamagePayload());
    const second = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1');

    expect(second).not.toBe(first);
    const state = useCombatLogStore.getState();
    expect(state.encounters[first!].events).toHaveLength(1);
    expect(state.encounters[second!].events).toHaveLength(0);
    expect(state.encounters[first!].encounterId).toBe(ENC_A);
    expect(state.encounters[second!].encounterId).toBe(ENC_A);
  });
});

// ── Slice 11F: prospective admission gates (ruling 5) and prune (ruling 2) ──

/** Marks `campaignCode` as routed to the durable DM store. */
function seedRouted(campaignCode: string) {
  vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
  writeCombatLogArchiveAuthorityMarker(localStorage, {
    version: 1,
    campaignCode,
    authority: 'indexedDB',
    epoch: 1,
    accountId: 'account-synthetic',
    campaignId: 'campaign-synthetic',
  });
}

function makeLargeDamagePayload() {
  return makeDamagePayload({ weaponOrSpellName: 'x'.repeat(16_384) });
}

function seedEvent(pad: number, index: number): DamageEvent {
  return {
    ...makeDamagePayload({ weaponOrSpellName: 'x'.repeat(pad) }),
    id: `seed-event-${String(index).padStart(6, '0')}`,
    timestamp: '2026-01-01T00:00:00.000Z',
  };
}

/** Cost of one zero-padding event, plus slack so fills always undershoot. */
const PAD_EVENT_OVERHEAD = (() => {
  const one: CombatLogState = {
    encounterId: ENC_A,
    events: [seedEvent(0, 0)],
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  const two: CombatLogState = {
    ...one,
    events: [seedEvent(0, 0), seedEvent(0, 1)],
  };
  return recordBytes(two) - recordBytes(one) + 64;
})();

/** Appends real (gated) events until the archive is just under `targetBytes`. */
function fillArchiveToBytes(archiveId: string, targetBytes: number) {
  for (let guard = 0; guard < 2_000; guard += 1) {
    const archive = useCombatLogStore.getState().encounters[archiveId];
    if (!archive) return;
    const room = targetBytes - recordBytes(archive);
    if (room <= PAD_EVENT_OVERHEAD) return;
    const pad = Math.min(32_768, room - PAD_EVENT_OVERHEAD);
    useCombatLogStore
      .getState()
      .logEvent(
        archiveId,
        makeDamagePayload({ weaponOrSpellName: 'x'.repeat(pad) })
      );
    // A rejected append leaves the record object identical — stop rather than spin.
    if (useCombatLogStore.getState().encounters[archiveId] === archive) return;
  }
}

/** Writes `count` empty routed archives straight into state (bypasses the gates). */
function seedArchives(campaignCode: string, count: number) {
  const encounters = { ...useCombatLogStore.getState().encounters };
  const seeded: Array<{ archiveId: string } & CombatLogState> = [];
  for (let i = 0; i < count; i += 1) {
    const archiveId = `seed-${campaignCode}-${i}`;
    const archive: CombatLogState = {
      encounterId: `${ENC_A}-${i}`,
      campaignCode,
      events: [],
      startedAt: new Date(Date.now() - (count - i) * 1_000).toISOString(),
    };
    encounters[archiveId] = archive;
    seeded.push({ archiveId, ...archive });
  }
  useCombatLogStore.setState({ encounters });
  return seeded;
}

/** Writes routed archives straight into state until the campaign holds >= targetBytes. */
function seedArchivesToBytes(campaignCode: string, targetBytes: number) {
  const encounters = { ...useCombatLogStore.getState().encounters };
  let total = Object.values(encounters)
    .filter(archive => archive.campaignCode === campaignCode)
    .reduce((sum, archive) => sum + recordBytes(archive), 0);

  for (let index = 0; total < targetBytes && index < 200; index += 1) {
    const archive: CombatLogState = {
      encounterId: `${ENC_B}-${index}`,
      campaignCode,
      events: [],
      startedAt: new Date(Date.now() - (200 - index) * 1_000).toISOString(),
    };
    const cap = Math.min(
      targetBytes - total,
      COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES - 1_024
    );
    for (let guard = 0; guard < 100; guard += 1) {
      const room = cap - recordBytes(archive);
      if (room <= PAD_EVENT_OVERHEAD) break;
      archive.events.push(
        seedEvent(Math.min(32_768, room - PAD_EVENT_OVERHEAD), guard)
      );
    }
    encounters[`bulk-${campaignCode}-${index}`] = archive;
    total += recordBytes(archive);
  }

  useCombatLogStore.setState({ encounters });
}

/**
 * Writes a routed archive of *exactly* `targetBytes` straight into state.
 * A coarse fill gets within ~40 KB, then one final event is padded by the exact
 * deficit — `seedEvent` ids are fixed-width, so one extra `x` costs one byte.
 */
function seedRoutedArchiveOfExactBytes(
  archiveId: string,
  campaignCode: string,
  targetBytes: number
): CombatLogState {
  const archive: CombatLogState = {
    encounterId: ENC_A,
    campaignCode,
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  const push = (pad: number) =>
    archive.events.push(seedEvent(pad, archive.events.length));

  for (let guard = 0; guard < 100; guard += 1) {
    const room = targetBytes - 40_000 - recordBytes(archive);
    if (room <= PAD_EVENT_OVERHEAD) break;
    push(Math.min(32_768, room - PAD_EVENT_OVERHEAD));
  }
  push(0);
  const deficit = targetBytes - recordBytes(archive);
  if (deficit > 0) {
    archive.events[archive.events.length - 1] = seedEvent(
      deficit,
      archive.events.length - 1
    );
  }

  useCombatLogStore.setState(state => ({
    encounters: { ...state.encounters, [archiveId]: archive },
  }));
  return archive;
}

/** Canonical bytes the campaign currently occupies across its live archives. */
function campaignBytes(campaignCode: string): number {
  return Object.values(useCombatLogStore.getState().encounters)
    .filter(archive => archive.campaignCode === campaignCode)
    .reduce((sum, archive) => sum + recordBytes(archive), 0);
}

describe('combatLogStore admission gates (Slice 11F)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('rejects an append that would exceed the per-record byte limit without changing the store', () => {
    seedRouted('SYNTH1');
    const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1')!;
    fillArchiveToBytes(id, COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES - 200);

    const before = JSON.stringify(useCombatLogStore.getState().encounters);
    useCombatLogStore.getState().logEvent(id, makeLargeDamagePayload());

    const after = useCombatLogStore.getState();
    expect(JSON.stringify(after.encounters)).toBe(before);
    expect(after.lastAdmissionError).toMatchObject({
      archiveId: id,
      reason: 'record-bytes',
    });
  });

  it('rejects a new routed archive once the campaign holds MAX_ITEMS documents, counting tombstones', () => {
    seedRouted('SYNTH1');
    seedArchives('SYNTH1', COMBAT_LOG_ARCHIVE_MAX_ITEMS - 1);
    const doomed = useCombatLogStore.getState().startArchive(ENC_B, 'SYNTH1')!;
    useCombatLogStore.getState().clearArchive(doomed); // tombstone still occupies a slot

    const before = JSON.stringify(useCombatLogStore.getState().encounters);
    const refused = useCombatLogStore.getState().startArchive(ENC_C, 'SYNTH1');

    expect(refused).toBeNull();
    expect(JSON.stringify(useCombatLogStore.getState().encounters)).toBe(
      before
    );
    expect(useCombatLogStore.getState().lastAdmissionError?.reason).toBe(
      'item-count'
    );
  });

  it('rejects growth past the campaign aggregate byte limit without changing the store', () => {
    seedRouted('SYNTH1');
    seedArchivesToBytes('SYNTH1', COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES - 500);
    const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1');
    // Without this the seeding could overshoot, `startArchive` could return
    // null, and the `logEvent` below would be the unknown-id no-op — leaving
    // every assertion true with the gate under test never running.
    expect(id).toBeTruthy();

    const before = JSON.stringify(useCombatLogStore.getState().encounters);
    useCombatLogStore.getState().logEvent(id!, makeLargeDamagePayload());

    expect(JSON.stringify(useCombatLogStore.getState().encounters)).toBe(
      before
    );
    expect(useCombatLogStore.getState().lastAdmissionError).toMatchObject({
      archiveId: id,
      reason: 'total-bytes',
    });
  });

  it('leaves an unrouted campaign ungated', () => {
    // no authority marker written
    const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1')!;
    fillArchiveToBytes(id, COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES + 4_096);
    expect(useCombatLogStore.getState().lastAdmissionError).toBeNull();
  });

  it('never prunes or tombstones a routed archive', () => {
    seedRouted('SYNTH1');
    const routed = seedArchives('SYNTH1', 15).map(a => a.archiveId);
    useCombatLogStore.getState().pruneOldArchives();

    const state = useCombatLogStore.getState();
    for (const id of routed) expect(state.encounters[id]).toBeDefined();
    expect(state.combatLogTombstones).toEqual({});
  });

  it('refuses to close a routed archive sitting exactly on the per-record cap', () => {
    seedRouted('SYNTH1');
    const id = 'archive-at-the-cap';
    const seeded = seedRoutedArchiveOfExactBytes(
      id,
      'SYNTH1',
      COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES
    );
    // The gate admits a record *at* the cap, so `endedAt` is what pushes it over.
    expect(recordBytes(seeded)).toBe(COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES);

    const before = JSON.stringify(useCombatLogStore.getState().encounters);
    useCombatLogStore.getState().endArchive(id);

    const after = useCombatLogStore.getState();
    expect(JSON.stringify(after.encounters)).toBe(before);
    expect(after.encounters[id].endedAt).toBeUndefined();
    expect(after.lastAdmissionError).toMatchObject({
      archiveId: id,
      reason: 'record-bytes',
    });
  });

  it('refuses to close a routed archive that would push the campaign past the aggregate cap', () => {
    seedRouted('SYNTH1');
    const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1');
    expect(id).toBeTruthy();

    // Cost of stamping `endedAt` — the only growth `endArchive` causes.
    const archive = useCombatLogStore.getState().encounters[id!];
    const endCost =
      recordBytes({ ...archive, endedAt: '2026-01-01T00:00:00.000Z' }) -
      recordBytes(archive);

    // Park the campaign one byte below the point where `endedAt` overflows it,
    // so the archive is admitted as it stands and only closing it is refused.
    seedArchivesToBytes('SYNTH1', COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES - 100_000);
    seedRoutedArchiveOfExactBytes(
      'filler-exact',
      'SYNTH1',
      COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES - endCost + 1 - campaignBytes('SYNTH1')
    );
    expect(campaignBytes('SYNTH1')).toBe(
      COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES - endCost + 1
    );

    const before = JSON.stringify(useCombatLogStore.getState().encounters);
    useCombatLogStore.getState().endArchive(id!);

    const after = useCombatLogStore.getState();
    expect(JSON.stringify(after.encounters)).toBe(before);
    expect(after.encounters[id!].endedAt).toBeUndefined();
    expect(after.lastAdmissionError).toMatchObject({
      archiveId: id,
      reason: 'total-bytes',
    });
  });

  it('still closes a routed archive that stays within the caps', () => {
    seedRouted('SYNTH1');
    const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1')!;
    useCombatLogStore.getState().endArchive(id);

    const after = useCombatLogStore.getState();
    expect(after.encounters[id].endedAt).toBeTruthy();
    expect(after.lastAdmissionError).toBeNull();
  });

  it('closes an oversized unrouted archive, because gates apply only to routed ones', () => {
    const id = useCombatLogStore.getState().startArchive(ENC_A, 'SYNTH1')!;
    fillArchiveToBytes(id, COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES + 4_096);
    useCombatLogStore.getState().endArchive(id);

    const after = useCombatLogStore.getState();
    expect(after.encounters[id].endedAt).toBeTruthy();
    expect(after.lastAdmissionError).toBeNull();
  });
});

// ── Slice 11F: v1 → v2 persisted-state migration ────────────────────────────

/** A realistic version-1 blob: `encounters` keyed by `encounterId`. */
function legacyPersistedState() {
  return {
    encounters: {
      [ENC_A]: {
        events: [seedEvent(0, 0), seedEvent(0, 1)],
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-01-01T01:00:00.000Z',
      },
      [ENC_B]: {
        events: [],
        startedAt: '2026-01-02T00:00:00.000Z',
      },
    },
    activeEncounterId: ENC_B,
  };
}

describe('migrateCombatLogPersistedState (Slice 11F)', () => {
  it('re-keys every archive from encounterId to a fresh archiveId', () => {
    const migrated = migrateCombatLogPersistedState(legacyPersistedState(), 1);

    const archiveIds = Object.keys(migrated.encounters);
    expect(archiveIds).toHaveLength(2);
    // The old encounter ids must no longer be keys...
    expect(archiveIds).not.toContain(ENC_A);
    expect(archiveIds).not.toContain(ENC_B);
    // ...and each minted id must be a distinct UUID.
    expect(new Set(archiveIds).size).toBe(2);
    for (const id of archiveIds) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    }
  });

  it('stamps the old key onto the record as encounterId', () => {
    const migrated = migrateCombatLogPersistedState(legacyPersistedState(), 1);
    const encounterIds = Object.values(migrated.encounters).map(
      archive => archive.encounterId
    );
    expect(encounterIds.sort()).toEqual([ENC_A, ENC_B].sort());
  });

  it('preserves events, startedAt and endedAt on each migrated archive', () => {
    const legacy = legacyPersistedState();
    const migrated = migrateCombatLogPersistedState(legacy, 1);

    const a = Object.values(migrated.encounters).find(
      archive => archive.encounterId === ENC_A
    )!;
    expect(a.events).toEqual(legacy.encounters[ENC_A].events);
    expect(a.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(a.endedAt).toBe('2026-01-01T01:00:00.000Z');

    const b = Object.values(migrated.encounters).find(
      archive => archive.encounterId === ENC_B
    )!;
    expect(b.events).toEqual([]);
    expect(b.endedAt).toBeUndefined();
  });

  it('leaves campaignCode undefined — a v1 archive was never routed', () => {
    const migrated = migrateCombatLogPersistedState(legacyPersistedState(), 1);
    for (const archive of Object.values(migrated.encounters)) {
      expect(archive.campaignCode).toBeUndefined();
    }
  });

  it('remaps activeEncounterId to the archiveId its encounter was re-keyed to', () => {
    const migrated = migrateCombatLogPersistedState(legacyPersistedState(), 1);

    expect(migrated.activeArchiveId).not.toBeNull();
    expect(migrated.activeArchiveId).not.toBe(ENC_B);
    expect(migrated.encounters[migrated.activeArchiveId!]).toBeDefined();
    expect(migrated.encounters[migrated.activeArchiveId!].encounterId).toBe(
      ENC_B
    );
  });

  it('drops an activeEncounterId that no v1 archive matches', () => {
    const legacy = {
      ...legacyPersistedState(),
      activeEncounterId: 'ghost-enc',
    };
    expect(
      migrateCombatLogPersistedState(legacy, 1).activeArchiveId
    ).toBeNull();
  });

  it('maps a missing activeEncounterId to null', () => {
    const legacy = legacyPersistedState() as Record<string, unknown>;
    delete legacy.activeEncounterId;
    expect(
      migrateCombatLogPersistedState(legacy, 1).activeArchiveId
    ).toBeNull();
  });

  it('seeds an empty tombstone map', () => {
    expect(
      migrateCombatLogPersistedState(legacyPersistedState(), 1)
        .combatLogTombstones
    ).toEqual({});
  });

  it('tolerates an empty or absent v1 payload', () => {
    for (const payload of [undefined, null, {}, { encounters: {} }]) {
      expect(migrateCombatLogPersistedState(payload, 1)).toEqual({
        encounters: {},
        combatLogTombstones: {},
        activeArchiveId: null,
      });
    }
  });

  it('passes a v2 payload through without re-keying it', () => {
    const current = {
      encounters: {
        'archive-uuid': {
          encounterId: ENC_A,
          campaignCode: 'SYNTH1',
          events: [],
          startedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      combatLogTombstones: {
        'archive-gone': {
          legacyId: 'archive-gone',
          beforeImage: {
            encounterId: ENC_B,
            campaignCode: 'SYNTH1',
            events: [],
            startedAt: '2026-01-01T00:00:00.000Z',
          },
          deletedAt: '2026-01-03T00:00:00.000Z',
        },
      },
      activeArchiveId: 'archive-uuid',
    };
    expect(
      migrateCombatLogPersistedState(
        current,
        COMBAT_LOG_ARCHIVE_PERSIST_VERSION
      )
    ).toEqual(current);
  });
});
