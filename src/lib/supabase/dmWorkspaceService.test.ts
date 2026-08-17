import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DmWorkspaceService,
  isDmWorkspaceCloudEnabled,
} from './dmWorkspaceService';

describe('DM workspace cloud feature gate', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('is default-off and requires auth configuration as well as its dedicated flag', () => {
    expect(isDmWorkspaceCloudEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED', 'true');
    expect(isDmWorkspaceCloudEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
    expect(isDmWorkspaceCloudEnabled()).toBe(true);
  });

  it('makes zero local, cloud, player, Redis, or relay calls while disabled', async () => {
    const repository = {
      commitCreate: vi.fn(),
      acknowledge: vi.fn(),
      updateWork: vi.fn(),
    };
    const gateway = { create: vi.fn() };
    const forbidden = {
      playerMigration: vi.fn(),
      membership: vi.fn(),
      durableFamily: vi.fn(),
      redis: vi.fn(),
      relay: vi.fn(),
    };
    const service = new DmWorkspaceService({
      enabled: false,
      accountId: 'account-a',
      repository,
      gateway,
    });

    await expect(
      service.create({ localId: 'local-a', name: 'Northwatch' })
    ).resolves.toEqual({ status: 'disabled' });
    expect(repository.commitCreate).not.toHaveBeenCalled();
    expect(gateway.create).not.toHaveBeenCalled();
    Object.values(forbidden).forEach(call =>
      expect(call).not.toHaveBeenCalled()
    );
  });

  it('durably queues before cloud creation and acknowledges only validated legacy authority defaults', async () => {
    const order: string[] = [];
    const repository = {
      commitCreate: vi.fn(async () => {
        order.push('local');
        return { saved: true as const, mutationId: 'mutation-a' };
      }),
      acknowledge: vi.fn(async () => {
        order.push('ack');
      }),
      updateWork: vi.fn(),
    };
    const gateway = {
      create: vi.fn(async () => {
        order.push('cloud');
        return {
          campaignId: 'campaign-a',
          displayCode: 'A1B2C3D4E5F6',
          membershipAuthority: 'legacy' as const,
          familyAuthorities: 'legacy' as const,
          liveRuntimeAuthority: 'redis_relay' as const,
        };
      }),
    };
    const service = new DmWorkspaceService({
      enabled: true,
      accountId: 'account-a',
      repository,
      gateway,
      now: () => new Date('2026-08-17T00:00:00.000Z'),
    });

    await expect(
      service.create({ localId: 'local-a', name: 'Northwatch' })
    ).resolves.toMatchObject({
      status: 'created',
      workspace: { displayCode: 'A1B2C3D4E5F6' },
    });
    expect(order).toEqual(['local', 'cloud', 'ack']);
    expect(repository.commitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'user:account-a',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
      })
    );
  });

  it('forks by sanitized fingerprint and retains queued work after a cloud failure', async () => {
    const repository = {
      commitCreate: vi.fn().mockResolvedValue({
        saved: true,
        mutationId: 'mutation-fork',
      }),
      acknowledge: vi.fn(),
      updateWork: vi.fn().mockResolvedValue(undefined),
    };
    const gateway = {
      create: vi.fn().mockRejectedValue(
        Object.assign(new Error('Network unavailable'), {
          category: 'offline',
        })
      ),
    };
    const service = new DmWorkspaceService({
      enabled: true,
      accountId: 'account-a',
      repository,
      gateway,
    });

    await expect(
      service.fork({
        localId: 'legacy-code',
        name: 'Legacy campaign',
        sourceFingerprint: 'c'.repeat(64),
      })
    ).resolves.toEqual({ status: 'queued', reason: 'offline' });
    expect(repository.commitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        creationKind: 'import_fork',
        sourceFingerprint: 'c'.repeat(64),
      })
    );
    expect(repository.updateWork).toHaveBeenCalledWith('mutation-fork', {
      state: 'offline',
      lastError: 'Network unavailable',
    });
    expect(repository.acknowledge).not.toHaveBeenCalled();
  });

  it('does not call cloud when the local transaction fails', async () => {
    const repository = {
      commitCreate: vi.fn().mockResolvedValue({
        saved: false as const,
        reason: 'failed' as const,
      }),
      acknowledge: vi.fn(),
      updateWork: vi.fn(),
    };
    const gateway = { create: vi.fn() };
    const service = new DmWorkspaceService({
      enabled: true,
      accountId: 'account-a',
      repository,
      gateway,
    });

    await expect(
      service.create({ localId: 'local-a', name: 'Northwatch' })
    ).resolves.toEqual({ status: 'local-failed' });
    expect(gateway.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      Object.assign(new Error('expired'), { category: 'auth-required' }),
      'auth-required',
    ],
    ['opaque failure', 'failed'],
  ] as const)('retains durable work for %s', async (failure, reason) => {
    const repository = {
      commitCreate: vi.fn().mockResolvedValue({
        saved: true as const,
        mutationId: 'mutation-a',
      }),
      acknowledge: vi.fn(),
      updateWork: vi.fn().mockResolvedValue(undefined),
    };
    const service = new DmWorkspaceService({
      enabled: true,
      accountId: 'account-a',
      repository,
      gateway: { create: vi.fn().mockRejectedValue(failure) },
    });

    await expect(
      service.create({ localId: 'local-a', name: 'Northwatch' })
    ).resolves.toEqual({ status: 'queued', reason });
    expect(repository.updateWork).toHaveBeenCalledWith(
      'mutation-a',
      expect.objectContaining({ state: reason })
    );
  });
});
