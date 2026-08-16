import { describe, expect, it, vi } from 'vitest';

import { createMemoryCharacterCloudLinkRepository } from './characterCloudLinks';
import type { CharacterCloudRow } from './characterCloudCodec';
import {
  type CharacterCloudGateway,
  ManualCharacterCloudService,
} from './manualCharacterCloudService';

const account = { id: 'user-a', email: 'owner@example.com' };
const character = { id: 'legacy-a', name: 'Aria', unknown: null };

function gateway(): CharacterCloudGateway & {
  rows: Map<string, CharacterCloudRow>;
} {
  const rows = new Map<string, CharacterCloudRow>();
  return {
    rows,
    put: vi.fn(async request => {
      const current = rows.get(request.cloudId);
      const serverVersion = current ? Number(current.server_version) + 1 : 1;
      rows.set(request.cloudId, {
        id: request.cloudId,
        legacy_client_id: request.legacyId,
        name: request.name,
        payload: request.payload,
        schema_version: request.schemaVersion,
        client_revision: request.clientRevision,
        server_version: serverVersion,
        deleted_at: null,
        created_at: '2026-08-16T00:00:00.000Z',
        updated_at: '2026-08-16T00:00:00.000Z',
      });
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion,
      };
    }),
    fetch: vi.fn(async cloudId => rows.get(cloudId) ?? null),
    list: vi.fn(async () => [...rows.values()]),
    archive: vi.fn(async request => {
      const row = rows.get(request.cloudId);
      if (!row) throw new Error('missing');
      row.deleted_at = '2026-08-16T01:00:00.000Z';
      row.server_version = Number(row.server_version) + 1;
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion: Number(row.server_version),
      };
    }),
    restore: vi.fn(async request => {
      const row = rows.get(request.cloudId);
      if (!row) throw new Error('missing');
      row.deleted_at = null;
      row.server_version = Number(row.server_version) + 1;
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion: Number(row.server_version),
      };
    }),
  };
}

describe('manual character cloud service', () => {
  it('requires explicit guest selection and exact target-account confirmation', async () => {
    const service = new ManualCharacterCloudService(
      gateway(),
      createMemoryCharacterCloudLinkRepository(),
      () => 'cloud-a',
      () => 'mutation-a'
    );

    await expect(
      service.backup(character, account, {
        guestSelected: false,
        confirmedTargetAccountId: account.id,
      })
    ).rejects.toThrow('Select this guest character explicitly');
    await expect(
      service.backup(character, account, {
        guestSelected: true,
        confirmedTargetAccountId: 'user-b',
      })
    ).rejects.toThrow('Confirm the signed-in target account');
  });

  it('reuses the first upload identity and mutation after a committed response is lost', async () => {
    const cloud = gateway();
    const originalPut = vi.mocked(cloud.put).getMockImplementation();
    if (!originalPut)
      throw new Error('test gateway put implementation missing');
    vi.mocked(cloud.put)
      .mockImplementationOnce(async request => {
        await originalPut(request);
        throw new Error('response lost');
      })
      .mockImplementation(originalPut);
    const links = createMemoryCharacterCloudLinkRepository();
    const service = new ManualCharacterCloudService(
      cloud,
      links,
      () => 'cloud-a',
      () => 'mutation-a'
    );
    const confirmation = {
      guestSelected: true,
      confirmedTargetAccountId: account.id,
    };

    await expect(
      service.backup(character, account, confirmation)
    ).rejects.toThrow('response lost');
    const result = await service.backup(character, account, confirmation);

    expect(result.status).toBe('verified');
    expect(cloud.put).toHaveBeenCalledTimes(2);
    expect(vi.mocked(cloud.put).mock.calls[0][0].cloudId).toBe('cloud-a');
    expect(vi.mocked(cloud.put).mock.calls[1][0].cloudId).toBe('cloud-a');
    expect(vi.mocked(cloud.put).mock.calls[0][0].mutationId).toBe('mutation-a');
    expect(vi.mocked(cloud.put).mock.calls[1][0].mutationId).toBe('mutation-a');
    expect(links.get(account.id, character.id)?.pendingMutation).toBeNull();
  });

  it('does not report success until a refetched row decodes and matches the fingerprint', async () => {
    const cloud = gateway();
    vi.mocked(cloud.fetch).mockResolvedValue({
      id: 'cloud-a',
      legacy_client_id: 'legacy-a',
      name: 'Wrong',
      payload: { id: 'legacy-a', name: 'Different' },
      schema_version: 1,
      client_revision: 0,
      server_version: 1,
      deleted_at: null,
      created_at: '2026-08-16T00:00:00.000Z',
      updated_at: '2026-08-16T00:00:00.000Z',
    });
    const service = new ManualCharacterCloudService(
      cloud,
      createMemoryCharacterCloudLinkRepository(),
      () => 'cloud-a',
      () => 'mutation-a'
    );

    await expect(
      service.backup(character, account, {
        guestSelected: true,
        confirmedTargetAccountId: account.id,
      })
    ).rejects.toThrow('fingerprint');
  });

  it.each(['server outage', 'JWT expired'])(
    'preserves local data and pending idempotency state during %s',
    async failure => {
      const cloud = gateway();
      vi.mocked(cloud.put).mockRejectedValue(new Error(failure));
      const links = createMemoryCharacterCloudLinkRepository();
      const service = new ManualCharacterCloudService(
        cloud,
        links,
        () => 'cloud-a',
        () => 'mutation-a'
      );
      const before = structuredClone(character);

      await expect(
        service.backup(character, account, {
          guestSelected: true,
          confirmedTargetAccountId: account.id,
        })
      ).rejects.toThrow(failure);

      expect(character).toEqual(before);
      expect(links.get(account.id, character.id)?.pendingMutation).toEqual({
        mutationId: 'mutation-a',
        contentFingerprint: expect.any(String),
      });
      expect(links.get('user-b', character.id)).toBeNull();
    }
  );

  it('archives and restores only through soft-delete gateway actions', async () => {
    const cloud = gateway();
    const service = new ManualCharacterCloudService(
      cloud,
      createMemoryCharacterCloudLinkRepository(),
      () => 'cloud-a',
      () => 'mutation-a'
    );
    await service.backup(character, account, {
      guestSelected: true,
      confirmedTargetAccountId: account.id,
    });

    const archived = await service.archive('cloud-a', account, 1);
    const restored = await service.restoreCloudArchive(
      'cloud-a',
      account,
      archived.serverVersion
    );

    expect(archived.deletedAt).not.toBeNull();
    expect(restored.deletedAt).toBeNull();
    expect(cloud.archive).toHaveBeenCalledTimes(1);
    expect(cloud.restore).toHaveBeenCalledTimes(1);
  });

  it('keeps future schemas quarantined and returns raw recovery data', async () => {
    const cloud = gateway();
    cloud.rows.set('cloud-future', {
      id: 'cloud-future',
      legacy_client_id: 'legacy-future',
      name: 'Future',
      payload: { id: 'legacy-future', name: 'Future', unknown: null },
      schema_version: 99,
      client_revision: 1,
      server_version: 1,
      deleted_at: null,
      created_at: '2026-08-16T00:00:00.000Z',
      updated_at: '2026-08-16T00:00:00.000Z',
    });
    const service = new ManualCharacterCloudService(
      cloud,
      createMemoryCharacterCloudLinkRepository(),
      () => 'unused-cloud',
      () => 'unused-mutation'
    );

    const result = await service.prepareRestore(
      'cloud-future',
      account,
      [],
      'original'
    );

    expect(result.plan.kind).toBe('quarantined');
    expect(result.plan.character).toBeNull();
    expect(result.recovery.payload).toHaveProperty('unknown', null);
  });
});
