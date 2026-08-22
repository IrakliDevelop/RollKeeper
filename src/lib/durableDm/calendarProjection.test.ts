import { describe, expect, it, vi } from 'vitest';

import {
  asCalendarProjectionRedis,
  decideCalendarProjectionCas,
  publishCalendarProjection,
} from './calendarProjection';

const payload = {
  config: {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [{ name: 'Day' }],
    months: [{ name: 'Month', days: 30 }],
    seasons: [],
    moons: [],
    namedYears: [],
    eras: [],
    yearOffset: 0,
    yearStartWeekdayOffset: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  },
  currentTime: 1,
  startTime: 0,
  events: [
    {
      id: 'private',
      title: 'Secret',
      description: 'hidden',
      year: 1,
      month: 0,
      day: 0,
      createdAt: 1,
      visibility: 'private' as const,
    },
    {
      id: 'public',
      title: 'Festival',
      description: 'known',
      year: 1,
      month: 0,
      day: 1,
      createdAt: 2,
      visibility: 'public' as const,
    },
  ],
};

describe('calendar compatibility projection', () => {
  it('rejects stale and equal-version divergent publication', () => {
    expect(
      decideCalendarProjectionCas(null, {
        epoch: 1,
        version: 1,
        fingerprint: 'a',
      })
    ).toBe('write');
    expect(
      decideCalendarProjectionCas(
        { epoch: 2, version: 1, fingerprint: 'a' },
        { epoch: 1, version: 9, fingerprint: 'b' }
      )
    ).toBe('stale-epoch');
    expect(
      decideCalendarProjectionCas(
        { epoch: 1, version: 2, fingerprint: 'a' },
        { epoch: 1, version: 2, fingerprint: 'b' }
      )
    ).toBe('divergent');
    expect(
      decideCalendarProjectionCas(
        { epoch: 1, version: 2, fingerprint: 'a' },
        { epoch: 1, version: 3, fingerprint: 'b' }
      )
    ).toBe('write');
    expect(
      decideCalendarProjectionCas(
        { epoch: 1, version: 3, fingerprint: 'a' },
        { epoch: 1, version: 2, fingerprint: 'b' }
      )
    ).toBe('stale-version');
    expect(
      decideCalendarProjectionCas(
        { epoch: 1, version: 2, fingerprint: 'a' },
        { epoch: 1, version: 2, fingerprint: 'a' }
      )
    ).toBe('identical');
  });

  it('publishes one sanitized family-specific Redis value atomically', async () => {
    const redis = { eval: vi.fn().mockResolvedValue(['written', '']) };
    await publishCalendarProjection(redis, {
      campaignCode: 'ABC123',
      epoch: 1,
      version: 2,
      sourceFingerprint: 'a'.repeat(64),
      payload,
      tombstoned: false,
    });
    expect(redis.eval.mock.calls[0][1]).toEqual([
      'campaign:ABC123:projection:calendar:meta',
      'campaign:ABC123:shared:calendar',
    ]);
    const serialized = JSON.stringify(redis.eval.mock.calls[0]);
    expect(serialized).toContain('Festival');
    expect(serialized).not.toContain('Secret');
    expect(serialized).not.toContain('createdAt');
  });

  it('deletes only the calendar projection for a tombstone', async () => {
    const redis = { eval: vi.fn().mockResolvedValue(['written', '']) };
    await publishCalendarProjection(redis, {
      campaignCode: 'ABC123',
      epoch: 2,
      version: 3,
      sourceFingerprint: 'b'.repeat(64),
      payload: null,
      tombstoned: true,
    });
    expect(redis.eval.mock.calls[0][2][4]).toBe('1');
  });

  it('rejects invalid inputs and malformed Redis replies', async () => {
    const redis = { eval: vi.fn() };
    await expect(
      publishCalendarProjection(redis, {
        campaignCode: 'bad',
        epoch: 1,
        version: 1,
        sourceFingerprint: 'a'.repeat(64),
        payload,
        tombstoned: false,
      })
    ).rejects.toThrow(/code/i);
    await expect(
      publishCalendarProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 1,
        sourceFingerprint: 'a'.repeat(64),
        payload: null,
        tombstoned: false,
      })
    ).rejects.toThrow(/payload/i);

    redis.eval.mockResolvedValueOnce(null);
    await expect(
      publishCalendarProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 1,
        sourceFingerprint: 'a'.repeat(64),
        payload,
        tombstoned: false,
      })
    ).rejects.toThrow(/malformed/i);
    redis.eval.mockResolvedValueOnce(['mystery', '']);
    await expect(
      publishCalendarProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 1,
        sourceFingerprint: 'a'.repeat(64),
        payload,
        tombstoned: false,
      })
    ).rejects.toThrow(/unknown/i);
  });

  it('returns a trusted stored fingerprint for non-writing CAS outcomes', async () => {
    const stored = 'c'.repeat(64);
    const redis = { eval: vi.fn().mockResolvedValue(['identical', stored]) };
    await expect(
      publishCalendarProjection(redis, {
        campaignCode: 'ABC123',
        epoch: 1,
        version: 2,
        sourceFingerprint: 'a'.repeat(64),
        payload,
        tombstoned: false,
      })
    ).resolves.toMatchObject({
      status: 'identical',
      projectionFingerprint: stored,
    });
    expect(asCalendarProjectionRedis(redis as never)).toBe(redis);
  });
});
