import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type {
  CharacterCloudAccount,
  ManualCharacterCloudService,
  VerifiedCharacterBackup,
} from '@/lib/supabase/manualCharacterCloudService';
import type { CharacterCloudLink } from '@/lib/supabase/characterCloudLinks';
import type { RestoreMode } from '@/lib/supabase/characterCloudCodec';

import {
  onlineCheckpoint,
  withExistingDatabase,
} from './playerBackupOnlineExecution';
import {
  type PlayerBackupExclusiveLockProvider,
  mutatePlayerBackupWithFence,
  runPlayerBackupTransaction,
} from './playerBackupRunFence';
import {
  readPlayerBackupRunInTransaction,
  updatePlayerBackupCharacterCheckpoint,
} from './playerBackupRunRepository';

export interface PlayerBackupManagementService {
  backup: ManualCharacterCloudService['backup'];
  archive: ManualCharacterCloudService['archive'];
  prepareRestore: ManualCharacterCloudService['prepareRestore'];
}

export interface PlayerBackupManagementBase {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
}

function account(accountId: string): CharacterCloudAccount {
  return { id: accountId };
}

function namespaceFor(accountId: string): `user:${string}` {
  return `user:${accountId}`;
}

export async function backupPlayerBackupCharacterNow(
  options: PlayerBackupManagementBase & {
    character: unknown;
    service: Pick<PlayerBackupManagementService, 'backup'>;
    now?: () => string;
  }
): Promise<VerifiedCharacterBackup> {
  return mutatePlayerBackupWithFence({
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    locks: options.locks,
    factory: options.factory,
    mutateAndAcknowledge: async () => {
      const verified = await options.service.backup(
        options.character,
        account(options.accountId),
        {
          guestSelected: true,
          confirmedTargetAccountId: options.accountId,
        },
        { originPlayerBackupRunId: options.expectedActiveRunId }
      );
      const recordedAt = (options.now ?? (() => new Date().toISOString()))();
      await withExistingDatabase(options.factory, database =>
        runPlayerBackupTransaction({
          database,
          accountId: options.accountId,
          expectedActiveRunId: options.expectedActiveRunId,
          stores: [],
          task: async transaction => {
            const meta = transaction.objectStore('meta');
            const run = await readPlayerBackupRunInTransaction(
              meta,
              options.accountId,
              options.expectedActiveRunId
            );
            const previous =
              run.characterCheckpoints[verified.row.legacy_client_id]?.online;
            await updatePlayerBackupCharacterCheckpoint(meta, {
              accountId: options.accountId,
              expectedActiveRunId: options.expectedActiveRunId,
              legacyId: verified.row.legacy_client_id,
              online: onlineCheckpoint({
                state: 'protected',
                cloudId: verified.row.id,
                mutationId: previous?.mutationId ?? null,
                recordedAt,
                verified: {
                  serverVersion: verified.row.server_version,
                  contentFingerprint: verified.fingerprint,
                  verifiedAt: recordedAt,
                },
              }),
            });
          },
        })
      );
      return verified;
    },
  });
}

export async function pausePlayerBackupCharacter(
  options: PlayerBackupManagementBase & {
    legacyId: string;
    service?: Pick<PlayerBackupManagementService, 'archive'>;
  }
): Promise<void> {
  void options.service;
  await mutatePlayerBackupWithFence({
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    locks: options.locks,
    factory: options.factory,
    mutateAndAcknowledge: () =>
      withExistingDatabase(options.factory, async database => {
        const preferences = new AutomaticCharacterSyncPreferences(database);
        const repository = new IndexedDbAutomaticCharacterSyncRepository(
          database
        );
        const namespace = namespaceFor(options.accountId);
        await preferences.setCharacter(namespace, options.legacyId, false);
        await repository.pauseAggregate(namespace, options.legacyId);
      }),
  });
}

export async function resumePlayerBackupCharacter(
  options: PlayerBackupManagementBase & {
    legacyId: string;
    wake?: () => Promise<void> | void;
  }
): Promise<void> {
  await mutatePlayerBackupWithFence({
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    locks: options.locks,
    factory: options.factory,
    mutateAndAcknowledge: () =>
      withExistingDatabase(options.factory, async database => {
        const preferences = new AutomaticCharacterSyncPreferences(database);
        const repository = new IndexedDbAutomaticCharacterSyncRepository(
          database
        );
        const namespace = namespaceFor(options.accountId);
        await preferences.setCharacter(namespace, options.legacyId, true);
        await repository.resumeAggregate(namespace, options.legacyId);
      }),
  });
  await options.wake?.();
}

export async function setPlayerBackupFutureDefault(
  options: PlayerBackupManagementBase & {
    futureDefault: 'on' | 'off';
    at: string;
  }
): Promise<void> {
  await mutatePlayerBackupWithFence({
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    locks: options.locks,
    factory: options.factory,
    mutateAndAcknowledge: () =>
      withExistingDatabase(options.factory, async database => {
        const preferences = new AutomaticCharacterSyncPreferences(database);
        await preferences.setFutureDefault(
          namespaceFor(options.accountId),
          options.futureDefault,
          options.at
        );
      }),
  });
}

export async function archivePlayerBackupOnlineCopy(
  options: PlayerBackupManagementBase & {
    cloudId: string;
    expectedServerVersion: number;
    service: Pick<PlayerBackupManagementService, 'archive'>;
  }
): Promise<{ serverVersion: number; deletedAt: string }> {
  return mutatePlayerBackupWithFence({
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    locks: options.locks,
    factory: options.factory,
    mutateAndAcknowledge: async () => {
      const archived = await options.service.archive(
        options.cloudId,
        account(options.accountId),
        options.expectedServerVersion
      );
      await withExistingDatabase(options.factory, async database => {
        const repository = new IndexedDbAutomaticCharacterSyncRepository(
          database
        );
        const document = (
          await repository.listDocuments(namespaceFor(options.accountId))
        ).find(candidate => candidate.cloudId === options.cloudId);
        if (!document) return;
        await repository.adoptCloudCandidate(document, {
          payload: document.payload,
          schemaVersion: document.schemaVersion,
          localRevision: document.localRevision,
          serverVersion: archived.serverVersion,
          contentFingerprint: document.contentFingerprint,
          deletedAt: archived.deletedAt,
          updatedAt: archived.deletedAt,
        });
      });
      return archived;
    },
  });
}

export async function restorePlayerBackupCharacter(
  options: PlayerBackupManagementBase & {
    cloudId: string;
    localCharacters: readonly unknown[];
    mode: RestoreMode;
    service: Pick<PlayerBackupManagementService, 'prepareRestore'>;
    assertCurrent: () => void;
    has: (legacyId: string) => boolean;
    add: (character: unknown) => boolean;
    replace: (character: unknown) => boolean;
    persistRoster: () => Promise<{ saved: boolean }>;
    attachLink: (link: CharacterCloudLink) => void;
  }
): Promise<Awaited<ReturnType<ManualCharacterCloudService['prepareRestore']>>> {
  return mutatePlayerBackupWithFence({
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    locks: options.locks,
    factory: options.factory,
    mutateAndAcknowledge: async () => {
      options.assertCurrent();
      const prepared = await options.service.prepareRestore(
        options.cloudId,
        account(options.accountId),
        options.localCharacters,
        options.mode
      );
      options.assertCurrent();
      const { plan, link } = prepared;
      if (plan.kind === 'quarantined') {
        throw new Error(plan.reason ?? 'Cloud restore is not supported');
      }
      if (plan.character) {
        const accepted =
          plan.kind === 'restore-copy' || !options.has(plan.character.id)
            ? options.add(plan.character)
            : options.replace(plan.character);
        if (!accepted) {
          throw new Error('Roster write was not accepted');
        }
        const persisted = await options.persistRoster();
        if (!persisted.saved) {
          throw new Error('Restored character was not saved in this browser');
        }
      }
      if (plan.attachCloudLink) {
        options.assertCurrent();
        options.attachLink(link);
      }
      return prepared;
    },
  });
}
