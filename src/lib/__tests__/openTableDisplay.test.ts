import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  openTableDisplay,
  OPEN_DISPLAY_MESSAGES,
} from '@/lib/openTableDisplay';

const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';

interface FakeWindow {
  opener: unknown;
  location: { replace: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
}

describe('openTableDisplay (E12)', () => {
  let fakeWin: FakeWindow;
  let openSpy: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeWin = {
      opener: window,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ capability: CAPABILITY, displayGeneration: 9 }),
          { status: 200 }
        )
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens about:blank synchronously before any await, then rotates and navigates by fragment', async () => {
    const pending = openTableDisplay({ code: 'CAMP1', dmId: 'dm-1' });
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    const result = await pending;
    expect(result).toEqual({ ok: true });
    expect(openSpy.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]!
    );
    expect(fakeWin.opener).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/campaign/CAMP1/table/display/capability');
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      headers: { 'x-rollkeeper-csrf': '1', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init.body))).toEqual({ dmId: 'dm-1' });
    expect(fakeWin.location.replace).toHaveBeenCalledWith(
      `/table-display/CAMP1#k=${CAPABILITY}`
    );
    expect(String(fakeWin.location.replace.mock.calls[0]![0])).not.toContain(
      '?'
    );
    expect(fakeWin.close).not.toHaveBeenCalled();
  });

  it('does not rotate when the popup is blocked', async () => {
    openSpy.mockReturnValue(null);
    expect(await openTableDisplay({ code: 'CAMP1', dmId: 'dm-1' })).toEqual({
      ok: false,
      reason: 'popup-blocked',
      message:
        'Popup blocked — allow popups for this site and click Open display again',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, 'not-initialized'],
    [403, 'denied'],
    [503, 'unavailable'],
    [500, 'unavailable'],
  ] as const)(
    'closes the window and never falls back on HTTP %i',
    async (status, reason) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ error: 'x' }), { status })
      );
      const result = await openTableDisplay({ code: 'CAMP1', dmId: 'dm-1' });
      expect(result).toEqual({
        ok: false,
        reason,
        message: OPEN_DISPLAY_MESSAGES[reason],
      });
      expect(fakeWin.close).toHaveBeenCalledTimes(1);
      expect(fakeWin.location.replace).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledTimes(1);
    }
  );

  it('closes the window on a network failure or a malformed answer', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await openTableDisplay({ code: 'CAMP1', dmId: 'dm-1' })).toEqual({
      ok: false,
      reason: 'network',
      message: OPEN_DISPLAY_MESSAGES.network,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ capability: 'not-valid' }), { status: 200 })
    );
    expect((await openTableDisplay({ code: 'CAMP1', dmId: 'dm-1' })).ok).toBe(
      false
    );
    expect(fakeWin.close).toHaveBeenCalledTimes(2);
    expect(fakeWin.location.replace).not.toHaveBeenCalled();
  });

  it('words 409 as not initialized', () => {
    expect(OPEN_DISPLAY_MESSAGES['not-initialized']).toBe(
      'Live table is not initialized — open a Table scene first'
    );
  });
});
