import {
  buildNpcManifest,
  NPC_STORAGE_KEY,
  type NpcManifest,
} from '@/lib/durableDm/npcFamily';

import {
  runIndexedDbMigration,
  type RunIndexedDbMigrationOptions,
} from './migrationEngine';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';

export type RunNpcMigrationOptions = Omit<
  RunIndexedDbMigrationOptions,
  'migrationFamily' | 'includeKey'
> & {
  campaignId: string;
  campaignCode: string;
};

function scope(options: RunNpcMigrationOptions) {
  return `${options.namespace}:npc:${options.campaignId}`;
}

async function persistManifest(
  options: RunNpcMigrationOptions,
  manifest: NpcManifest
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
        conflictId: `npc:${options.namespace}:${options.campaignId}:${manifest.fingerprint}`,
        namespace: options.namespace,
        campaignId: options.campaignId,
        family: 'npc',
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
  options: RunNpcMigrationOptions
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

export async function runNpcIndexedDbMigration(
  options: RunNpcMigrationOptions
) {
  const rawEnvelope = options.storage.getItem(NPC_STORAGE_KEY) ?? '';
  const manifest = await buildNpcManifest({
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
      error: 'NPC candidates require explicit reconciliation',
      manifest,
    };
  }
  const result = await runIndexedDbMigration({
    ...options,
    migrationFamily: `npc:${options.campaignId}`,
    includeKey: key => key === NPC_STORAGE_KEY,
  });
  return {
    ...result,
    generation: await readPersistedGeneration(options),
    manifest,
  };
}
