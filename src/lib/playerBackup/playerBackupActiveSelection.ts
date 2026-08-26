import {
  inspectCurrentCharacterSafetyCoverage,
  readCharacterActivationEvidence,
  type IndexedDbCharacterAuthority,
} from '@/lib/indexeddb/characterAuthority';
import {
  readCharacterCutoverSelection,
  rebindCharacterCutoverSelection,
  type CharacterCutoverSelection,
} from '@/lib/indexeddb/characterCutoverSelection';
import { openExistingRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { withMigrationLock } from '@/lib/indexeddb/migrationLock';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

import {
  type PlayerBackupExclusiveLockProvider,
  assertActivePlayerBackupRun,
  withPlayerBackupAccountLock,
} from './playerBackupRunFence';

export async function rebindPlayerBackupActiveSelection(options: {
  factory: IDBFactory;
  storage: Storage;
  namespace: StorageNamespace;
  accountId: string;
  expectedActiveRunId: string;
  authorizedAt: string;
  expectedAuthority: { generation: string; epoch: number };
  currentCharacterSafetyVerified: boolean;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  ownerId: string;
  nowMs: () => number;
  verifyConsentSafety?: () => Promise<void>;
  onVerifiedRebind?: (
    selection: CharacterCutoverSelection,
    authority: IndexedDbCharacterAuthority,
    database: IDBDatabase
  ) => Promise<void> | void;
}): Promise<CharacterCutoverSelection> {
  return withPlayerBackupAccountLock(
    { accountId: options.accountId, locks: options.locks },
    async () => {
      await assertActivePlayerBackupRun({
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        factory: options.factory,
      });
      await options.verifyConsentSafety?.();
      const database = await openExistingRollkeeperDatabase({
        factory: options.factory,
      });
      if (!database) throw new Error('Active character authority is missing');
      try {
        return await withMigrationLock(
          database,
          async () => {
            const coverage = await inspectCurrentCharacterSafetyCoverage({
              factory: options.factory,
              storage: options.storage,
              namespace: options.namespace,
              expectedAuthority: options.expectedAuthority,
            });
            if (
              !coverage.broadFileCoversCurrentCharacters &&
              !options.currentCharacterSafetyVerified
            ) {
              throw new Error('Current character safety coverage is missing');
            }
            const evidence = await readCharacterActivationEvidence(
              database,
              options.namespace,
              coverage.authority.generation
            );
            if (!evidence) {
              throw new Error(
                'Immutable character activation evidence is missing'
              );
            }
            rebindCharacterCutoverSelection(
              options.storage,
              options.namespace,
              {
                evidence,
                generation: coverage.authority.generation,
                epoch: coverage.authority.epoch,
                playerBackupRunId: options.expectedActiveRunId,
                playerBackupAccountId: options.accountId,
                playerBackupAuthorizedAt: options.authorizedAt,
              }
            );
            const readBack = readCharacterCutoverSelection(
              options.storage,
              options.namespace
            );
            if (
              !readBack ||
              readBack.playerBackupRunId !== options.expectedActiveRunId ||
              readBack.playerBackupAccountId !== options.accountId ||
              readBack.playerBackupAuthorizedAt !== options.authorizedAt ||
              readBack.activatedGeneration !== coverage.authority.generation ||
              readBack.activatedEpoch !== coverage.authority.epoch
            ) {
              throw new Error(
                'Character selection rebind could not be verified'
              );
            }
            await options.onVerifiedRebind?.(
              readBack,
              coverage.authority,
              database
            );
            return readBack;
          },
          {
            ownerId: options.ownerId,
            now: options.nowMs,
            locks: options.locks ?? undefined,
          }
        );
      } finally {
        database.close();
      }
    }
  );
}
