import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';
import {
  type ActiveRunPointer,
  type PlayerBackupRunV1,
  PlayerBackupRunReplacedError,
  assertValidPlayerBackupRun,
  playerBackupActiveRunKey,
  playerBackupRunKey,
} from '@/lib/playerBackup/playerBackupRunRepository';

export interface EligibleCharacter {
  id: string;
  name: string;
  createdAt: string;
}

export interface AccountEnablePreview {
  previewId: string;
  namespace: `user:${string}`;
  eligible: EligibleCharacter[];
  createdAt: string;
}

export interface ResolvedAutomaticSyncPreference {
  enabled: boolean;
  source:
    | 'existing-default-off'
    | 'character-on'
    | 'character-off'
    | 'future-default';
}

interface PreferenceOptions {
  now?: () => string;
  randomId?: () => string;
}

interface AccountDefaultRecord {
  key: string;
  namespace: `user:${string}`;
  futureDefault: 'on' | 'off';
  enabledAt: string;
  confirmedAt?: string;
}

interface CharacterPreferenceRecord {
  key: string;
  namespace: `user:${string}`;
  legacyId: string;
  policy: 'on' | 'off';
  explicit: true;
}

export function automaticCharacterSyncAccountKey(
  namespace: `user:${string}`
): string {
  return `automatic-character-sync:account:${namespace}`;
}

export function automaticCharacterSyncCharacterKey(
  namespace: `user:${string}`,
  legacyId: string
): string {
  return `automatic-character-sync:character:${namespace}:${legacyId}`;
}

function accountNamespace(namespace: StorageNamespace): `user:${string}` {
  if (namespace === 'guest') {
    throw new Error('Guest characters cannot participate in automatic sync');
  }
  return namespace;
}

export class AutomaticCharacterSyncPreferences {
  private readonly now: () => string;
  private readonly randomId: () => string;

  constructor(
    private readonly database: IDBDatabase,
    options: PreferenceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  async resolve(
    namespace: StorageNamespace,
    character: EligibleCharacter
  ): Promise<ResolvedAutomaticSyncPreference> {
    const userNamespace = accountNamespace(namespace);
    const transaction = this.database.transaction('meta', 'readonly');
    const meta = transaction.objectStore('meta');
    const [characterPreference, accountDefault] = await Promise.all([
      requestResult(
        meta.get(
          automaticCharacterSyncCharacterKey(userNamespace, character.id)
        )
      ) as Promise<CharacterPreferenceRecord | undefined>,
      requestResult(
        meta.get(automaticCharacterSyncAccountKey(userNamespace))
      ) as Promise<AccountDefaultRecord | undefined>,
    ]);
    await transactionComplete(transaction);
    if (characterPreference?.policy === 'on') {
      return { enabled: true, source: 'character-on' };
    }
    if (characterPreference?.policy === 'off') {
      return { enabled: false, source: 'character-off' };
    }
    if (
      accountDefault?.futureDefault === 'on' &&
      character.createdAt > accountDefault.enabledAt
    ) {
      return { enabled: true, source: 'future-default' };
    }
    return { enabled: false, source: 'existing-default-off' };
  }

  async setCharacter(
    namespace: StorageNamespace,
    legacyId: string,
    enabled: boolean
  ): Promise<void> {
    const userNamespace = accountNamespace(namespace);
    const transaction = this.database.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({
      key: automaticCharacterSyncCharacterKey(userNamespace, legacyId),
      namespace: userNamespace,
      legacyId,
      policy: enabled ? 'on' : 'off',
      explicit: true,
    } satisfies CharacterPreferenceRecord);
    await transactionComplete(transaction);
  }

  async previewAccountEnable(
    namespace: StorageNamespace,
    eligible: readonly EligibleCharacter[]
  ): Promise<AccountEnablePreview> {
    return {
      previewId: this.randomId(),
      namespace: accountNamespace(namespace),
      eligible: eligible.map(character => structuredClone(character)),
      createdAt: this.now(),
    };
  }

  async confirmAccountEnable(
    preview: AccountEnablePreview & { confirmed: boolean }
  ): Promise<void> {
    if (!preview.confirmed) {
      throw new Error('Account-wide automatic sync requires confirmation');
    }
    const transaction = this.database.transaction('meta', 'readwrite');
    const meta = transaction.objectStore('meta');
    for (const character of preview.eligible) {
      const key = automaticCharacterSyncCharacterKey(
        preview.namespace,
        character.id
      );
      const existing = (await requestResult(meta.get(key))) as
        | CharacterPreferenceRecord
        | undefined;
      if (existing?.policy === 'off') continue;
      meta.put({
        key,
        namespace: preview.namespace,
        legacyId: character.id,
        policy: 'on',
        explicit: true,
      } satisfies CharacterPreferenceRecord);
    }
    meta.put({
      key: automaticCharacterSyncAccountKey(preview.namespace),
      namespace: preview.namespace,
      futureDefault: 'on',
      enabledAt: preview.createdAt,
    } satisfies AccountDefaultRecord);
    await transactionComplete(transaction);
  }

  async applyConfirmedSelection(options: {
    expectedActiveRunId: string | null;
    run: PlayerBackupRunV1;
    confirmed: boolean;
    testHooks?: { abortTransaction?: boolean };
  }): Promise<void> {
    if (!options.confirmed) {
      throw new Error('Player backup selection requires confirmation');
    }
    assertValidPlayerBackupRun(options.run);
    if (options.run.stage !== 'confirmed') {
      throw new Error('Player backup consent must start at confirmed');
    }

    const transaction = this.database.transaction('meta', 'readwrite');
    const completion = transactionComplete(transaction);
    const meta = transaction.objectStore('meta');
    const pointerKey = playerBackupActiveRunKey(options.run.accountId);
    const current = (await requestResult(meta.get(pointerKey))) as
      | ActiveRunPointer
      | undefined;
    const observedRunId =
      current?.accountId === options.run.accountId ? current.runId : null;
    if (observedRunId !== options.expectedActiveRunId) {
      transaction.abort();
      await completion.catch(() => undefined);
      throw new PlayerBackupRunReplacedError();
    }

    meta.put({
      ...structuredClone(options.run),
      key: playerBackupRunKey(options.run.runId),
    });
    meta.put({
      key: pointerKey,
      runId: options.run.runId,
      accountId: options.run.accountId,
    } satisfies ActiveRunPointer);
    const selectedPolicy = options.run.mode === 'ongoing' ? 'on' : 'off';
    for (const legacyId of options.run.selectedCharacterIds) {
      meta.put({
        key: automaticCharacterSyncCharacterKey(
          options.run.namespace,
          legacyId
        ),
        namespace: options.run.namespace,
        legacyId,
        policy: selectedPolicy,
        explicit: true,
      } satisfies CharacterPreferenceRecord);
    }
    for (const legacyId of options.run.clearedCharacterIds) {
      meta.put({
        key: automaticCharacterSyncCharacterKey(
          options.run.namespace,
          legacyId
        ),
        namespace: options.run.namespace,
        legacyId,
        policy: 'off',
        explicit: true,
      } satisfies CharacterPreferenceRecord);
    }
    meta.put({
      key: automaticCharacterSyncAccountKey(options.run.namespace),
      namespace: options.run.namespace,
      futureDefault: options.run.futureDefault,
      enabledAt: options.run.confirmedAt,
      confirmedAt: options.run.confirmedAt,
    } satisfies AccountDefaultRecord);

    if (options.testHooks?.abortTransaction) {
      transaction.abort();
      await completion.catch(() => {
        throw new Error('Atomic consent transaction aborted');
      });
      return;
    }
    await completion;
  }

  static async readCharacterPolicyInTransaction(
    meta: IDBObjectStore,
    namespace: `user:${string}`,
    legacyId: string
  ): Promise<'on' | 'off' | null> {
    const record = (await requestResult(
      meta.get(automaticCharacterSyncCharacterKey(namespace, legacyId))
    )) as CharacterPreferenceRecord | undefined;
    return record?.policy ?? null;
  }

  static async readAccountDefaultInTransaction(
    meta: IDBObjectStore,
    namespace: `user:${string}`
  ): Promise<{
    futureDefault: 'on' | 'off';
    enabledAt: string;
    confirmedAt: string | null;
  } | null> {
    const record = (await requestResult(
      meta.get(automaticCharacterSyncAccountKey(namespace))
    )) as AccountDefaultRecord | undefined;
    if (!record) return null;
    return {
      futureDefault: record.futureDefault,
      enabledAt: record.enabledAt,
      confirmedAt: record.confirmedAt ?? null,
    };
  }

  async setFutureDefault(
    namespace: StorageNamespace,
    futureDefault: 'on' | 'off',
    at: string
  ): Promise<void> {
    const userNamespace = accountNamespace(namespace);
    const transaction = this.database.transaction('meta', 'readwrite');
    const meta = transaction.objectStore('meta');
    const key = automaticCharacterSyncAccountKey(userNamespace);
    const existing = (await requestResult(meta.get(key))) as
      | AccountDefaultRecord
      | undefined;
    const record: AccountDefaultRecord = {
      key,
      namespace: userNamespace,
      futureDefault,
      enabledAt: futureDefault === 'on' ? at : (existing?.enabledAt ?? at),
    };
    if (existing?.confirmedAt !== undefined) {
      record.confirmedAt = existing.confirmedAt;
    }
    meta.put(record);
    await transactionComplete(transaction);
  }

  async readConfirmedSelection(
    namespace: StorageNamespace,
    eligibleCharacterIds: readonly string[]
  ): Promise<{
    characterPolicies: Record<string, 'on' | 'off'>;
    futureDefault: 'on' | 'off' | null;
    confirmedAt: string | null;
  }> {
    const userNamespace = accountNamespace(namespace);
    const transaction = this.database.transaction('meta', 'readonly');
    const meta = transaction.objectStore('meta');
    const records = await Promise.all(
      eligibleCharacterIds.map(
        legacyId =>
          requestResult(
            meta.get(
              automaticCharacterSyncCharacterKey(userNamespace, legacyId)
            )
          ) as Promise<CharacterPreferenceRecord | undefined>
      )
    );
    const account = (await requestResult(
      meta.get(automaticCharacterSyncAccountKey(userNamespace))
    )) as AccountDefaultRecord | undefined;
    await transactionComplete(transaction);
    const characterPolicies: Record<string, 'on' | 'off'> = {};
    records.forEach(record => {
      if (record?.policy === 'on' || record?.policy === 'off') {
        characterPolicies[record.legacyId] = record.policy;
      }
    });
    return {
      characterPolicies,
      futureDefault: account?.futureDefault ?? null,
      confirmedAt: account?.confirmedAt ?? null,
    };
  }
}
