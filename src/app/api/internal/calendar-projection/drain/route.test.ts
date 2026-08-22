import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  valid: vi.fn(),
  drain: vi.fn(),
}));

vi.mock('@/lib/durableDm/calendarProjectionServer', () => ({
  validCalendarProjectionDispatcherSecret: mocks.valid,
  drainCalendarProjectionQueue: mocks.drain,
}));

import { POST } from './route';

describe('calendar projection dispatcher route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is indistinguishably hidden without the exact worker secret', async () => {
    mocks.valid.mockReturnValue(false);
    const response = await POST(
      new Request(
        'http://rollkeeper.test/api/internal/calendar-projection/drain',
        {
          method: 'POST',
        }
      ) as never
    );
    expect(response.status).toBe(404);
    expect(mocks.drain).not.toHaveBeenCalled();
  });

  it('drains bounded work with no-store response headers', async () => {
    mocks.valid.mockReturnValue(true);
    mocks.drain.mockResolvedValue({
      status: 'drained',
      claimed: 1,
      acknowledged: 1,
      failed: 0,
    });
    const response = await POST(
      new Request(
        'http://rollkeeper.test/api/internal/calendar-projection/drain',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${'s'.repeat(32)}` },
        }
      ) as never
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.drain).toHaveBeenCalledWith(25);
  });

  it('remains hidden when the worker is not fully enabled', async () => {
    mocks.valid.mockReturnValue(true);
    mocks.drain.mockResolvedValue({ status: 'disabled' });
    const response = await POST(
      new Request(
        'http://rollkeeper.test/api/internal/calendar-projection/drain',
        {
          method: 'POST',
        }
      ) as never
    );
    expect(response.status).toBe(404);
  });
});
