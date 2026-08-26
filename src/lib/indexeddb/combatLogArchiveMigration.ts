import {
  buildCombatLogArchiveManifest,
  type CombatLogArchiveManifest,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';

import {
  runIndexedDbMigration,
  type RunIndexedDbMigrationOptions,
} from './migrationEngine';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';

export type RunCombatLogArchiveMigrationOptions = Omit<
  RunIndexedDbMigrationOptions,
  'migrationFamily' | 'includeKey'
> & {
  campaignId: string;
  campaignCode: string;
};

function scope(options: RunCombatLogArchiveMigrationOptions) {
  return `${options.namespace}:combat_log_archive:${options.campaignId}`;
}

async function persistManifest(
  options: RunCombatLogArchiveMigrationOptions,
  manifest: CombatLogArchiveManifest
) {
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    const stores =
      manifest.blockers.length > 0 ? ['meta', 'conflicts'] : ['meta'];
    const transaction = database.transaction(stores, 'readwrite');
    transaction.objectStore('meta').put({
      key: `family-manifest:${scope(options)}`,
      value: structuredClone(manifest),
    });
    if (manifest.blockers.length > 0) {
      transaction.objectStore('conflicts').put({
        conflictId: `combat_log_archive:${options.namespace}:${options.campaignId}:${manifest.fingerprint}`,
        namespace: options.namespace,
        campaignId: options.campaignId,
        family: 'combat_log_archive',
        legacyId: options.campaignCode,
        kind: 'candidate-blocker',
        blockers: structuredClone(manifest.blockers),
        rawValue: manifest.rawCandidates[0].rawValue,
        rawFingerprint: manifest.rawCandidates[0].fingerprint,
        resolutionState: 'unresolved',
        detectedAt: options.now(),
      });
      transaction.objectStore('meta').put({
        key: `migration-state:${scope(options)}`,
        state: 'BLOCKED',
        runId: options.runId,
        checkpointAt: options.now(),
      });
    }
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function readPersistedGeneration(
  options: RunCombatLogArchiveMigrationOptions
): Promise<string> {
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    const transaction = database.transaction('meta', 'readonly');
    const state = (await requestResult(
      transaction.objectStore('meta').get(`migration-state:${scope(options)}`)
    )) as { runId?: string } | undefined;
    await transactionComplete(transaction);
    return state?.runId ?? options.runId;
  } finally {
    database.close();
  }
}

export async function runCombatLogArchiveIndexedDbMigration(
  options: RunCombatLogArchiveMigrationOptions
) {
  const rawEnvelope = options.storage.getItem(COMBAT_LOG_STORAGE_KEY) ?? '';
  const manifest = await buildCombatLogArchiveManifest({
    campaignCode: options.campaignCode,
    rawEnvelope,
  });
  await persistManifest(options, manifest);
  if (manifest.blockers.length > 0) {
    return {
      state: 'BLOCKED' as const,
      authority: 'localStorage' as const,
      quarantineCount: manifest.blockers.length,
      requestedBytes: 0,
      error: 'Combat log archives require explicit reconciliation',
      manifest,
    };
  }
  const result = await runIndexedDbMigration({
    ...options,
    migrationFamily: `combat_log_archive:${options.campaignId}`,
    includeKey: key => key === COMBAT_LOG_STORAGE_KEY,
  });
  return {
    ...result,
    generation: await readPersistedGeneration(options),
    manifest,
  };
}
