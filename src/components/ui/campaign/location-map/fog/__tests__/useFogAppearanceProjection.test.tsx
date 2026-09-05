import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useFogAppearanceProjection,
  writeFogAppearanceProjection,
} from '../useFogAppearanceProjection';

const baseInput = {
  enabled: true,
  campaignCode: 'CODE ONE',
  battleMapId: 'map/one',
  dmId: 'dm-1',
  appearance: 'cloudy' as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('writeFogAppearanceProjection', () => {
  it('uses the mutation CSRF header and encodes route segments', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    await writeFogAppearanceProjection(baseInput);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaign/CODE%20ONE/battlemaps/map%2Fone/fog-appearance',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
      })
    );
  });

  it('rejects non-success responses so the UI can warn the DM', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403 }))
    );
    await expect(writeFogAppearanceProjection(baseInput)).rejects.toThrow(
      'Fog appearance projection failed (403)'
    );
  });
});

describe('useFogAppearanceProjection', () => {
  it('does nothing while the rollout or live relay path is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() =>
      useFogAppearanceProjection({ ...baseInput, enabled: false })
    );
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('publishes the current local value on mount', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useFogAppearanceProjection(baseInput));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({
      dmId: 'dm-1',
      appearance: 'cloudy',
    });
  });

  it('serializes rapid changes so the last selection is written last', async () => {
    let releaseFirst!: () => void;
    const first = new Promise<Response>(resolve => {
      releaseFirst = () => resolve({ ok: true } as Response);
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = renderHook(
      ({ appearance }: { appearance: 'solid' | 'cloudy' }) =>
        useFogAppearanceProjection({ ...baseInput, appearance }),
      {
        initialProps: {
          appearance: 'cloudy',
        } as { appearance: 'solid' | 'cloudy' },
      }
    );
    await act(async () => {});

    rerender({ appearance: 'solid' });
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirst();
      await first;
    });
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(secondInit.body as string).appearance).toBe('solid');
  });

  it('reports a failed projection and allows a later selection to continue', async () => {
    const onError = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = renderHook(
      ({ appearance }: { appearance: 'solid' | 'cloudy' }) =>
        useFogAppearanceProjection({ ...baseInput, appearance, onError }),
      {
        initialProps: {
          appearance: 'cloudy',
        } as { appearance: 'solid' | 'cloudy' },
      }
    );
    await act(async () => {});
    expect(onError).toHaveBeenCalledTimes(1);

    rerender({ appearance: 'solid' });
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not report a late failure after the surface unmounts', async () => {
    let rejectWrite!: (error: Error) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectWrite = reject;
          })
      )
    );
    const onError = vi.fn();
    const { unmount } = renderHook(() =>
      useFogAppearanceProjection({ ...baseInput, onError })
    );
    await act(async () => {});
    unmount();

    await act(async () => {
      rejectWrite(new Error('late network failure'));
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
