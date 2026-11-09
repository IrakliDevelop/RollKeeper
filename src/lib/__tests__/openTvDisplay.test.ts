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

  beforeEach(() => {
    fakeWin = {
      location: { href: '', replace: vi.fn() },
      opener: window,
      close: vi.fn(),
    };
    openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the campaign display instead of the map-pinned key (PR05 E12)', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          capability: 'Cap5Synthetic_display-capability_0123456789',
          displayGeneration: 3,
        })
      )
    );
    const result = await openTvDisplay('CAMP1', 'dm-1');
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
