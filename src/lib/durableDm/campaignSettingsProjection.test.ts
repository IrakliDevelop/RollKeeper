import { describe, expect, it, vi } from 'vitest';

import {
  CampaignSettingsProjectionWorker,
  asProjectionRedis,
  decideCampaignSettingsProjectionCas,
  publishCampaignSettingsProjection,
} from './campaignSettingsProjection';

describe('campaign_settings compatibility projection', () => {
  it('adapts only the Redis eval capability used by the atomic projector', () => {
    const redis = { eval: vi.fn() };
    expect(asProjectionRedis(redis as never)).toBe(redis);
  });
  it('accepts only a newer version in the same epoch or a new epoch', () => {
    expect(
      decideCampaignSettingsProjectionCas(null, {
        epoch: 1,
        version: 1,
        fingerprint: 'a',
      })
    ).toBe('write');
    expect(
      decideCampaignSettingsProjectionCas(
        { epoch: 1, version: 2, fingerprint: 'b' },
        { epoch: 1, version: 1, fingerprint: 'a' }
      )
    ).toBe('stale-version');
    expect(
      decideCampaignSettingsProjectionCas(
        { epoch: 2, version: 1, fingerprint: 'b' },
        { epoch: 1, version: 99, fingerprint: 'a' }
      )
    ).toBe('stale-epoch');
    expect(
      decideCampaignSettingsProjectionCas(
        { epoch: 1, version: 2, fingerprint: 'b' },
        { epoch: 1, version: 2, fingerprint: 'b' }
      )
    ).toBe('identical');
    expect(
      decideCampaignSettingsProjectionCas(
        { epoch: 1, version: 2, fingerprint: 'b' },
        { epoch: 1, version: 2, fingerprint: 'different' }
      )
    ).toBe('divergent');
    expect(
      decideCampaignSettingsProjectionCas(
        { epoch: 1, version: 9, fingerprint: 'b' },
        { epoch: 2, version: 1, fingerprint: 'a' }
      )
    ).toBe('write');
  });

  it('publishes only the allowlisted codec through one atomic Redis CAS', async () => {
    const redis = { eval: vi.fn().mockResolvedValue(['written']) };
    await expect(
      publishCampaignSettingsProjection(redis, {
        campaignCode: 'MANUAL',
        epoch: 2,
        version: 4,
        sourceFingerprint: 'a'.repeat(64),
        payload: {
          stackableInspiration: true,
          customCounterLabel: 'Momentum',
          playerCounters: { p1: 2 },
          bannerUrl: 'private',
          dmDashboardUi: { playersSectionOpen: false },
        },
        tombstoned: false,
      })
    ).resolves.toMatchObject({
      status: 'written',
      projectionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    const serialized = JSON.stringify(redis.eval.mock.calls[0]);
    expect(redis.eval.mock.calls[0][1][0]).toBe(
      'campaign:MANUAL:projection:campaign_settings:meta'
    );
    expect(serialized).not.toContain('private');
    expect(serialized).not.toContain('dmDashboardUi');
  });

  it('isolates poison and divergent events while acknowledging later work', async () => {
    const queue = {
      claim: vi.fn().mockResolvedValue([
        {
          eventId: 'poison',
          campaignCode: 'A',
          epoch: 1,
          version: 1,
          sourceFingerprint: 'a'.repeat(64),
          payload: 'bad',
          tombstoned: false,
        },
        {
          eventId: 'divergent',
          campaignCode: 'B',
          epoch: 1,
          version: 1,
          sourceFingerprint: 'b'.repeat(64),
          payload: { stackableInspiration: true },
          tombstoned: false,
        },
        {
          eventId: 'good',
          campaignCode: 'C',
          epoch: 1,
          version: 1,
          sourceFingerprint: 'c'.repeat(64),
          payload: { stackableInspiration: false },
          tombstoned: false,
        },
      ]),
      acknowledge: vi.fn(),
      fail: vi.fn(),
    };
    const publish = vi
      .fn()
      .mockResolvedValueOnce({ status: 'divergent' })
      .mockResolvedValueOnce({
        status: 'written',
        projectionFingerprint: 'd'.repeat(64),
      });
    const worker = new CampaignSettingsProjectionWorker({
      queue,
      publish,
      workerId: 'worker',
    });
    await expect(worker.drain(10)).resolves.toEqual({
      claimed: 3,
      acknowledged: 1,
      failed: 2,
    });
    expect(queue.fail).toHaveBeenCalledWith(
      'poison',
      'worker',
      'invalid-payload',
      'poison_event'
    );
    expect(queue.fail).toHaveBeenCalledWith(
      'divergent',
      'worker',
      'equal-version-divergence',
      'equal_version_divergence'
    );
    expect(queue.acknowledge).toHaveBeenCalledWith(
      'good',
      'worker',
      'd'.repeat(64)
    );
  });

  it('rejects malformed inputs and handles tombstones and idempotent Redis replies', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue(['identical', 'e'.repeat(64)]),
    };
    await expect(
      publishCampaignSettingsProjection(redis, {
        campaignCode: 'bad',
        epoch: 1,
        version: 1,
        sourceFingerprint: 'a'.repeat(64),
        payload: {},
        tombstoned: false,
      })
    ).rejects.toThrow(/code/i);
    await expect(
      publishCampaignSettingsProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 1,
        sourceFingerprint: 'a'.repeat(64),
        payload: null,
        tombstoned: false,
      })
    ).rejects.toThrow(/payload/i);
    await expect(
      publishCampaignSettingsProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 2,
        sourceFingerprint: 'a'.repeat(64),
        payload: null,
        tombstoned: true,
      })
    ).resolves.toEqual({
      status: 'identical',
      projectionFingerprint: 'e'.repeat(64),
    });
    expect(redis.eval.mock.calls[0][2][5]).toBe('1');
    redis.eval.mockResolvedValueOnce('bad');
    await expect(
      publishCampaignSettingsProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 3,
        sourceFingerprint: 'a'.repeat(64),
        payload: {},
        tombstoned: false,
      })
    ).rejects.toThrow(/malformed/i);
    redis.eval.mockResolvedValueOnce(['unknown']);
    await expect(
      publishCampaignSettingsProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 3,
        sourceFingerprint: 'a'.repeat(64),
        payload: {},
        tombstoned: false,
      })
    ).rejects.toThrow(/unknown/i);
  });

  it('classifies stale epochs, poisoned Redis, and publication failures without starving later events', async () => {
    const queue = {
      claim: vi.fn().mockResolvedValue([
        {
          eventId: 'stale',
          campaignCode: 'ABC123',
          epoch: 1,
          version: 1,
          sourceFingerprint: 'a'.repeat(64),
          payload: {},
          tombstoned: false,
        },
        {
          eventId: 'redis-poison',
          campaignCode: 'ABC123',
          epoch: 1,
          version: 2,
          sourceFingerprint: 'b'.repeat(64),
          payload: {},
          tombstoned: false,
        },
        {
          eventId: 'outage',
          campaignCode: 'ABC123',
          epoch: 1,
          version: 3,
          sourceFingerprint: 'c'.repeat(64),
          payload: {},
          tombstoned: false,
        },
      ]),
      acknowledge: vi.fn(),
      fail: vi.fn(),
    };
    const publish = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'stale-epoch',
        projectionFingerprint: 'a'.repeat(64),
      })
      .mockResolvedValueOnce({
        status: 'poison',
        projectionFingerprint: 'b'.repeat(64),
      })
      .mockRejectedValueOnce(new Error('isolated Redis outage'));
    const worker = new CampaignSettingsProjectionWorker({
      queue,
      publish,
      workerId: 'worker',
    });
    await expect(worker.drain(3)).resolves.toEqual({
      claimed: 3,
      acknowledged: 0,
      failed: 3,
    });
    expect(queue.fail).toHaveBeenNthCalledWith(
      1,
      'stale',
      'worker',
      'stale-epoch',
      'stale_epoch'
    );
    expect(queue.fail).toHaveBeenNthCalledWith(
      2,
      'redis-poison',
      'worker',
      'poison-redis-state',
      'poison_event'
    );
    expect(queue.fail).toHaveBeenNthCalledWith(
      3,
      'outage',
      'worker',
      'publication-failed',
      null
    );
  });
});
