import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openTvDisplay } from '@/lib/openTvDisplay';

describe('openTvDisplay', () => {
  let fakeWin: {
    location: { href: string; replace: ReturnType<typeof vi.fn> };
    opener: unknown;
    close: ReturnType<typeof vi.fn>;
  };
  let openSpy: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  const savedFlag = process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
    fakeWin = {
      location: { href: '', replace: vi.fn() },
      opener: window,
      close: vi.fn(),
    };
    openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);
    fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ displayKey: 'KEY123' }))
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedFlag === undefined)
      delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
    else process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = savedFlag;
  });

  it('opens the tab synchronously, then navigates it to the keyed display URL', async () => {
    await openTvDisplay('CAMP1', 'map-1', 'dm-1');
    // opened BEFORE the fetch resolved (synchronous blank tab)
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaign/CAMP1/display-key',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fakeWin.location.href).toBe(
      '/dm/campaign/CAMP1/battlemaps/map-1/display?dk=KEY123'
    );
  });

  it('sends the legacy key request with the CSRF header and a JSON body (PR05 E3)', async () => {
    await openTvDisplay('CAMP1', 'map-1', 'dm-1');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-rollkeeper-csrf': '1',
    });
    expect(JSON.parse(String(init.body))).toEqual({ dmId: 'dm-1' });
  });

  it('omits ?dk when the key fetch fails, still navigating', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('relay down');
    });
    await openTvDisplay('CAMP1', 'map-1', 'dm-1');
    expect(fakeWin.location.href).toBe(
      '/dm/campaign/CAMP1/battlemaps/map-1/display'
    );
  });

  it('falls back to window.open(url) when the popup was blocked', async () => {
    openSpy.mockImplementation((url: string) => (url === '' ? null : fakeWin));
    await openTvDisplay('CAMP1', 'map-1', 'dm-1');
    expect(openSpy).toHaveBeenLastCalledWith(
      '/dm/campaign/CAMP1/battlemaps/map-1/display?dk=KEY123',
      '_blank'
    );
  });

  it('under Table v1 opens the campaign display instead of the map-pinned key (PR05 E12)', async () => {
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          capability: 'Cap5Synthetic_display-capability_0123456789',
          displayGeneration: 3,
        })
      )
    );
    const result = await openTvDisplay('CAMP1', 'map-1', 'dm-1');
    expect(result).toEqual({ ok: true });
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/campaign/CAMP1/table/display/capability'
    );
    expect(fakeWin.location.replace).toHaveBeenCalledWith(
      '/table-display/CAMP1#k=Cap5Synthetic_display-capability_0123456789'
    );
    expect(fakeWin.location.href).toBe('');
    expect(
      fetchMock.mock.calls.some(call => String(call[0]).includes('display-key'))
    ).toBe(false);
  });
});
