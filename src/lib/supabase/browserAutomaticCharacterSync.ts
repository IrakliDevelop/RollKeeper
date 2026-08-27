import { AutomaticCharacterConflictService } from '@/lib/indexeddb/automaticCharacterConflictService';
import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterDocument,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { readCharacterAuthority } from '@/lib/indexeddb/characterAuthority';
import { isBrowserCharacterCutoverParticipant } from '@/lib/indexeddb/characterCutoverSelection';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { isPlayerBackupWizardVisible } from '@/lib/playerBackup/playerBackupFlags';
import { createPlayerBackupDispatchGuard } from '@/lib/playerBackup/playerBackupOngoingExecution';

import { createSupabaseBrowserClient } from './browser';
import { AutomaticCharacterSyncCoordinator } from './automaticCharacterSyncCoordinator';
import { AutomaticCharacterSyncPreferences } from './automaticCharacterSyncPreferences';
import { AutomaticCharacterSyncPuller } from './automaticCharacterSyncPuller';
import {
  type AutomaticCharacterCloudStatus,
  AutomaticCharacterSyncService,
  hasAutomaticCharacterSyncLocalPrerequisite,
  type AutomaticSyncLocalCharacter,
} from './automaticCharacterSyncService';
import {
  AutomaticCharacterSyncWorker,
  type AutomaticCharacterSyncGateway,
} from './automaticCharacterSyncWorker';
import {
  createSupabaseCharacterCloudGateway,
  type SupabaseCharacterClient,
} from './characterCloudGateway';

export interface BrowserAutomaticCharacterSyncContext {
  accountId: string;
  accountLabel: string;
  indexedDbPrimary: boolean;
  repository: IndexedDbAutomaticCharacterSyncRepository;
  preferences: AutomaticCharacterSyncPreferences;
  service: AutomaticCharacterSyncService;
  conflicts: AutomaticCharacterConflictService;
  coordinator: AutomaticCharacterSyncCoordinator;
  statuses(
    characters: readonly AutomaticSyncLocalCharacter[]
  ): Promise<Record<string, AutomaticCharacterCloudStatus>>;
  documents(): Promise<AutomaticCharacterDocument[]>;
  close(): void;
}

export function subscribeBrowserAutomaticCharacterAccountChanges(
  listener: (accountId: string | null) => void
): () => void {
  if (
    typeof window === 'undefined' ||
    !isBrowserCharacterCutoverParticipant() ||
    !hasAutomaticCharacterSyncLocalPrerequisite(window.localStorage)
  ) {
    return () => undefined;
  }
  const client = createSupabaseBrowserClient();
  if (!client) return () => undefined;
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    listener(session?.user.id ?? null);
  });
  return () => data.subscription.unsubscribe();
}

function createWakeChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel('rollkeeper-automatic-character-sync');
  } catch {
    return null;
  }
}

function isOfflineAuthenticationError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : '';
  return /failed to fetch|network(?:error| request failed)|load failed/i.test(
    message
  );
}

export async function createBrowserAutomaticCharacterSync(): Promise<BrowserAutomaticCharacterSyncContext | null> {
  if (
    !isBrowserCharacterCutoverParticipant() ||
    !hasAutomaticCharacterSyncLocalPrerequisite(window.localStorage)
  ) {
    return null;
  }
  const client = createSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  let account = data.user;
  if (!account && error && isOfflineAuthenticationError(error)) {
    try {
      const session = await client.auth.getSession();
      account = session.data.session?.user ?? null;
    } catch {
      return null;
    }
  }
  if (!account) return null;

  const database = await openRollkeeperDatabase();
  const authority = await readCharacterAuthority(database, 'guest');
  const indexedDbPrimary = authority.authority === 'indexedDB';
  const accountId = account.id;
  const namespace = `user:${accountId}` as const;
  const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
  const preferences = new AutomaticCharacterSyncPreferences(database);
  const gateway = createSupabaseCharacterCloudGateway(
    client as unknown as SupabaseCharacterClient
  ) as AutomaticCharacterSyncGateway;
  const service = new AutomaticCharacterSyncService({
    featureEnabled: true,
    account: { id: accountId },
    repository,
    preferences,
    indexedDbPrimary,
  });
  const worker = new AutomaticCharacterSyncWorker({
    namespace,
    featureEnabled: true,
    repository,
    gateway,
    ...(isPlayerBackupWizardVisible()
      ? {
          dispatchGuard: createPlayerBackupDispatchGuard({
            factory: indexedDB,
            locks:
              typeof navigator !== 'undefined' && navigator.locks
                ? navigator.locks
                : null,
            accountId,
          }),
        }
      : {}),
  });
  const puller = new AutomaticCharacterSyncPuller({
    namespace,
    repository,
    gateway,
  });
  const conflicts = new AutomaticCharacterConflictService(database);
  const coordinator = new AutomaticCharacterSyncCoordinator({
    featureEnabled: true,
    hasParticipants: () => repository.hasParticipants(namespace),
    runOnce: () => worker.runOnce(),
    pull: async () => {
      await puller.pull();
    },
    events: window,
    broadcastChannel: createWakeChannel(),
  });

  return {
    accountId,
    accountLabel: account.email ?? 'Signed-in account',
    indexedDbPrimary,
    repository,
    preferences,
    service,
    conflicts,
    coordinator,
    documents: () => repository.listDocuments(namespace),
    async statuses(characters) {
      const [outbox, unresolved, quarantine, documents] = await Promise.all([
        repository.listOutbox(namespace),
        repository.listConflicts(namespace),
        repository.listQuarantine(namespace),
        repository.listDocuments(namespace),
      ]);
      const result: Record<string, AutomaticCharacterCloudStatus> = {};
      for (const character of characters) {
        const preference = await preferences.resolve(namespace, {
          id: character.id,
          name: character.name,
          createdAt:
            character.createdAt instanceof Date
              ? character.createdAt.toISOString()
              : character.createdAt,
        });
        if (!preference.enabled) {
          result[character.id] = 'local-only';
          continue;
        }
        if (quarantine.some(candidate => candidate.legacyId === character.id)) {
          result[character.id] = 'quarantined';
          continue;
        }
        if (
          unresolved.some(
            conflict =>
              conflict.legacyId === character.id &&
              conflict.resolutionState === 'unresolved'
          )
        ) {
          result[character.id] = 'conflict';
          continue;
        }
        const work = outbox.find(entry => entry.legacyId === character.id);
        if (work) {
          result[character.id] =
            work.state === 'inflight'
              ? 'syncing'
              : work.state === 'offline'
                ? 'offline'
                : work.state === 'auth-required'
                  ? 'auth-required'
                  : work.state === 'conflict'
                    ? 'conflict'
                    : work.state === 'retry' || work.state === 'failed'
                      ? 'failed'
                      : work.state === 'paused'
                        ? 'local-only'
                        : 'queued';
          continue;
        }
        const document = documents.find(
          candidate => candidate.legacyId === character.id
        );
        result[character.id] =
          document && document.baseServerVersion > 0 ? 'synced' : 'local-only';
      }
      return result;
    },
    close() {
      coordinator.stop();
      database.close();
    },
  };
}
