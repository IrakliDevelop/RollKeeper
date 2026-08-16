import { CHARACTER_FAMILY, isCharacterFamilyKey } from './characterFamily';
import {
  runIndexedDbMigration,
  type RunIndexedDbMigrationOptions,
} from './migrationEngine';
import { openRollkeeperDatabase } from './localDatabase';
import { previewPersistedCharacterCandidates } from './characterCandidatePreview';

export type RunCharacterIndexedDbMigrationOptions = Omit<
  RunIndexedDbMigrationOptions,
  'migrationFamily' | 'includeKey'
>;

export async function runCharacterIndexedDbMigration(
  options: RunCharacterIndexedDbMigrationOptions
) {
  const result = await runIndexedDbMigration({
    ...options,
    migrationFamily: CHARACTER_FAMILY,
    includeKey: isCharacterFamilyKey,
  });
  if (result.state !== 'CUTOVER_READY') return result;
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    const preview = await previewPersistedCharacterCandidates(
      database,
      options.namespace,
      options.runId,
      options.now
    );
    if (preview.conflicts.length > 0) {
      return {
        ...result,
        state: 'SHADOWING' as const,
        error: 'Character candidate conflicts require resolution',
      };
    }
    return result;
  } finally {
    database.close();
  }
}
