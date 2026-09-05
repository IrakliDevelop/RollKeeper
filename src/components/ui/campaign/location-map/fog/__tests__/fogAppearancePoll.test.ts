import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  applyFogAppearanceMetadata,
  fetchAndApplyFogAppearance,
  startFogAppearancePoll,
} from '../fogAppearancePoll';
import type { Viewport } from '@fieldnotes/core';

function fakeViewport(): Viewport {
  return { setFogStyle: vi.fn() } as unknown as Viewport;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ fogAppearance: 'cloudy' }),
      })
    )
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchAndApplyFogAppearance', () => {
  it('does not let older token metadata replace a newer projection', () => {
    const vp = fakeViewport();

    applyFogAppearanceMetadata(vp, 'cloudy', '2026-09-05T12:00:01.000Z');
    applyFogAppearanceMetadata(vp, 'solid', '2026-09-05T12:00:00.000Z');
    applyFogAppearanceMetadata(vp, 'solid', null);

    expect(vp.setFogStyle).toHaveBeenCalledTimes(1);
    expect(vp.setFogStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        playerStyle: expect.objectContaining({ kind: 'procedural' }),
      })
    );
  });

  it('applies appearance from response', async () => {
    const vp = fakeViewport();
    fetchAndApplyFogAppearance(vp, '/test');
    await vi.advanceTimersByTimeAsync(0);
    expect(vp.setFogStyle).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(vp.setFogStyle).mock.calls[0][0];
    expect(opts.editorStyle).toBeDefined();
  });

  it('defaults to solid on missing fogAppearance', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
    const vp = fakeViewport();
    fetchAndApplyFogAppearance(vp, '/test');
    await vi.advanceTimersByTimeAsync(0);
    expect(vp.setFogStyle).toHaveBeenCalledWith({});
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    let resolveFirst!: (response: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>(resolve => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ fogAppearance: 'solid' }),
      } as Response);
    const vp = fakeViewport();

    fetchAndApplyFogAppearance(vp, '/first');
    fetchAndApplyFogAppearance(vp, '/second');
    await vi.advanceTimersByTimeAsync(0);
    resolveFirst({
      ok: true,
      json: () => Promise.resolve({ fogAppearance: 'cloudy' }),
    } as Response);
    await vi.advanceTimersByTimeAsync(0);

    expect(vp.setFogStyle).toHaveBeenCalledTimes(1);
    expect(vp.setFogStyle).toHaveBeenCalledWith({});
  });

  it('does not throw on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'));
    const vp = fakeViewport();
    expect(() => fetchAndApplyFogAppearance(vp, '/test')).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
  });

  it('does not throw on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
    } as Response);
    const vp = fakeViewport();
    fetchAndApplyFogAppearance(vp, '/test');
    await vi.advanceTimersByTimeAsync(0);
    expect(vp.setFogStyle).not.toHaveBeenCalled();
  });
});

describe('startFogAppearancePoll', () => {
  it('polls on 60s interval', async () => {
    const vp = fakeViewport();
    const stop = startFogAppearancePoll({ viewport: vp, url: '/test' });

    expect(fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(2);

    stop();
  });

  it('stops polling on cleanup', async () => {
    const vp = fakeViewport();
    const stop = startFogAppearancePoll({ viewport: vp, url: '/test' });
    stop();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips poll when document is hidden', async () => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true,
      configurable: true,
    });

    const vp = fakeViewport();
    const stop = startFogAppearancePoll({ viewport: vp, url: '/test' });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { value: false });
    stop();
  });
});
