import type { CampaignInfo } from '@/types/campaign';

import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';

import { createSupabaseBrowserClient } from './browser';
import {
  createSupabaseDmWorkspaceGateway,
  type SupabaseDmWorkspaceClient,
} from './dmWorkspaceGateway';
import {
  DmWorkspaceService,
  type DmWorkspaceCreateResult,
  isDmWorkspaceCloudEnabled,
} from './dmWorkspaceService';

export interface BrowserDmWorkspaceContext {
  accountId: string;
  accountLabel: string;
  list(): Promise<DmWorkspaceDocument[]>;
  create(name: string): Promise<DmWorkspaceCreateResult>;
  forkLegacy(
    campaign: CampaignInfo,
    dmId: string
  ): Promise<DmWorkspaceCreateResult>;
  close(): void;
}

export function fingerprintLegacyCampaignSource(source: {
  code: string;
  dmId: string;
}): Promise<string> {
  return sha256Bytes(
    JSON.stringify({
      kind: 'rollkeeper-legacy-campaign',
      code: source.code,
      dmId: source.dmId,
    })
  );
}

export async function createBrowserDmWorkspace(): Promise<BrowserDmWorkspaceContext | null> {
  if (!isDmWorkspaceCloudEnabled()) return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const database = await openRollkeeperDatabase();
  const repository = new IndexedDbDmWorkspaceRepository(database);
  const service = new DmWorkspaceService({
    enabled: true,
    accountId: data.user.id,
    repository,
    gateway: createSupabaseDmWorkspaceGateway(
      client as unknown as SupabaseDmWorkspaceClient
    ),
  });

  return {
    accountId: data.user.id,
    accountLabel: data.user.email ?? 'Signed-in account',
    list() {
      return repository.list(`user:${data.user.id}`);
    },
    create(name) {
      return service.create({ localId: crypto.randomUUID(), name });
    },
    async forkLegacy(campaign, dmId) {
      const sourceFingerprint = await fingerprintLegacyCampaignSource({
        code: campaign.code,
        dmId,
      });
      return service.fork({
        localId: crypto.randomUUID(),
        name: campaign.name,
        sourceFingerprint,
      });
    },
    close() {
      database.close();
    },
  };
}
