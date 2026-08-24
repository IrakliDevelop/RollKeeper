import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isIndexedDbMigrationEnabled } from '@/lib/indexeddb/persistenceBootstrap';
import { createCombatLogArchiveAwareStorage } from '@/lib/durableDm/combatLogArchiveAwareStorage';
import { combatLogArchiveUsesIndexedDbAuthority } from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import {
  canonicalJson,
  combatLogArchivePayloadFrom,
  COMBAT_LOG_ARCHIVE_MAX_ITEMS,
  COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES,
  COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES,
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';
import {
  CombatLogAdmissionError,
  CombatLogAdmissionReason,
  CombatLogEvent,
  CombatLogFilters,
  CombatLogState,
  CombatLogTombstone,
} from '@/types/combatLog';

/**
 * Slice 11F admission bounds. `combatLogArchiveFamily` is their canonical home
 * — the family module and the Postgres side must enforce the same numbers —
 * and they are re-exported here for the store's existing consumers.
 */
export {
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES,
  COMBAT_LOG_ARCHIVE_MAX_ITEMS,
  COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES,
} from '@/lib/durableDm/combatLogArchiveFamily';

/** Cap on locally retained *unrouted* archives. Routed ones are never pruned. */
const MAX_ARCHIVES_STORED = 10;

function generateEventId(): string {
  return (
    'log-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 11)
  );
}

function generateArchiveId(): string {
  return crypto.randomUUID();
}

/**
 * Canonical UTF-8 byte length of one archive record. Never `length`.
 *
 * `campaignCode` is stripped first: the manifest, IndexedDB and Postgres all
 * store and measure the campaignCode-less *payload*, so measuring the store's
 * `CombatLogState` here would count ~24 bytes per record that the durable side
 * never sees, and admit at a bound the cloud then applies differently. Sharing
 * `combatLogArchivePayloadFrom` and `canonicalJson` with the family module
 * makes both sides measure the same bytes of the same object.
 */
function archiveRecordBytes(archive: CombatLogState): number {
  return new TextEncoder().encode(
    canonicalJson(combatLogArchivePayloadFrom(archive))
  ).byteLength;
}

/**
 * Resolves `isRoutedCampaign` at most once per distinct campaign code. Each
 * miss is a `localStorage.getItem` plus a `JSON.parse`, and a prune pass can
 * walk up to `COMBAT_LOG_ARCHIVE_MAX_ITEMS` archives that mostly share a
 * handful of campaigns. Scoped to a single pass so authority flips are picked
 * up on the next one.
 */
function createRoutedResolver(): (campaignCode?: string) => boolean {
  const resolved = new Map<string, boolean>();
  return campaignCode => {
    if (!campaignCode) return false;
    const cached = resolved.get(campaignCode);
    if (cached !== undefined) return cached;
    const routed = isRoutedCampaign(campaignCode);
    resolved.set(campaignCode, routed);
    return routed;
  };
}

/**
 * An archive is *routed* when its campaign has handed authority to the durable
 * DM store. Only routed archives are gated, and only routed archives are exempt
 * from local pruning. Reads nothing while the client flag is off.
 */
function isRoutedCampaign(campaignCode: string | undefined): boolean {
  if (!campaignCode) return false;
  if (typeof localStorage === 'undefined') return false;
  return combatLogArchiveUsesIndexedDbAuthority(localStorage, campaignCode);
}

interface AdmissionCandidate {
  archiveId: string;
  campaignCode?: string;
  /** The would-be post-edit record. Gates never inspect the committed one. */
  nextArchive: CombatLogState;
  /** True when the edit adds a document the campaign does not already hold. */
  isNewDocument: boolean;
}

/**
 * Prospective admission control (ruling 5). Evaluates the value the caller is
 * about to commit and returns the first violated bound, or null to admit. The
 * caller must leave `encounters` untouched on rejection.
 */
function admissionRejection(
  encounters: Record<string, CombatLogState>,
  tombstones: Record<string, CombatLogTombstone>,
  candidate: AdmissionCandidate
): CombatLogAdmissionReason | null {
  const campaignCode = candidate.campaignCode;
  if (!isRoutedCampaign(campaignCode)) return null;

  const nextBytes = archiveRecordBytes(candidate.nextArchive);
  if (nextBytes > COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES) return 'record-bytes';

  const siblings = Object.entries(encounters).filter(
    ([archiveId, archive]) =>
      archive.campaignCode === campaignCode && archiveId !== candidate.archiveId
  );

  if (candidate.isNewDocument) {
    // Tombstones still occupy a document slot until the server reaps them.
    const tombstoneCount = Object.values(tombstones).filter(
      tombstone => tombstone.beforeImage.campaignCode === campaignCode
    ).length;
    if (siblings.length + tombstoneCount + 1 > COMBAT_LOG_ARCHIVE_MAX_ITEMS)
      return 'item-count';
  }

  const totalBytes = siblings.reduce(
    (sum, [, archive]) => sum + archiveRecordBytes(archive),
    nextBytes
  );
  if (totalBytes > COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES) return 'total-bytes';

  return null;
}

function admissionError(
  archiveId: string,
  reason: CombatLogAdmissionReason
): CombatLogAdmissionError {
  return { archiveId, reason, at: new Date().toISOString() };
}

export interface ArchiveWithId extends CombatLogState {
  archiveId: string;
}

interface CombatLogStoreState {
  /** Keyed by `archiveId` (ruling 6), not by encounter. */
  encounters: Record<string, CombatLogState>;
  combatLogTombstones: Record<string, CombatLogTombstone>;
  /** Device-local (ruling 9) — persisted, never synced. */
  activeArchiveId: string | null;
  /** Session state. Excluded from `partialize`. */
  lastAdmissionError: CombatLogAdmissionError | null;

  // Lifecycle
  startArchive: (encounterId: string, campaignCode?: string) => string | null;
  endArchive: (archiveId: string) => void;
  setActiveArchive: (archiveId: string | null) => void;

  // Logging
  logEvent: (
    archiveId: string,
    event: Omit<CombatLogEvent, 'id' | 'timestamp'>
  ) => void;

  // Querying
  getEvents: (archiveId: string) => CombatLogEvent[];
  getFilteredEvents: (
    archiveId: string,
    filters: CombatLogFilters
  ) => CombatLogEvent[];
  getArchivesForEncounter: (encounterId: string) => ArchiveWithId[];
  getLatestArchiveForEncounter: (encounterId: string) => ArchiveWithId | null;

  // Export
  exportArchive: (archiveId: string, format: 'json' | 'text') => string;

  // Cleanup
  pruneOldArchives: () => void;
  clearArchive: (archiveId: string) => void;
  dismissAdmissionError: () => void;
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

/** Persisted shape written by version 1: `encounters` keyed by `encounterId`. */
interface LegacyCombatLogPersistedState {
  encounters?: Record<
    string,
    { events?: CombatLogEvent[]; startedAt?: string; endedAt?: string }
  >;
  activeEncounterId?: string | null;
}

type CombatLogPersistedState = Pick<
  CombatLogStoreState,
  'encounters' | 'combatLogTombstones' | 'activeArchiveId'
>;

/**
 * v1 → v2: re-key `encounters` from `encounterId` to a freshly minted
 * `archiveId`, stamping the old key onto the record. `campaignCode` stays
 * undefined — a legacy archive has never been routed — and the device-local
 * `activeEncounterId` is mapped through the re-key map.
 */
export function migrateCombatLogPersistedState(
  persisted: unknown,
  version: number
): CombatLogPersistedState {
  if (version >= COMBAT_LOG_ARCHIVE_PERSIST_VERSION) {
    const current = (persisted ?? {}) as Partial<CombatLogPersistedState>;
    return {
      encounters: current.encounters ?? {},
      combatLogTombstones: current.combatLogTombstones ?? {},
      activeArchiveId: current.activeArchiveId ?? null,
    };
  }

  const legacy = (persisted ?? {}) as LegacyCombatLogPersistedState;
  const encounters: Record<string, CombatLogState> = {};
  const rekeyed: Record<string, string> = {};

  for (const [encounterId, archive] of Object.entries(
    legacy.encounters ?? {}
  )) {
    const archiveId = generateArchiveId();
    rekeyed[encounterId] = archiveId;
    encounters[archiveId] = {
      encounterId,
      events: archive?.events ?? [],
      startedAt: archive?.startedAt ?? new Date().toISOString(),
      ...(archive?.endedAt ? { endedAt: archive.endedAt } : {}),
    };
  }

  const legacyActive = legacy.activeEncounterId ?? null;

  return {
    encounters,
    combatLogTombstones: {},
    activeArchiveId: legacyActive ? (rekeyed[legacyActive] ?? null) : null,
  };
}

export const useCombatLogStore = create<CombatLogStoreState>()(
  persist(
    (set, get) => ({
      encounters: {},
      combatLogTombstones: {},
      activeArchiveId: null,
      lastAdmissionError: null,

      startArchive: (encounterId, campaignCode) => {
        const { encounters, combatLogTombstones } = get();
        const archiveId = generateArchiveId();
        const archive: CombatLogState = {
          encounterId,
          ...(campaignCode ? { campaignCode } : {}),
          events: [],
          startedAt: new Date().toISOString(),
        };

        const reason = admissionRejection(encounters, combatLogTombstones, {
          archiveId,
          campaignCode,
          nextArchive: archive,
          isNewDocument: true,
        });
        if (reason) {
          // Refuse without touching `encounters` — the object identity is kept.
          set({ lastAdmissionError: admissionError(archiveId, reason) });
          return null;
        }

        set(state => ({
          encounters: { ...state.encounters, [archiveId]: archive },
          activeArchiveId: archiveId,
          lastAdmissionError: null,
        }));
        get().pruneOldArchives();
        return archiveId;
      },

      endArchive: archiveId => {
        const { encounters, combatLogTombstones } = get();
        const archive = encounters[archiveId];
        if (!archive) return;

        // Stamping `endedAt` grows the record, and the record may already sit
        // exactly on a bound — the gates admit up to and including the cap. An
        // ungated close would leave a routed record the Postgres bound rejects
        // and no local edit can shrink back.
        const nextArchive: CombatLogState = {
          ...archive,
          endedAt: new Date().toISOString(),
        };
        const reason = admissionRejection(encounters, combatLogTombstones, {
          archiveId,
          campaignCode: archive.campaignCode,
          nextArchive,
          isNewDocument: false,
        });
        if (reason) {
          set({ lastAdmissionError: admissionError(archiveId, reason) });
          return;
        }

        set(state => ({
          encounters: { ...state.encounters, [archiveId]: nextArchive },
          lastAdmissionError: null,
        }));
      },

      setActiveArchive: archiveId => {
        set({ activeArchiveId: archiveId });
      },

      logEvent: (archiveId, eventData) => {
        const { encounters, combatLogTombstones } = get();
        const archive = encounters[archiveId];
        // Ruling 7: no implicit creation. An unknown archive is a silent no-op.
        if (!archive) return;

        const event: CombatLogEvent = {
          ...eventData,
          id: generateEventId(),
          timestamp: new Date().toISOString(),
        } as CombatLogEvent;
        const nextArchive: CombatLogState = {
          ...archive,
          events: [...archive.events, event],
        };

        const reason = admissionRejection(encounters, combatLogTombstones, {
          archiveId,
          campaignCode: archive.campaignCode,
          nextArchive,
          isNewDocument: false,
        });
        if (reason) {
          set({ lastAdmissionError: admissionError(archiveId, reason) });
          return;
        }

        set(state => ({
          encounters: { ...state.encounters, [archiveId]: nextArchive },
          lastAdmissionError: null,
        }));
      },

      getEvents: archiveId => {
        return get().encounters[archiveId]?.events ?? [];
      },

      getFilteredEvents: (archiveId, filters) => {
        const events = get().encounters[archiveId]?.events ?? [];
        return events.filter(e => matchesFilters(e, filters));
      },

      getArchivesForEncounter: encounterId => {
        return Object.entries(get().encounters)
          .filter(([, archive]) => archive.encounterId === encounterId)
          .map(([archiveId, archive]) => ({ archiveId, ...archive }))
          .sort(
            (a, b) =>
              new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
          );
      },

      getLatestArchiveForEncounter: encounterId => {
        const archives = get().getArchivesForEncounter(encounterId);
        return archives.length > 0 ? archives[archives.length - 1] : null;
      },

      exportArchive: (archiveId, format) => {
        const archive = get().encounters[archiveId];
        if (!archive) return '';

        if (format === 'json') {
          return JSON.stringify(archive, null, 2);
        }

        // Plain text format
        return archive.events.map(formatEventToText).join('\n');
      },

      pruneOldArchives: () => {
        set(state => {
          const entries = Object.entries(state.encounters);
          // Ruling 2: a routed archive is the cloud's to retire, never ours.
          const isRouted = createRoutedResolver();
          const routed: typeof entries = [];
          const unrouted: typeof entries = [];
          for (const entry of entries) {
            if (isRouted(entry[1].campaignCode)) routed.push(entry);
            else unrouted.push(entry);
          }
          if (unrouted.length <= MAX_ARCHIVES_STORED) return state;

          // Sort by startedAt, keep the newest
          const kept = unrouted
            .sort(
              ([, a], [, b]) =>
                new Date(b.startedAt).getTime() -
                new Date(a.startedAt).getTime()
            )
            .slice(0, MAX_ARCHIVES_STORED);
          // Tombstones are deliberately untouched — pruning is not a deletion.
          return { encounters: Object.fromEntries([...routed, ...kept]) };
        });
      },

      clearArchive: archiveId => {
        set(state => {
          const archive = state.encounters[archiveId];
          if (!archive) return state;

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [archiveId]: _removed, ...rest } = state.encounters;
          const next: Partial<CombatLogStoreState> = { encounters: rest };

          // Only a campaign-scoped archive needs a tombstone to propagate.
          if (archive.campaignCode) {
            next.combatLogTombstones = {
              ...state.combatLogTombstones,
              [archiveId]: {
                legacyId: archiveId,
                beforeImage: archive,
                deletedAt: new Date().toISOString(),
              },
            };
          }
          if (state.activeArchiveId === archiveId) next.activeArchiveId = null;
          return next;
        });
      },

      dismissAdmissionError: () => {
        set({ lastAdmissionError: null });
      },
    }),
    {
      name: COMBAT_LOG_STORAGE_KEY,
      skipHydration: isIndexedDbMigrationEnabled(),
      storage: createJSONStorage(() => createCombatLogArchiveAwareStorage()),
      version: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
      // `lastAdmissionError` is session state and is never persisted.
      partialize: state => ({
        encounters: state.encounters,
        combatLogTombstones: state.combatLogTombstones,
        activeArchiveId: state.activeArchiveId,
      }),
      migrate: migrateCombatLogPersistedState,
    }
  )
);

export default useCombatLogStore;
