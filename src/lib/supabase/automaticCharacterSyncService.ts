import type { Json } from '@/types/database.generated';

import type { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { characterCutoverSelectionKey } from '@/lib/indexeddb/characterCutoverSelection';

import {
  type AccountEnablePreview,
  type AutomaticCharacterSyncPreferences,
  type EligibleCharacter,
} from './automaticCharacterSyncPreferences';
import {
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
} from './characterCloudCodec';

export interface AutomaticSyncAccount {
  id: string;
}

export type AutomaticCharacterCloudStatus =
  | 'local-only'
  | 'queued'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'auth-required'
  | 'conflict'
  | 'failed'
  | 'quarantined';

export interface AutomaticSyncLocalCharacter {
  id: string;
  name: string;
  createdAt: string | Date;
  characterData?: { revision?: number };
}

interface AutomaticCharacterSyncServiceOptions {
  featureEnabled: boolean;
  account: AutomaticSyncAccount;
  repository: IndexedDbAutomaticCharacterSyncRepository;
  preferences: AutomaticCharacterSyncPreferences;
  indexedDbPrimary: boolean;
  generateCloudId?: () => string;
  fingerprint?: (payload: Json) => Promise<string>;
  now?: () => string;
}

function createdAt(character: AutomaticSyncLocalCharacter): string {
  return character.createdAt instanceof Date
    ? character.createdAt.toISOString()
    : character.createdAt;
}

function eligible(character: AutomaticSyncLocalCharacter): EligibleCharacter {
  return {
    id: character.id,
    name: character.name,
    createdAt: createdAt(character),
  };
}

function revision(character: AutomaticSyncLocalCharacter): number {
  const value = character.characterData?.revision;
  return typeof value === 'number' && value >= 0 ? value : 0;
}

export function isAutomaticCharacterSyncEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED === 'true'
  );
}

export function hasAutomaticCharacterSyncLocalPrerequisite(
  storage: Pick<Storage, 'getItem'>
): boolean {
  const raw = storage.getItem(characterCutoverSelectionKey('guest'));
  if (!raw) return false;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return (
      value.version === 1 &&
      value.namespace === 'guest' &&
      value.family === 'character' &&
      typeof value.activatedEpoch === 'number' &&
      typeof value.activatedGeneration === 'string'
    );
  } catch {
    return false;
  }
}

export class AutomaticCharacterSyncService {
  private readonly namespace: `user:${string}`;
  private readonly generateCloudId: () => string;
  private readonly fingerprint: (payload: Json) => Promise<string>;
  private readonly now: () => string;
  private workerPaused = false;

  constructor(private readonly options: AutomaticCharacterSyncServiceOptions) {
    this.namespace = `user:${options.account.id}`;
    this.generateCloudId =
      options.generateCloudId ?? (() => crypto.randomUUID());
    this.fingerprint =
      options.fingerprint ?? (payload => fingerprintCharacterPayload(payload));
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async enableCharacter(
    character: AutomaticSyncLocalCharacter,
    confirmation: { confirmed: boolean; targetAccountId: string }
  ): Promise<void> {
    this.assertReady();
    if (
      !confirmation.confirmed ||
      confirmation.targetAccountId !== this.options.account.id
    ) {
      throw new Error(
        'Confirm the signed-in target account before enabling sync'
      );
    }
    await this.options.preferences.setCharacter(
      this.namespace,
      character.id,
      true
    );
    await this.options.repository.resumeAggregate(this.namespace, character.id);
    const current = await this.options.repository.getDocument(
      this.namespace,
      character.id
    );
    const payload = encodeCharacterCloudPayload(character);
    const result = await this.options.repository.commit({
      namespace: this.namespace,
      legacyId: character.id,
      cloudId: current?.cloudId ?? this.generateCloudId(),
      operation: current ? 'replace' : 'create',
      payload,
      schemaVersion: 1,
      localRevision: revision(character),
      baseServerVersion: current?.baseServerVersion ?? 0,
      contentFingerprint: await this.fingerprint(payload),
      syncPolicy: 'on',
      updatedAt: this.now(),
    });
    if (!result.saved) {
      throw new Error('Local character and sync work could not be saved');
    }
  }

  async disableCharacter(legacyId: string): Promise<void> {
    this.assertFeature();
    await this.options.preferences.setCharacter(
      this.namespace,
      legacyId,
      false
    );
    await this.options.repository.pauseAggregate(this.namespace, legacyId);
  }

  async recordEdit(
    character: AutomaticSyncLocalCharacter
  ): Promise<'queued' | 'local-only'> {
    if (!this.options.featureEnabled || !this.options.indexedDbPrimary) {
      return 'local-only';
    }
    const resolved = await this.options.preferences.resolve(
      this.namespace,
      eligible(character)
    );
    if (!resolved.enabled) return 'local-only';
    const current = await this.options.repository.getDocument(
      this.namespace,
      character.id
    );
    if (!current && resolved.source !== 'future-default') return 'local-only';
    const payload = encodeCharacterCloudPayload(character);
    const result = await this.options.repository.commit({
      namespace: this.namespace,
      legacyId: character.id,
      cloudId: current?.cloudId ?? this.generateCloudId(),
      operation: current ? 'replace' : 'create',
      payload,
      schemaVersion: current?.schemaVersion ?? 1,
      localRevision: revision(character),
      baseServerVersion: current?.baseServerVersion ?? 0,
      contentFingerprint: await this.fingerprint(payload),
      syncPolicy: current?.syncPolicy ?? 'inherit',
      updatedAt: this.now(),
    });
    if (!result.saved) {
      throw new Error('Local automatic-sync transaction failed');
    }
    return 'queued';
  }

  async recordDelete(
    character: AutomaticSyncLocalCharacter
  ): Promise<'queued' | 'local-only'> {
    if (!this.options.featureEnabled || !this.options.indexedDbPrimary) {
      return 'local-only';
    }
    const resolved = await this.options.preferences.resolve(
      this.namespace,
      eligible(character)
    );
    if (!resolved.enabled) return 'local-only';
    const current = await this.options.repository.getDocument(
      this.namespace,
      character.id
    );
    if (!current) return 'local-only';
    const result = await this.options.repository.commit({
      namespace: this.namespace,
      legacyId: character.id,
      cloudId: current.cloudId,
      operation: 'delete',
      payload: null,
      schemaVersion: current.schemaVersion,
      localRevision: Math.max(
        current.localRevision + 1,
        revision(character) + 1
      ),
      baseServerVersion: current.baseServerVersion,
      contentFingerprint: `tombstone:${current.contentFingerprint}`,
      syncPolicy: current.syncPolicy,
      updatedAt: this.now(),
    });
    if (!result.saved) {
      throw new Error('Local tombstone and automatic-sync work were not saved');
    }
    return 'queued';
  }

  previewAccountEnable(
    characters: readonly AutomaticSyncLocalCharacter[]
  ): Promise<AccountEnablePreview> {
    this.assertReady();
    return this.options.preferences.previewAccountEnable(
      this.namespace,
      characters.map(eligible)
    );
  }

  async confirmAccountEnable(
    preview: AccountEnablePreview,
    characters: readonly AutomaticSyncLocalCharacter[],
    confirmed: boolean
  ): Promise<void> {
    this.assertReady();
    const byId = new Map(
      characters.map(character => [character.id, character])
    );
    for (const item of preview.eligible) {
      if (!byId.has(item.id)) {
        throw new Error('Account-wide eligibility changed after preview');
      }
    }
    await this.options.preferences.confirmAccountEnable({
      ...preview,
      confirmed,
    });
    for (const item of preview.eligible) {
      const character = byId.get(item.id)!;
      const resolved = await this.options.preferences.resolve(
        this.namespace,
        item
      );
      if (!resolved.enabled) continue;
      await this.enableCharacter(character, {
        confirmed: true,
        targetAccountId: this.options.account.id,
      });
    }
  }

  async pauseWorker(): Promise<void> {
    this.workerPaused = true;
  }

  isWorkerPaused(): boolean {
    return this.workerPaused;
  }

  private assertFeature(): void {
    if (!this.options.featureEnabled) {
      throw new Error('Automatic character sync is disabled');
    }
  }

  private assertReady(): void {
    this.assertFeature();
    if (!this.options.indexedDbPrimary) {
      throw new Error('Automatic sync requires the explicit IndexedDB cutover');
    }
  }
}
