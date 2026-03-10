import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  CombatLogEvent,
  CombatLogFilters,
  CombatLogState,
} from '@/types/combatLog';

const COMBAT_LOG_STORAGE_KEY = 'rollkeeper-combat-log';
const MAX_ENCOUNTERS_STORED = 10;

function generateId(): string {
  return (
    'log-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

interface CombatLogStoreState {
  encounters: Record<string, CombatLogState>;
  activeEncounterId: string | null;

  // Lifecycle
  startEncounterLog: (encounterId: string) => void;
  endEncounterLog: (encounterId: string) => void;
  setActiveEncounterLog: (encounterId: string | null) => void;

  // Logging
  logEvent: (event: Omit<CombatLogEvent, 'id' | 'timestamp'>) => void;

  // Querying
  getEvents: (encounterId: string) => CombatLogEvent[];
  getFilteredEvents: (
    encounterId: string,
    filters: CombatLogFilters
  ) => CombatLogEvent[];

  // Export
  exportEncounter: (encounterId: string, format: 'json' | 'text') => string;

  // Cleanup
  pruneOldEncounters: () => void;
  clearEncounterLog: (encounterId: string) => void;
}

function matchesFilters(
  event: CombatLogEvent,
  filters: CombatLogFilters
): boolean {
  if (filters.types && filters.types.length > 0) {
    if (!filters.types.includes(event.type)) return false;
  }

  if (filters.entityId) {
    const entityId = filters.entityId;
    const hasEntity =
      ('sourceId' in event && event.sourceId === entityId) ||
      ('targetId' in event && event.targetId === entityId) ||
      ('entityId' in event && event.entityId === entityId) ||
      ('casterId' in event && event.casterId === entityId) ||
      ('userId' in event && event.userId === entityId);
    if (!hasEntity) return false;
  }

  if (filters.roundRange) {
    if (
      filters.roundRange.min !== undefined &&
      event.round < filters.roundRange.min
    )
      return false;
    if (
      filters.roundRange.max !== undefined &&
      event.round > filters.roundRange.max
    )
      return false;
  }

  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    const searchable = JSON.stringify(event).toLowerCase();
    if (!searchable.includes(query)) return false;
  }

  return true;
}

function formatEventToText(event: CombatLogEvent): string {
  const prefix = `[R${event.round}]`;

  switch (event.type) {
    case 'damage':
      return `${prefix} ${event.sourceName} dealt ${event.amount} ${event.damageType} damage to ${event.targetName}${event.isCritical ? ' (CRITICAL!)' : ''}${event.weaponOrSpellName ? ` with ${event.weaponOrSpellName}` : ''}`;
    case 'healing':
      return `${prefix} ${event.sourceName} healed ${event.targetName} for ${event.actualHealing} HP${event.spellOrAbilityName ? ` using ${event.spellOrAbilityName}` : ''}`;
    case 'condition_applied':
      return `${prefix} ${event.targetName} gained ${event.conditionName}${event.sourceName ? ` from ${event.sourceName}` : ''}${event.duration ? ` (${event.duration})` : ''}`;
    case 'condition_removed':
      return `${prefix} ${event.conditionName} removed from ${event.targetName}`;
    case 'turn_start':
      return `${prefix} --- ${event.entityName}'s turn ---`;
    case 'turn_end':
      return `${prefix} ${event.entityName}'s turn ended`;
    case 'spell_cast':
      return `${prefix} ${event.casterName} cast ${event.spellName}${event.slotUsed ? ` (level ${event.slotUsed} slot)` : ''}${event.isConcentration ? ' [Concentration]' : ''}`;
    case 'ability_use':
      return `${prefix} ${event.userName} used ${event.abilityName}${event.legendaryActionCost ? ` (${event.legendaryActionCost} legendary action${event.legendaryActionCost > 1 ? 's' : ''})` : ''}`;
    case 'round_start':
      return `\n===== Round ${event.roundNumber} =====`;
    case 'round_end':
      return `===== End of Round ${event.roundNumber} =====\n`;
    case 'combat_start':
      return `\n*** COMBAT STARTED ***\nParticipants: ${event.participantNames.join(', ')}`;
    case 'combat_end':
      return `*** COMBAT ENDED ***${event.endReason ? ` (${event.endReason})` : ''}`;
    case 'unconscious':
      return `${prefix} ${event.entityName} fell unconscious!`;
    case 'death':
      return `${prefix} ${event.entityName} died!`;
    case 'revived':
      return `${prefix} ${event.entityName} was revived!`;
    case 'stabilized':
      return `${prefix} ${event.entityName} was stabilized`;
  }
}

export const useCombatLogStore = create<CombatLogStoreState>()(
  persist(
    (set, get) => ({
      encounters: {},
      activeEncounterId: null,

      startEncounterLog: encounterId => {
        set(state => ({
          encounters: {
            ...state.encounters,
            [encounterId]: {
              events: [],
              startedAt: new Date().toISOString(),
            },
          },
          activeEncounterId: encounterId,
        }));
        // Prune after creating a new log
        get().pruneOldEncounters();
      },

      endEncounterLog: encounterId => {
        set(state => {
          const encounterLog = state.encounters[encounterId];
          if (!encounterLog) return state;
          return {
            encounters: {
              ...state.encounters,
              [encounterId]: {
                ...encounterLog,
                endedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      setActiveEncounterLog: encounterId => {
        set({ activeEncounterId: encounterId });
      },

      logEvent: eventData => {
        const encounterId = eventData.encounterId;
        const event: CombatLogEvent = {
          ...eventData,
          id: generateId(),
          timestamp: new Date().toISOString(),
        } as CombatLogEvent;

        set(state => {
          const encounterLog = state.encounters[encounterId] ?? {
            events: [],
            startedAt: new Date().toISOString(),
          };
          return {
            encounters: {
              ...state.encounters,
              [encounterId]: {
                ...encounterLog,
                events: [...encounterLog.events, event],
              },
            },
          };
        });
      },

      getEvents: encounterId => {
        return get().encounters[encounterId]?.events ?? [];
      },

      getFilteredEvents: (encounterId, filters) => {
        const events = get().encounters[encounterId]?.events ?? [];
        return events.filter(e => matchesFilters(e, filters));
      },

      exportEncounter: (encounterId, format) => {
        const encounterLog = get().encounters[encounterId];
        if (!encounterLog) return '';

        if (format === 'json') {
          return JSON.stringify(encounterLog, null, 2);
        }

        // Plain text format
        return encounterLog.events.map(formatEventToText).join('\n');
      },

      pruneOldEncounters: () => {
        set(state => {
          const entries = Object.entries(state.encounters);
          if (entries.length <= MAX_ENCOUNTERS_STORED) return state;

          // Sort by startedAt, keep the newest
          const sorted = entries.sort(
            ([, a], [, b]) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          );
          const kept = sorted.slice(0, MAX_ENCOUNTERS_STORED);
          return {
            encounters: Object.fromEntries(kept),
          };
        });
      },

      clearEncounterLog: encounterId => {
        set(state => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [encounterId]: _removed, ...rest } = state.encounters;
          return { encounters: rest };
        });
      },
    }),
    {
      name: COMBAT_LOG_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export default useCombatLogStore;
