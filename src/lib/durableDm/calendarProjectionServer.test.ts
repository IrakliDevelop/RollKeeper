import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  guestEnabled: vi.fn(() => true),
  workerEnabled: vi.fn(() => true),
  createClient: vi.fn(() => ({ rpc: vi.fn() })),
  callRpc: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/guestSessionSecurity', () => ({
  isHybridGuestServerEnabled: mocks.guestEnabled,
}));
vi.mock('./slice11bFlags', () => ({
  isCalendarWorkerEnabled: mocks.workerEnabled,
}));
vi.mock('@/lib/redis', () => ({
  getRawRedis: () => ({ eval: vi.fn() }),
}));
vi.mock('./calendarProjection', () => ({
  asCalendarProjectionRedis: (value: unknown) => value,
  publishCalendarProjection: mocks.publish,
}));
vi.mock('@/lib/supabase/calendarServer', () => ({
  createCalendarApplicationClient: mocks.createClient,
  callCalendarRpc: mocks.callRpc,
}));

import {
  calendarProjectionDispatcherEnabled,
  drainCalendarProjectionQueue,
  validCalendarProjectionDispatcherSecret,
} from './calendarProjectionServer';

const event = (overrides: Record<string, unknown> = {}) => ({
  event_id: '10000000-0000-4000-8000-000000000001',
  campaign_code: 'ABC123',
  cutover_epoch: 1,
  server_version: 2,
  source_fingerprint: 'a'.repeat(64),
  payload: {
    config: {
      clock: {},
      weekDays: [],
      months: [],
      seasons: [],
      moons: [],
      namedYears: [],
      eras: [],
      yearOffset: 0,
      yearStartWeekdayOffset: 0,
      mechanics: {},
    },
    currentTime: 0,
    startTime: 0,
    events: [],
  },
  tombstoned: false,
  ...overrides,
});

describe('calendar projection worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guestEnabled.mockReturnValue(true);
    mocks.workerEnabled.mockReturnValue(true);
    mocks.createClient.mockReturnValue({ rpc: vi.fn() });
  });

  it('requires an exact constant-time dispatcher bearer secret', () => {
    vi.stubEnv('CALENDAR_PROJECTION_DISPATCH_SECRET', 's'.repeat(32));
    expect(validCalendarProjectionDispatcherSecret(null)).toBe(false);
    expect(validCalendarProjectionDispatcherSecret('Bearer short')).toBe(false);
    expect(
      validCalendarProjectionDispatcherSecret(`Bearer ${'s'.repeat(32)}`)
    ).toBe(true);
    vi.unstubAllEnvs();
  });

  it('does no claim or Redis work unless both server gates are on', async () => {
    mocks.workerEnabled.mockReturnValue(false);
    expect(calendarProjectionDispatcherEnabled()).toBe(false);
    await expect(drainCalendarProjectionQueue()).resolves.toEqual({
      status: 'disabled',
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('reports unavailable clients and rejects malformed worker claims', async () => {
    mocks.createClient.mockReturnValueOnce(null as never);
    await expect(drainCalendarProjectionQueue()).resolves.toEqual({
      status: 'unavailable',
    });
    mocks.callRpc.mockResolvedValueOnce({ invalid: true });
    await expect(drainCalendarProjectionQueue(99)).rejects.toThrow(/claim/i);
    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.anything(),
      'claim_calendar_projection_events',
      expect.objectContaining({ p_limit: 25 })
    );
  });

  it('acknowledges an atomic publication and ignores malformed rows', async () => {
    mocks.callRpc.mockResolvedValueOnce([null, event()]);
    mocks.publish.mockResolvedValueOnce({
      status: 'written',
      projectionFingerprint: 'b'.repeat(64),
    });
    await expect(drainCalendarProjectionQueue(0)).resolves.toEqual({
      status: 'drained',
      claimed: 2,
      acknowledged: 1,
      failed: 0,
    });
    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.anything(),
      'ack_campaign_document_projection_event',
      expect.objectContaining({
        p_event_id: '10000000-0000-4000-8000-000000000001',
      })
    );
  });

  it('records Redis failures without acknowledging or exposing the payload', async () => {
    mocks.callRpc.mockResolvedValueOnce([event()]);
    mocks.publish.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(drainCalendarProjectionQueue()).resolves.toEqual({
      status: 'drained',
      claimed: 1,
      acknowledged: 0,
      failed: 1,
    });
    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.anything(),
      'fail_calendar_projection_event',
      expect.objectContaining({
        p_error_code: 'publication-failed',
        p_incident_kind: null,
      })
    );
    expect(mocks.callRpc).not.toHaveBeenCalledWith(
      expect.anything(),
      'ack_campaign_document_projection_event',
      expect.anything()
    );
  });

  it.each([
    ['divergent', 'equal_version_divergence'],
    ['stale-epoch', 'stale_epoch'],
    ['poison', 'poison_event'],
  ])(
    'quarantines %s CAS outcomes as %s incidents',
    async (status, incident) => {
      mocks.callRpc.mockResolvedValueOnce([event()]);
      mocks.publish.mockResolvedValueOnce({
        status,
        projectionFingerprint: 'b'.repeat(64),
      });
      await expect(drainCalendarProjectionQueue()).resolves.toMatchObject({
        failed: 1,
        acknowledged: 0,
      });
      expect(mocks.callRpc).toHaveBeenCalledWith(
        expect.anything(),
        'fail_calendar_projection_event',
        expect.objectContaining({
          p_error_code: status,
          p_incident_kind: incident,
        })
      );
    }
  );
});
