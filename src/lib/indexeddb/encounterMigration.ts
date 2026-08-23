import {
  buildEncounterManifest,
  type EncounterManifest,
} from '@/lib/durableDm/encounterFamily';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

import {
  runIndexedDbMigration,
  type RunIndexedDbMigrationOptions,
} from './migrationEngine';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';

export type RunEncounterMigrationOptions = Omit<
  RunIndexedDbMigrationOptions,
  'migrationFamily' | 'includeKey'
> & {
  campaignId: string;
  campaignCode: string;
};

function scope(options: RunEncounterMigrationOptions) {
  return `${options.namespace}:encounter_definition:${options.campaignId}`;
}

async function persistManifest(
  options: RunEncounterMigrationOptions,
  manifest: EncounterManifest
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
        conflictId: `encounter_definition:${options.namespace}:${options.campaignId}:${manifest.fingerprint}`,
        namespace: options.namespace,
        campaignId: options.campaignId,
        family: 'encounter_definition',
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
  options: RunEncounterMigrationOptions
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

export async function runEncounterIndexedDbMigration(
  options: RunEncounterMigrationOptions
) {
  const rawEnvelope = options.storage.getItem(ENCOUNTER_STORAGE_KEY) ?? '';
  const manifest = await buildEncounterManifest({
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
      error: 'Encounter candidates require explicit reconciliation',
      manifest,
    };
  }
  const result = await runIndexedDbMigration({
    ...options,
    migrationFamily: `encounter_definition:${options.campaignId}`,
    includeKey: key => key === ENCOUNTER_STORAGE_KEY,
  });
  return {
    ...result,
    generation: await readPersistedGeneration(options),
    manifest,
  };
}
