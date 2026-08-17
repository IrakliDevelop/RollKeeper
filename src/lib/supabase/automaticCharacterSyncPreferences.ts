import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

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
  futureDefault: 'on';
  enabledAt: string;
}

interface CharacterPreferenceRecord {
  key: string;
  namespace: `user:${string}`;
  legacyId: string;
  policy: 'on' | 'off';
  explicit: true;
}

function accountKey(namespace: `user:${string}`): string {
  return `automatic-character-sync:account:${namespace}`;
}

function characterKey(namespace: `user:${string}`, legacyId: string): string {
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
        meta.get(characterKey(userNamespace, character.id))
      ) as Promise<CharacterPreferenceRecord | undefined>,
      requestResult(meta.get(accountKey(userNamespace))) as Promise<
        AccountDefaultRecord | undefined
      >,
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
      key: characterKey(userNamespace, legacyId),
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
      const key = characterKey(preview.namespace, character.id);
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
      key: accountKey(preview.namespace),
      namespace: preview.namespace,
      futureDefault: 'on',
      enabledAt: preview.createdAt,
    } satisfies AccountDefaultRecord);
    await transactionComplete(transaction);
  }
}
