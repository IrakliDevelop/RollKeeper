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
  discover(): Promise<DmWorkspaceDocument[]>;
  remember(workspace: DmWorkspaceDocument): Promise<void>;
  create(name: string): Promise<DmWorkspaceCreateResult>;
  forkLegacy(
    campaign: CampaignInfo,
    dmId: string
  ): Promise<DmWorkspaceCreateResult>;
  close(): void;
}

/**
 * Associates an owner-discovered cloud workspace with the legacy campaign the
 * DM explicitly selected it for. Remote discovery cannot know that browser-
 * local relationship, but the migration wizard resumes by this stable id.
 */
export function associateWorkspaceWithLegacyCampaign(
  workspace: DmWorkspaceDocument,
  campaignCode: string
): DmWorkspaceDocument {
  const legacyId = `legacy:${campaignCode}`;
  return { ...workspace, localId: legacyId, legacyId };
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
  const gateway = createSupabaseDmWorkspaceGateway(
    client as unknown as SupabaseDmWorkspaceClient
  );
  const service = new DmWorkspaceService({
    enabled: true,
    accountId: data.user.id,
    repository,
    gateway,
  });

  return {
    accountId: data.user.id,
    accountLabel: data.user.email ?? 'Signed-in account',
    list() {
      return repository.list(`user:${data.user.id}`);
    },
    async discover() {
      return (await gateway.discover()).map(remote => ({
        namespace: `user:${data.user.id}` as const,
        localId: `cloud:${remote.campaignId}`,
        legacyId: `cloud:${remote.campaignId}`,
        name: remote.name,
        creationKind: remote.creationKind,
        sourceFingerprint: remote.sourceFingerprint,
        createdAt: remote.createdAt,
        family: 'workspace_identity' as const,
        cloudId: remote.campaignId,
        displayCode: remote.displayCode,
        membershipAuthority: remote.membershipAuthority,
        familyAuthorities: remote.familyAuthorities,
        liveRuntimeAuthority: remote.liveRuntimeAuthority,
        acknowledgedAt: remote.createdAt,
      }));
    },
    remember(workspace) {
      if (workspace.namespace !== `user:${data.user.id}`)
        return Promise.reject(new Error('Workspace namespace mismatch'));
      return repository.rememberDiscovered(workspace);
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
        localId: `legacy:${campaign.code}`,
        name: campaign.name,
        sourceFingerprint,
      });
    },
    close() {
      database.close();
    },
  };
}
