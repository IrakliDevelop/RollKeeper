import {
  decodeCharacterCloudRow,
  fingerprintCharacterPayload,
} from '@/lib/supabase/characterCloudCodec';
import type {
  CharacterCloudRow,
  DecodedCloudCharacter,
} from '@/lib/supabase/characterCloudCodec';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { createSupabaseCharacterCloudGateway } from '@/lib/supabase/characterCloudGateway';

export interface PlayerBackupPreviewAccount {
  id: string;
  email?: string;
}

export interface PlayerBackupPreviewAuth {
  getUser(): Promise<{
    data: { user: { id: string; email?: string } | null };
    error?: { message: string } | null;
  }>;
}

export interface PlayerBackupPreviewGateway {
  list(): Promise<CharacterCloudRow[]>;
}

export type PlayerBackupCloudComparison =
  | 'missing'
  | 'identical'
  | 'newer'
  | 'different'
  | 'removed'
  | 'future'
  | 'unavailable';

export interface PlayerBackupPreviewCharacter {
  legacyId: string;
  name: string;
  state: PlayerBackupCloudComparison;
  row: CharacterCloudRow | null;
  decoded: DecodedCloudCharacter | null;
}

export interface PlayerBackupCloudPreview {
  account: PlayerBackupPreviewAccount;
  characters: PlayerBackupPreviewCharacter[];
  onlineOnly: DecodedCloudCharacter[];
}

export class PlayerBackupCloudPreviewError extends Error {
  constructor(
    readonly category: 'signed-out' | 'account-changed' | 'offline' | 'failed'
  ) {
    super(category);
    this.name = 'PlayerBackupCloudPreviewError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function localId(character: unknown): string {
  const value = asRecord(character);
  const state = asRecord(value.characterData);
  const id = typeof value.id === 'string' ? value.id : state.id;
  if (typeof id !== 'string' || !id) {
    throw new PlayerBackupCloudPreviewError('failed');
  }
  return id;
}

function localName(character: unknown): string {
  const value = asRecord(character);
  return typeof value.name === 'string' && value.name.trim()
    ? value.name
    : 'Unnamed character';
}

function localRevision(character: unknown): number {
  const value = asRecord(character);
  const state = asRecord(value.characterData);
  return typeof state.revision === 'number' ? state.revision : 0;
}

async function readAccount(
  auth: PlayerBackupPreviewAuth
): Promise<PlayerBackupPreviewAccount> {
  let result: Awaited<ReturnType<PlayerBackupPreviewAuth['getUser']>>;
  try {
    result = await auth.getUser();
  } catch {
    throw new PlayerBackupCloudPreviewError('offline');
  }
  if (result.error) throw new PlayerBackupCloudPreviewError('failed');
  if (!result.data.user) throw new PlayerBackupCloudPreviewError('signed-out');
  return {
    id: result.data.user.id,
    ...(result.data.user.email ? { email: result.data.user.email } : {}),
  };
}

export function hasRecoverableCloudRows(cloud: {
  characters: ReadonlyArray<{ row: unknown | null }>;
  onlineOnly: ReadonlyArray<{ row: unknown }>;
}): boolean {
  return (
    cloud.onlineOnly.some(entry => Boolean(entry.row)) ||
    cloud.characters.some(entry => Boolean(entry.row))
  );
}

/**
 * Decodes cloud rows, drops duplicated legacy identities, and compares each
 * local character against its cloud copy. Shared by the read-only preview and
 * by locked online execution so both classify identically.
 */
export async function compareCloudRows(
  rows: readonly CharacterCloudRow[],
  localCharacters: readonly unknown[]
): Promise<{
  characters: PlayerBackupPreviewCharacter[];
  onlineOnly: DecodedCloudCharacter[];
}> {
  const decoded = await Promise.all(
    rows.map(async row => {
      try {
        return await decodeCharacterCloudRow(row);
      } catch {
        return null;
      }
    })
  );
  const byLegacyId = new Map<string, DecodedCloudCharacter | null>();
  rows.forEach((row, index) => {
    if (byLegacyId.has(row.legacy_client_id)) {
      byLegacyId.set(row.legacy_client_id, null);
    } else {
      byLegacyId.set(row.legacy_client_id, decoded[index]);
    }
  });

  const characters = await Promise.all(
    localCharacters.map(async character => {
      const legacyId = localId(character);
      const candidate = byLegacyId.get(legacyId);
      if (candidate === undefined) {
        return {
          legacyId,
          name: localName(character),
          state: 'missing' as const,
          row: null,
          decoded: null,
        };
      }
      if (candidate === null) {
        return {
          legacyId,
          name: localName(character),
          state: 'unavailable' as const,
          row: null,
          decoded: null,
        };
      }
      let state: PlayerBackupCloudComparison;
      if (candidate.row.deleted_at !== null) state = 'removed';
      else if (candidate.status === 'quarantined') state = 'future';
      else {
        const fingerprint = await fingerprintCharacterPayload(character);
        if (fingerprint === candidate.contentFingerprint) state = 'identical';
        else if (candidate.row.client_revision > localRevision(character))
          state = 'newer';
        else state = 'different';
      }
      return {
        legacyId,
        name: localName(character),
        state,
        row: candidate.row,
        decoded: candidate,
      };
    })
  );
  const localIds = new Set(characters.map(character => character.legacyId));
  const onlineOnly = [...byLegacyId.entries()].flatMap(
    ([legacyId, candidate]) =>
      candidate !== null && !localIds.has(legacyId) ? [candidate] : []
  );
  return {
    characters,
    onlineOnly,
  };
}

export async function previewPlayerBackupCloud(options: {
  auth: PlayerBackupPreviewAuth;
  gateway: PlayerBackupPreviewGateway;
  expectedAccountId?: string;
  localCharacters: readonly unknown[];
}): Promise<PlayerBackupCloudPreview> {
  const account = await readAccount(options.auth);
  if (
    options.expectedAccountId !== undefined &&
    account.id !== options.expectedAccountId
  ) {
    throw new PlayerBackupCloudPreviewError('account-changed');
  }

  let rows: CharacterCloudRow[];
  try {
    rows = await options.gateway.list();
  } catch {
    throw new PlayerBackupCloudPreviewError('offline');
  }

  const accountAfterRead = await readAccount(options.auth);
  if (accountAfterRead.id !== account.id) {
    throw new PlayerBackupCloudPreviewError('account-changed');
  }

  const compared = await compareCloudRows(rows, options.localCharacters);
  return { account, ...compared };
}

export interface PlayerBackupCloudPreviewSnapshot {
  accountId: string | null;
  characters: PlayerBackupPreviewCharacter[];
  onlineOnly: DecodedCloudCharacter[];
  loading: boolean;
}

export class PlayerBackupCloudPreviewController {
  private token = 0;
  private state: PlayerBackupCloudPreviewSnapshot = {
    accountId: null,
    characters: [],
    onlineOnly: [],
    loading: false,
  };

  snapshot(): PlayerBackupCloudPreviewSnapshot {
    return {
      ...this.state,
      characters: [...this.state.characters],
      onlineOnly: [...this.state.onlineOnly],
    };
  }

  changeAccount(accountId: string | null): void {
    this.token += 1;
    this.state = { accountId, characters: [], onlineOnly: [], loading: false };
  }

  async load(
    accountId: string,
    loader: () => Promise<PlayerBackupCloudPreview>
  ): Promise<boolean> {
    const requestToken = ++this.token;
    this.state = { accountId, characters: [], onlineOnly: [], loading: true };
    try {
      const result = await loader();
      if (
        requestToken !== this.token ||
        this.state.accountId !== accountId ||
        result.account.id !== accountId
      ) {
        return false;
      }
      this.state = {
        accountId,
        characters: result.characters,
        onlineOnly: result.onlineOnly,
        loading: false,
      };
      return true;
    } catch (cause) {
      if (requestToken !== this.token || this.state.accountId !== accountId) {
        return false;
      }
      this.state = {
        accountId,
        characters: [],
        onlineOnly: [],
        loading: false,
      };
      throw cause;
    }
  }
}

export function createBrowserPlayerBackupCloudPreview(options: {
  manualRead: boolean;
  automaticRead: boolean;
}): {
  auth: PlayerBackupPreviewAuth;
  gateway: PlayerBackupPreviewGateway;
} | null {
  if (!options.manualRead && !options.automaticRead) return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;
  return {
    auth: client.auth as unknown as PlayerBackupPreviewAuth,
    gateway: createSupabaseCharacterCloudGateway(
      client as unknown as Parameters<
        typeof createSupabaseCharacterCloudGateway
      >[0]
    ),
  };
}
