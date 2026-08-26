import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteRollkeeperDatabaseForTests } from '@/lib/indexeddb/localDatabase';

const { createClient, createGateway, cloudCreate, cloudDiscover } = vi.hoisted(
  () => ({
    createClient: vi.fn(),
    createGateway: vi.fn(),
    cloudCreate: vi.fn(),
    cloudDiscover: vi.fn(),
  })
);

vi.mock('./browser', () => ({
  createSupabaseBrowserClient: createClient,
}));
vi.mock('./dmWorkspaceGateway', () => ({
  createSupabaseDmWorkspaceGateway: createGateway,
}));

import {
  associateWorkspaceWithLegacyCampaign,
  createBrowserDmWorkspace,
  fingerprintLegacyCampaignSource,
} from './browserDmWorkspace';

describe('legacy campaign workspace association', () => {
  it('rekeys an owner-discovered workspace for wizard resume', () => {
    const discovered = {
      namespace: 'user:account-a',
      localId: 'cloud:cloud-a',
      legacyId: 'cloud:cloud-a',
      name: 'Northwatch',
      creationKind: 'import_fork',
      sourceFingerprint: 'source-hash',
      createdAt: '2026-08-25T00:00:00.000Z',
      family: 'workspace_identity',
      cloudId: 'cloud-a',
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy',
      familyAuthorities: 'legacy',
      liveRuntimeAuthority: 'redis_relay',
      acknowledgedAt: '2026-08-25T00:00:00.000Z',
    } as const;

    expect(associateWorkspaceWithLegacyCampaign(discovered, 'MANUAL')).toEqual({
      ...discovered,
      localId: 'legacy:MANUAL',
      legacyId: 'legacy:MANUAL',
    });
  });
});

function enabledEnvironment() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
}

describe('legacy campaign fork provenance', () => {
  beforeEach(() => {
    createClient.mockReset();
    createGateway.mockReset();
    cloudCreate.mockReset();
    cloudDiscover.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('produces a stable sanitized fingerprint without returning code or dmId', async () => {
    const first = await fingerprintLegacyCampaignSource({
      code: 'ABC123',
      dmId: 'exposed-legacy-dm-id',
    });
    const second = await fingerprintLegacyCampaignSource({
      code: 'ABC123',
      dmId: 'exposed-legacy-dm-id',
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toContain('ABC123');
    expect(first).not.toContain('exposed-legacy-dm-id');
  });

  it('does not initialize auth or IndexedDB while the flag is disabled', async () => {
    await expect(createBrowserDmWorkspace()).resolves.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns no context for a signed-out account', async () => {
    enabledEnvironment();
    createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'signed out' },
        }),
      },
    });

    await expect(createBrowserDmWorkspace()).resolves.toBeNull();
    expect(createGateway).not.toHaveBeenCalled();
  });

  it('returns no context when the enabled client configuration disappears', async () => {
    enabledEnvironment();
    createClient.mockReturnValue(null);
    await expect(createBrowserDmWorkspace()).resolves.toBeNull();
  });

  it('creates and forks only after an authenticated explicit action', async () => {
    enabledEnvironment();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('local-new')
      .mockReturnValueOnce('local-fork');
    createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'account-a', email: 'owner@example.test' } },
          error: null,
        }),
      },
    });
    cloudCreate
      .mockResolvedValueOnce({
        campaignId: 'cloud-a',
        displayCode: 'A1B2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      })
      .mockResolvedValueOnce({
        campaignId: 'cloud-b',
        displayCode: 'B1B2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      });
    createGateway.mockReturnValue({ create: cloudCreate });

    const context = await createBrowserDmWorkspace();
    expect(context).toMatchObject({
      accountId: 'account-a',
      accountLabel: 'owner@example.test',
    });
    await expect(context!.create('Northwatch')).resolves.toMatchObject({
      status: 'created',
    });
    await expect(
      context!.forkLegacy(
        {
          code: 'LEGACY',
          name: 'Old road',
          createdAt: '2026-08-17T00:00:00.000Z',
        },
        'legacy-dm'
      )
    ).resolves.toMatchObject({ status: 'created' });
    await expect(context!.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          namespace: 'user:account-a',
          cloudId: 'cloud-a',
          displayCode: 'A1B2C3D4E5F6',
        }),
        expect.objectContaining({
          namespace: 'user:account-a',
          cloudId: 'cloud-b',
          displayCode: 'B1B2C3D4E5F6',
        }),
      ])
    );
    expect(cloudCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        creationKind: 'import_fork',
        sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      })
    );
    context!.close();
  });

  it('uses a non-identifying account label when auth has no email claim', async () => {
    enabledEnvironment();
    createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'account-a' } },
          error: null,
        }),
      },
    });
    createGateway.mockReturnValue({ create: cloudCreate });
    const context = await createBrowserDmWorkspace();
    expect(context?.accountLabel).toBe('Signed-in account');
    context?.close();
  });

  it('discovers owner workspaces read-only on a new device without persisting a local authority record', async () => {
    enabledEnvironment();
    createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'account-a' } },
          error: null,
        }),
      },
    });
    cloudDiscover.mockResolvedValue([
      {
        campaignId: 'cloud-a',
        displayCode: 'A1B2C3D4E5F6',
        name: 'Northwatch',
        creationKind: 'import_fork',
        sourceFingerprint: 'a'.repeat(64),
        createdAt: 'created',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      },
    ]);
    createGateway.mockReturnValue({
      create: cloudCreate,
      discover: cloudDiscover,
    });

    const context = await createBrowserDmWorkspace();
    const [discovered] = await context!.discover();
    expect(discovered).toEqual(
      expect.objectContaining({
        namespace: 'user:account-a',
        cloudId: 'cloud-a',
        family: 'workspace_identity',
      })
    );
    await expect(context!.list()).resolves.toEqual([]);
    await context!.remember(discovered);
    await expect(context!.list()).resolves.toEqual([discovered]);
    context!.close();
  });
});
