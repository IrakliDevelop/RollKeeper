import type { Json } from '@/types/database.generated';

import {
  CHARACTER_CLOUD_SCHEMA_VERSION,
  type CharacterCloudRow,
  type CharacterRestorePlan,
  type RestoreMode,
  decodeCharacterCloudRow,
  copyJsonForRecovery,
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
  planCharacterRestore,
} from './characterCloudCodec';
import type {
  CharacterCloudLink,
  CharacterCloudLinkRepository,
} from './characterCloudLinks';

export interface CharacterCloudAccount {
  id: string;
  email?: string;
}

export interface CharacterBackupConfirmation {
  guestSelected: boolean;
  confirmedTargetAccountId: string;
}

export interface PutCharacterRequest {
  mutationId: string;
  cloudId: string;
  legacyId: string;
  name: string;
  payload: Json;
  schemaVersion: number;
  clientRevision: number;
  expectedServerVersion: number;
}

export interface CharacterMutationRequest {
  mutationId: string;
  cloudId: string;
  expectedServerVersion: number;
}

export interface CharacterMutationResult {
  status: 'success' | 'conflict' | 'tombstoned';
  characterId: string;
  serverVersion: number;
}

export interface CharacterCloudGateway {
  put(request: PutCharacterRequest): Promise<CharacterMutationResult>;
  fetch(cloudId: string): Promise<CharacterCloudRow | null>;
  list(): Promise<CharacterCloudRow[]>;
  archive(request: CharacterMutationRequest): Promise<CharacterMutationResult>;
  restore(request: CharacterMutationRequest): Promise<CharacterMutationResult>;
}

export interface VerifiedCharacterBackup {
  status: 'verified';
  row: CharacterCloudRow;
  fingerprint: string;
}

export interface CharacterRecoveryDownload {
  format: 'rollkeeper-character-cloud-recovery';
  formatVersion: 1;
  downloadedAt: string;
  cloud: {
    id: string;
    legacyId: string;
    schemaVersion: number;
    serverVersion: number;
    deletedAt: string | null;
  };
  payload: Json;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function characterRevision(character: unknown): number {
  const value = asRecord(character);
  const state = asRecord(value.characterData ?? value);
  return typeof state.revision === 'number' && state.revision >= 0
    ? state.revision
    : 0;
}

function characterName(character: unknown): string {
  const value = asRecord(character);
  return typeof value.name === 'string' && value.name.trim()
    ? value.name.trim()
    : 'Unnamed Character';
}

function characterId(character: unknown): string {
  const value = asRecord(character);
  if (typeof value.id !== 'string' || !value.id) {
    throw new Error('Character ID is required for cloud backup');
  }
  return value.id;
}

export class ManualCharacterCloudService {
  constructor(
    private readonly gateway: CharacterCloudGateway,
    private readonly links: CharacterCloudLinkRepository,
    private readonly generateCloudId: () => string = () => crypto.randomUUID(),
    private readonly generateMutationId: () => string = () =>
      crypto.randomUUID()
  ) {}

  async backup(
    character: unknown,
    account: CharacterCloudAccount,
    confirmation: CharacterBackupConfirmation
  ): Promise<VerifiedCharacterBackup> {
    if (!confirmation.guestSelected) {
      throw new Error('Select this guest character explicitly before upload');
    }
    if (confirmation.confirmedTargetAccountId !== account.id) {
      throw new Error('Confirm the signed-in target account before upload');
    }

    const legacyId = characterId(character);
    const payload = encodeCharacterCloudPayload(character);
    const fingerprint = await fingerprintCharacterPayload(payload);
    let link = this.links.get(account.id, legacyId);
    if (link?.pendingMutation?.contentFingerprint !== fingerprint) {
      link = {
        accountId: account.id,
        legacyId,
        cloudId: link?.cloudId ?? this.generateCloudId(),
        serverVersion: link?.serverVersion ?? 0,
        contentFingerprint: link?.contentFingerprint ?? null,
        pendingMutation: {
          mutationId: this.generateMutationId(),
          contentFingerprint: fingerprint,
        },
      };
      this.links.save(link);
    }

    const pending = link.pendingMutation;
    if (!pending) throw new Error('Cloud backup mutation state is missing');
    const result = await this.gateway.put({
      mutationId: pending.mutationId,
      cloudId: link.cloudId,
      legacyId,
      name: characterName(character),
      payload,
      schemaVersion: CHARACTER_CLOUD_SCHEMA_VERSION,
      clientRevision: characterRevision(character),
      expectedServerVersion: link.serverVersion,
    });
    if (result.status !== 'success') {
      throw new Error(`Cloud backup was not accepted: ${result.status}`);
    }

    const row = await this.gateway.fetch(result.characterId);
    if (!row)
      throw new Error('Cloud backup verification could not refetch the row');
    const decoded = await decodeCharacterCloudRow(row);
    if (decoded.status !== 'supported') {
      throw new Error(
        decoded.quarantineReason ?? 'Cloud backup could not be decoded'
      );
    }
    if (decoded.contentFingerprint !== fingerprint) {
      throw new Error('Cloud backup fingerprint verification failed');
    }

    this.links.save({
      accountId: account.id,
      legacyId,
      cloudId: row.id,
      serverVersion: row.server_version,
      contentFingerprint: fingerprint,
      pendingMutation: null,
    });
    return { status: 'verified', row, fingerprint };
  }

  async verify(
    character: unknown,
    account: CharacterCloudAccount
  ): Promise<VerifiedCharacterBackup> {
    const legacyId = characterId(character);
    const link = this.links.get(account.id, legacyId);
    if (!link)
      throw new Error('This character has no cloud link for this account');
    const row = await this.gateway.fetch(link.cloudId);
    if (!row) throw new Error('Cloud copy was not found');
    const decoded = await decodeCharacterCloudRow(row);
    const localFingerprint = await fingerprintCharacterPayload(character);
    if (
      decoded.status !== 'supported' ||
      decoded.contentFingerprint !== localFingerprint
    ) {
      throw new Error('Cloud copy fingerprint does not match local data');
    }
    return { status: 'verified', row, fingerprint: localFingerprint };
  }

  async list(account: CharacterCloudAccount): Promise<CharacterCloudRow[]> {
    void account;
    return this.gateway.list();
  }

  async archive(
    cloudId: string,
    account: CharacterCloudAccount,
    expectedServerVersion: number
  ): Promise<{ serverVersion: number; deletedAt: string }> {
    void account;
    const result = await this.gateway.archive({
      mutationId: this.generateMutationId(),
      cloudId,
      expectedServerVersion,
    });
    if (result.status !== 'success') {
      throw new Error(`Cloud archive was not accepted: ${result.status}`);
    }
    const row = await this.gateway.fetch(result.characterId);
    if (!row?.deleted_at) throw new Error('Cloud archive verification failed');
    return { serverVersion: row.server_version, deletedAt: row.deleted_at };
  }

  async restoreCloudArchive(
    cloudId: string,
    account: CharacterCloudAccount,
    expectedServerVersion: number
  ): Promise<{ serverVersion: number; deletedAt: null }> {
    void account;
    const result = await this.gateway.restore({
      mutationId: this.generateMutationId(),
      cloudId,
      expectedServerVersion,
    });
    if (result.status !== 'success') {
      throw new Error(`Cloud restore was not accepted: ${result.status}`);
    }
    const row = await this.gateway.fetch(result.characterId);
    if (!row || row.deleted_at !== null) {
      throw new Error('Cloud restore verification failed');
    }
    return { serverVersion: row.server_version, deletedAt: null };
  }

  async prepareRestore(
    cloudId: string,
    account: CharacterCloudAccount,
    localCharacters: readonly unknown[],
    mode: RestoreMode
  ): Promise<{
    plan: CharacterRestorePlan;
    recovery: CharacterRecoveryDownload;
    link: CharacterCloudLink;
  }> {
    const row = await this.gateway.fetch(cloudId);
    if (!row) throw new Error('Cloud copy was not found');
    const decoded = await decodeCharacterCloudRow(row);
    const plan = await planCharacterRestore(decoded, localCharacters, mode);
    return {
      plan,
      recovery: this.recoveryFor(decoded.row),
      link: {
        accountId: account.id,
        legacyId: row.legacy_client_id,
        cloudId: row.id,
        serverVersion: row.server_version,
        contentFingerprint: decoded.contentFingerprint,
        pendingMutation: null,
      },
    };
  }

  recoveryFor(row: CharacterCloudRow): CharacterRecoveryDownload {
    return {
      format: 'rollkeeper-character-cloud-recovery',
      formatVersion: 1,
      downloadedAt: new Date().toISOString(),
      cloud: {
        id: row.id,
        legacyId: row.legacy_client_id,
        schemaVersion: row.schema_version,
        serverVersion: row.server_version,
        deletedAt: row.deleted_at,
      },
      payload: copyJsonForRecovery(row.payload),
    };
  }

  attachLink(link: CharacterCloudLink): void {
    this.links.save(link);
  }
}
