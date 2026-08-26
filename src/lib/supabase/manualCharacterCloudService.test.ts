import { describe, expect, it, vi } from 'vitest';

import {
  createMemoryCharacterCloudLinkRepository,
  type CharacterCloudLinkRepository,
  type PendingCharacterMutation,
} from './characterCloudLinks';
import type { CharacterCloudRow } from './characterCloudCodec';
import {
  type CharacterCloudGateway,
  ManualCharacterCloudRejectedError,
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

describe('player backup run options', () => {
  const confirmation = {
    guestSelected: true,
    confirmedTargetAccountId: account.id,
  };
  const runOptions = { originPlayerBackupRunId: 'run-a' };

  function serviceFor(
    cloud: CharacterCloudGateway,
    links: CharacterCloudLinkRepository
  ): ManualCharacterCloudService {
    return new ManualCharacterCloudService(
      cloud,
      links,
      () => 'cloud-a',
      () => 'mutation-a'
    );
  }

  async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    throw new Error('expected the backup to reject');
  }

  it('stamps the origin run on the pending identity and clears it after verification', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    const originalPut = vi.mocked(cloud.put).getMockImplementation();
    if (!originalPut)
      throw new Error('test gateway put implementation missing');
    let pendingDuringPut: PendingCharacterMutation | null | undefined;
    vi.mocked(cloud.put).mockImplementation(async request => {
      pendingDuringPut = links.get(account.id, character.id)?.pendingMutation;
      return originalPut(request);
    });

    const result = await serviceFor(cloud, links).backup(
      character,
      account,
      confirmation,
      runOptions
    );

    expect(result.status).toBe('verified');
    expect(pendingDuringPut).toEqual({
      mutationId: 'mutation-a',
      contentFingerprint: expect.any(String),
      originPlayerBackupRunId: 'run-a',
    });
    expect(links.get(account.id, character.id)?.pendingMutation).toBeNull();
  });

  it('verifies an acknowledged lost response before retrying and never sends a second put', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    const service = serviceFor(cloud, links);
    vi.mocked(cloud.fetch).mockRejectedValueOnce(new Error('response lost'));

    await expect(
      service.backup(character, account, confirmation, runOptions)
    ).rejects.toThrow('response lost');
    expect(links.get(account.id, character.id)?.pendingMutation).toEqual({
      mutationId: 'mutation-a',
      contentFingerprint: expect.any(String),
      originPlayerBackupRunId: 'run-a',
    });

    const result = await service.backup(
      character,
      account,
      confirmation,
      runOptions
    );

    expect(result.status).toBe('verified');
    expect(cloud.put).toHaveBeenCalledTimes(1);
    expect(result.row.server_version).toBe(1);
    expect(links.get(account.id, character.id)).toEqual({
      accountId: account.id,
      legacyId: character.id,
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: result.fingerprint,
      pendingMutation: null,
    });
  });

  it('retries an unacknowledged lost response with the same mutation id', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    const originalPut = vi.mocked(cloud.put).getMockImplementation();
    if (!originalPut)
      throw new Error('test gateway put implementation missing');
    vi.mocked(cloud.put)
      .mockImplementationOnce(async () => {
        throw new Error('response lost');
      })
      .mockImplementation(originalPut);
    const service = serviceFor(cloud, links);

    await expect(
      service.backup(character, account, confirmation, runOptions)
    ).rejects.toThrow('response lost');
    const result = await service.backup(
      character,
      account,
      confirmation,
      runOptions
    );

    expect(result.status).toBe('verified');
    expect(cloud.put).toHaveBeenCalledTimes(2);
    const retryOrder = vi.mocked(cloud.put).mock.invocationCallOrder[1];
    const verificationFetches = vi
      .mocked(cloud.fetch)
      .mock.invocationCallOrder.filter(order => order < retryOrder);
    expect(verificationFetches).toHaveLength(1);
    expect(vi.mocked(cloud.fetch).mock.calls[0][0]).toBe('cloud-a');
    expect(vi.mocked(cloud.put).mock.calls[1][0].mutationId).toBe('mutation-a');
    expect(vi.mocked(cloud.put).mock.calls[1][0].cloudId).toBe('cloud-a');
  });

  it('continues from the refreshed link when acknowledged content has since changed', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    let mutationCount = 0;
    const service = new ManualCharacterCloudService(
      cloud,
      links,
      () => 'cloud-a',
      () => `mutation-${++mutationCount}`
    );
    vi.mocked(cloud.fetch).mockRejectedValueOnce(new Error('response lost'));

    await expect(
      service.backup(character, account, confirmation, runOptions)
    ).rejects.toThrow('response lost');
    const stale = links.get(account.id, character.id);
    expect(stale).toEqual({
      accountId: account.id,
      legacyId: character.id,
      cloudId: 'cloud-a',
      serverVersion: 0,
      contentFingerprint: null,
      pendingMutation: {
        mutationId: 'mutation-1',
        contentFingerprint: expect.any(String),
        originPlayerBackupRunId: 'run-a',
      },
    });
    const acknowledgedFingerprint = stale?.pendingMutation?.contentFingerprint;
    vi.mocked(cloud.put).mockResolvedValue({
      status: 'conflict',
      characterId: 'cloud-a',
      serverVersion: 2,
    });

    const rejection = await captureRejection(
      service.backup(
        { ...character, name: 'Aria the Bold' },
        account,
        confirmation,
        runOptions
      )
    );

    expect(rejection).toBeInstanceOf(ManualCharacterCloudRejectedError);
    expect(cloud.put).toHaveBeenCalledTimes(2);
    expect(vi.mocked(cloud.put).mock.calls[1][0].mutationId).toBe('mutation-2');
    expect(vi.mocked(cloud.put).mock.calls[1][0].expectedServerVersion).toBe(1);
    expect(links.get(account.id, character.id)).toEqual({
      accountId: account.id,
      legacyId: character.id,
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: acknowledgedFingerprint,
      pendingMutation: null,
    });
  });

  it('back-fills the origin run on a pending created without options', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    const originalPut = vi.mocked(cloud.put).getMockImplementation();
    if (!originalPut)
      throw new Error('test gateway put implementation missing');
    let pendingDuringPut: PendingCharacterMutation | null | undefined;
    vi.mocked(cloud.put)
      .mockImplementationOnce(async () => {
        throw new Error('response lost');
      })
      .mockImplementation(async request => {
        pendingDuringPut = links.get(account.id, character.id)?.pendingMutation;
        return originalPut(request);
      });
    const service = serviceFor(cloud, links);

    await expect(
      service.backup(character, account, confirmation)
    ).rejects.toThrow('response lost');
    expect(
      links.get(account.id, character.id)?.pendingMutation
    ).not.toHaveProperty('originPlayerBackupRunId');

    const result = await service.backup(
      character,
      account,
      confirmation,
      runOptions
    );

    expect(result.status).toBe('verified');
    expect(pendingDuringPut).toEqual({
      mutationId: 'mutation-a',
      contentFingerprint: expect.any(String),
      originPlayerBackupRunId: 'run-a',
    });
    expect(vi.mocked(cloud.put).mock.calls[1][0].mutationId).toBe('mutation-a');
  });

  it('refuses to reuse a cloud id that belongs to another character', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    vi.mocked(cloud.put).mockRejectedValueOnce(new Error('response lost'));
    const service = serviceFor(cloud, links);

    await expect(
      service.backup(character, account, confirmation, runOptions)
    ).rejects.toThrow('response lost');
    const seeded = links.get(account.id, character.id);
    vi.mocked(cloud.fetch).mockResolvedValue({
      id: 'cloud-a',
      legacy_client_id: 'other',
      name: 'Someone Else',
      payload: { id: 'other', name: 'Someone Else' },
      schema_version: 1,
      client_revision: 0,
      server_version: 3,
      deleted_at: null,
      created_at: '2026-08-16T00:00:00.000Z',
      updated_at: '2026-08-16T00:00:00.000Z',
    });

    await expect(
      service.backup(character, account, confirmation, runOptions)
    ).rejects.toThrow('Cloud link identity does not match this character');

    expect(cloud.put).toHaveBeenCalledTimes(1);
    expect(links.get(account.id, character.id)).toEqual(seeded);
    expect(seeded?.pendingMutation).toEqual({
      mutationId: 'mutation-a',
      contentFingerprint: expect.any(String),
      originPlayerBackupRunId: 'run-a',
    });
  });

  it('restores the prior acknowledged link on an explicit conflict and throws a typed error', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    const service = serviceFor(cloud, links);
    await service.backup(character, account, confirmation, runOptions);
    const acknowledged = links.get(account.id, character.id);
    expect(acknowledged?.serverVersion).toBe(1);
    expect(acknowledged?.contentFingerprint).toEqual(expect.any(String));
    vi.mocked(cloud.put).mockResolvedValue({
      status: 'conflict',
      characterId: 'cloud-a',
      serverVersion: 2,
    });

    const rejection = await captureRejection(
      service.backup(
        { ...character, name: 'Aria the Bold' },
        account,
        confirmation,
        runOptions
      )
    );

    expect(rejection).toBeInstanceOf(ManualCharacterCloudRejectedError);
    const rejected = rejection as ManualCharacterCloudRejectedError;
    expect(rejected.status).toBe('conflict');
    expect(rejected.name).toBe('ManualCharacterCloudRejectedError');
    expect(rejected.message).toBe('Cloud backup was not accepted: conflict');
    expect(rejected.row?.id).toBe('cloud-a');
    expect(rejected.row?.server_version).toBe(1);
    expect(links.get(account.id, character.id)).toEqual(acknowledged);
    expect(cloud.put).toHaveBeenCalledTimes(2);
  });

  it('removes a fresh rejected link entirely on conflict or tombstoned', async () => {
    for (const status of ['conflict', 'tombstoned'] as const) {
      const cloud = gateway();
      const links = createMemoryCharacterCloudLinkRepository();
      vi.mocked(cloud.put).mockResolvedValue({
        status,
        characterId: 'cloud-a',
        serverVersion: 0,
      });
      if (status === 'tombstoned') {
        vi.mocked(cloud.fetch).mockRejectedValue(new Error('offline'));
      }

      const rejection = await captureRejection(
        serviceFor(cloud, links).backup(
          character,
          account,
          confirmation,
          runOptions
        )
      );

      expect(rejection).toBeInstanceOf(ManualCharacterCloudRejectedError);
      expect((rejection as ManualCharacterCloudRejectedError).status).toBe(
        status
      );
      expect((rejection as ManualCharacterCloudRejectedError).row).toBeNull();
      expect(links.get(account.id, character.id)).toBeNull();
    }
  });

  it('keeps legacy behavior without options', async () => {
    const cloud = gateway();
    const links = createMemoryCharacterCloudLinkRepository();
    vi.mocked(cloud.put).mockResolvedValue({
      status: 'conflict',
      characterId: 'cloud-a',
      serverVersion: 0,
    });
    const service = serviceFor(cloud, links);

    const rejection = await captureRejection(
      service.backup(character, account, confirmation)
    );

    expect(rejection).not.toBeInstanceOf(ManualCharacterCloudRejectedError);
    expect((rejection as Error).message).toBe(
      'Cloud backup was not accepted: conflict'
    );
    expect(cloud.fetch).not.toHaveBeenCalled();
    const pending = links.get(account.id, character.id)?.pendingMutation;
    expect(pending).toEqual({
      mutationId: 'mutation-a',
      contentFingerprint: expect.any(String),
    });
    expect(pending).not.toHaveProperty('originPlayerBackupRunId');
  });
});
