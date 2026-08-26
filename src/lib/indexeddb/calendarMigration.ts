import { buildCalendarManifest } from '@/lib/durableDm/calendarFamily';

import {
  runIndexedDbMigration,
  type RunIndexedDbMigrationOptions,
} from './migrationEngine';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';

export type RunCalendarMigrationOptions = Omit<
  RunIndexedDbMigrationOptions,
  'migrationFamily' | 'includeKey'
> & {
  campaignId: string;
  campaignCode: string;
};

function scope(options: RunCalendarMigrationOptions) {
  return `${options.namespace}:calendar:${options.campaignId}`;
}

async function persistManifest(
  options: RunCalendarMigrationOptions,
  manifest: Awaited<ReturnType<typeof buildCalendarManifest>>
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
        conflictId: `calendar:${options.namespace}:${options.campaignId}:${manifest.fingerprint}`,
        namespace: options.namespace,
        campaignId: options.campaignId,
        family: 'calendar',
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
  options: RunCalendarMigrationOptions
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

export async function runCalendarIndexedDbMigration(
  options: RunCalendarMigrationOptions
) {
  const rawEnvelope = options.storage.getItem('rollkeeper-calendar-data') ?? '';
  const manifest = await buildCalendarManifest({
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
      error: 'Calendar candidates require explicit reconciliation',
      manifest,
    };
  }
  const result = await runIndexedDbMigration({
    ...options,
    migrationFamily: `calendar:${options.campaignId}`,
    includeKey: key => key === 'rollkeeper-calendar-data',
  });
  return {
    ...result,
    generation: await readPersistedGeneration(options),
    manifest,
  };
}
