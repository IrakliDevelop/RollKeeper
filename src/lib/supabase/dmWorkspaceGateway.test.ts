import { describe, expect, it, vi } from 'vitest';

import { createSupabaseDmWorkspaceGateway } from './dmWorkspaceGateway';

function client(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(result) };
}

describe('Supabase DM workspace gateway', () => {
  it('discovers only validated owner workspaces without changing authority', async () => {
    const rpc = vi.fn();
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockResolvedValue(
        table === 'campaigns'
          ? {
              data: [
                {
                  id: 'campaign-a',
                  display_code: 'A1B2C3D4E5F6',
                  name: 'Northwatch',
                  membership_authority: 'legacy',
                  created_at: 'created',
                },
              ],
              error: null,
            }
          : {
              data: [
                {
                  campaign_id: 'campaign-a',
                  claim_kind: 'import_fork',
                  source_fingerprint: 'a'.repeat(64),
                },
              ],
              error: null,
            }
      ),
    }));
    const gateway = createSupabaseDmWorkspaceGateway({ rpc, from });

    await expect(gateway.discover()).resolves.toEqual([
      {
        campaignId: 'campaign-a',
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
    expect(rpc).not.toHaveBeenCalled();
  });

  it('creates a new workspace through the idempotent authenticated RPC', async () => {
    const supabase = client({
      data: {
        campaignId: 'campaign-a',
        displayCode: 'A1B2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      },
      error: null,
    });
    const gateway = createSupabaseDmWorkspaceGateway(supabase);

    await expect(
      gateway.create({
        mutationId: 'mutation-a',
        name: 'Northwatch',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
      })
    ).resolves.toMatchObject({ displayCode: 'A1B2C3D4E5F6' });
    expect(supabase.rpc).toHaveBeenCalledWith('create_campaign_workspace', {
      p_mutation_id: 'mutation-a',
      p_name: 'Northwatch',
      p_creation_kind: 'new_workspace',
      p_source_fingerprint: null,
    });
  });

  it('rejects responses that attempt an authority cutover', async () => {
    const gateway = createSupabaseDmWorkspaceGateway(
      client({
        data: {
          campaignId: 'campaign-a',
          displayCode: 'A1B2C3D4E5F6',
          membershipAuthority: 'postgres',
          familyAuthorities: 'legacy',
          liveRuntimeAuthority: 'redis_relay',
        },
        error: null,
      })
    );

    await expect(
      gateway.create({
        mutationId: 'mutation-a',
        name: 'Northwatch',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
      })
    ).rejects.toThrow(/invalid authority response/u);
  });

  it('rejects a missing or malformed response and surfaces a safe server failure', async () => {
    const invalid = createSupabaseDmWorkspaceGateway(
      client({ data: null, error: null })
    );
    await expect(
      invalid.create({
        mutationId: 'mutation-a',
        name: 'Northwatch',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
      })
    ).rejects.toThrow(/invalid response/u);

    const failed = createSupabaseDmWorkspaceGateway(
      client({ data: null, error: { code: 'XX000', message: 'denied' } })
    );
    await expect(
      failed.create({
        mutationId: 'mutation-a',
        name: 'Northwatch',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
      })
    ).rejects.toMatchObject({ category: 'failed', message: 'denied' });
  });

  it.each([
    [{ code: 'PGRST301', message: 'JWT expired' }, 'auth-required'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'offline'],
  ] as const)('classifies safe cloud failures', async (error, category) => {
    const gateway = createSupabaseDmWorkspaceGateway(
      client({ data: null, error })
    );

    await expect(
      gateway.create({
        mutationId: 'mutation-a',
        name: 'Northwatch',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
      })
    ).rejects.toMatchObject({ category });
  });
});
