import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openTvDisplay } from '@/lib/openTvDisplay';

describe('openTvDisplay', () => {
  let fakeWin: { location: { href: string } };
  let openSpy: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeWin = { location: { href: '' } };
    openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);
    fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ displayKey: 'KEY123' }))
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

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
});
