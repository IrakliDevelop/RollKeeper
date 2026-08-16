import { describe, expect, it, vi } from 'vitest';

import { createSupabaseCharacterCloudGateway } from './characterCloudGateway';

function rpcClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
    from: vi.fn(),
  };
}

describe('Supabase character cloud gateway', () => {
  it('sends first uploads through the idempotent RPC', async () => {
    const client = rpcClient({
      data: {
        status: 'success',
        characterId: 'cloud-a',
        serverVersion: 1,
      },
      error: null,
    });
    const gateway = createSupabaseCharacterCloudGateway(client);

    await expect(
      gateway.put({
        mutationId: 'mutation-a',
        cloudId: 'cloud-a',
        legacyId: 'legacy-a',
        name: 'Aria',
        payload: { id: 'legacy-a', unknown: null },
        schemaVersion: 1,
        clientRevision: 4,
        expectedServerVersion: 0,
      })
    ).resolves.toEqual({
      status: 'success',
      characterId: 'cloud-a',
      serverVersion: 1,
    });
    expect(client.rpc).toHaveBeenCalledWith('put_character', {
      p_mutation_id: 'mutation-a',
      p_character_id: 'cloud-a',
      p_legacy_client_id: 'legacy-a',
      p_name: 'Aria',
      p_payload: { id: 'legacy-a', unknown: null },
      p_schema_version: 1,
      p_client_revision: 4,
      p_expected_server_version: 0,
    });
  });

  it.each([
    ['archive', 'soft_delete_character'],
    ['restore', 'restore_character'],
  ] as const)('uses %s RPC without a physical delete', async (action, rpc) => {
    const client = rpcClient({
      data: {
        status: 'success',
        characterId: 'cloud-a',
        serverVersion: 2,
      },
      error: null,
    });
    const gateway = createSupabaseCharacterCloudGateway(client);

    await gateway[action]({
      mutationId: 'mutation-a',
      cloudId: 'cloud-a',
      expectedServerVersion: 1,
    });

    expect(client.rpc).toHaveBeenCalledWith(rpc, {
      p_mutation_id: 'mutation-a',
      p_character_id: 'cloud-a',
      p_expected_server_version: 1,
    });
    expect(client.from).not.toHaveBeenCalledWith('delete');
  });

  it('classifies expired authentication without swallowing the payload-free error', async () => {
    const client = rpcClient({
      data: null,
      error: { code: 'PGRST301', message: 'JWT expired' },
    });
    const gateway = createSupabaseCharacterCloudGateway(client);

    await expect(
      gateway.archive({
        mutationId: 'mutation-a',
        cloudId: 'cloud-a',
        expectedServerVersion: 1,
      })
    ).rejects.toMatchObject({ category: 'auth-required' });
  });
});
