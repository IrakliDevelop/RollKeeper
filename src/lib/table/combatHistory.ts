import { formatCombatLogEvent } from '@/utils/combatLogFormat';
import type { CombatLogEvent } from '@/types/combatLog';

import { combatArchiveId } from './combat';
import type {
  JsonObject,
  TableLogRecordV1,
  TableWorkspaceSnapshotV1,
} from './schema';

/**
 * Scene combat history (D7): local-only archives in the Table repository,
 * independent of the encounter library and legacy combat log archives.
 */
export interface TableCombatArchiveSummary {
  archiveId: string;
  runId: string;
  sceneId: string | null;
  sceneName: string | null;
  label: string | null;
  combatGeneration: number | null;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  loggingPaused: boolean;
  /** The open archive of the running combat (cannot be deleted). */
  active: boolean;
}

export interface TableCombatHistoryExportV1 {
  format: 'rollkeeper-table-combat-history';
  version: 1;
  archiveId: string;
  runId: string;
  sceneId: string | null;
  label: string | null;
  combatGeneration: number | null;
  startedAt: string;
  endedAt: string | null;
  loggingPaused: boolean;
  events: JsonObject[];
}

function isActiveArchive(
  snapshot: TableWorkspaceSnapshotV1,
  log: TableLogRecordV1
): boolean {
  const run = snapshot.encounters.find(value => value.runId === log.runId);
  return Boolean(
    run &&
      run.isActive &&
      log.endedAt === null &&
      log.archiveId === combatArchiveId(run.runId, run.combatGeneration ?? 0)
  );
}

export function listCombatArchives(
  snapshot: TableWorkspaceSnapshotV1
): TableCombatArchiveSummary[] {
  return snapshot.logs
    .map(log => {
      const run = snapshot.encounters.find(value => value.runId === log.runId);
      const sceneId = log.sceneId ?? run?.sceneId ?? null;
      const scene = sceneId
        ? snapshot.scenes.find(value => value.sceneId === sceneId)
        : undefined;
      return {
        archiveId: log.archiveId,
        runId: log.runId,
        sceneId,
        sceneName: scene?.map.name ?? null,
        label: run?.label ?? null,
        combatGeneration: log.combatGeneration ?? null,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        eventCount: log.events.length,
        loggingPaused: log.loggingPaused === true,
        active: isActiveArchive(snapshot, log),
      };
    })
    .sort((left, right) =>
      right.startedAt === left.startedAt
        ? right.archiveId.localeCompare(left.archiveId)
        : right.startedAt.localeCompare(left.startedAt)
    );
}

export function combatHistoryExport(
  snapshot: TableWorkspaceSnapshotV1,
  archiveId: string
): TableCombatHistoryExportV1 | null {
  const log = snapshot.logs.find(value => value.archiveId === archiveId);
  if (!log) return null;
  const run = snapshot.encounters.find(value => value.runId === log.runId);
  return {
    format: 'rollkeeper-table-combat-history',
    version: 1,
    archiveId: log.archiveId,
    runId: log.runId,
    sceneId: log.sceneId ?? run?.sceneId ?? null,
    label: run?.label ?? null,
    combatGeneration: log.combatGeneration ?? null,
    startedAt: log.startedAt,
    endedAt: log.endedAt,
    loggingPaused: log.loggingPaused === true,
    events: structuredClone(log.events),
  };
}

/** Plain text in the exact wording of the legacy combat log export. */
export function combatHistoryText(
  snapshot: TableWorkspaceSnapshotV1,
  archiveId: string
): string {
  const log = snapshot.logs.find(value => value.archiveId === archiveId);
  if (!log) return '';
  return log.events
    .map(event => {
      try {
        return formatCombatLogEvent(event as unknown as CombatLogEvent) ?? '';
      } catch {
        return '';
      }
    })
    .filter(line => line.length > 0)
    .join('\n');
}
