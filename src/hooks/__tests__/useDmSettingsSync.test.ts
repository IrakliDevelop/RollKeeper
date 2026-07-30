import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useDmSettingsSync } from '@/hooks/useDmSettingsSync';
import { useDmStore } from '@/store/dmStore';

describe('useDmSettingsSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    useDmStore.setState({
      campaigns: [
        {
          code: 'ABC',
          name: 'Test',
          createdAt: new Date().toISOString(),
          stackableInspiration: true,
        },
      ],
    });
  });

  afterEach(() => {
    // No global auto-cleanup: a leftover mounted hook would push again when the
    // next test seeds the store.
    cleanup();
    vi.useRealTimers();
  });

  it('pushes the stackableInspiration setting to /shared', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    renderHook(() => useDmSettingsSync('ABC', 'dm-1'));
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaign/ABC/shared',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          feature: 'settings',
          data: { stackableInspiration: true },
          dmId: 'dm-1',
        }),
      })
    );
  });

  it('retries the push after a failed request instead of recording it as delivered', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    const { rerender } = renderHook(() => useDmSettingsSync('ABC', 'dm-1'));
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Same setting, new campaign object identity — a failed push must not have
    // been fingerprinted, so the hook re-attempts delivery.
    useDmStore.setState({
      campaigns: [
        {
          code: 'ABC',
          name: 'Test',
          createdAt: new Date().toISOString(),
          stackableInspiration: true,
        },
      ],
    });
    rerender();
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not re-push after a successful request', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    const { rerender } = renderHook(() => useDmSettingsSync('ABC', 'dm-1'));
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    useDmStore.setState({
      campaigns: [
        {
          code: 'ABC',
          name: 'Test',
          createdAt: new Date().toISOString(),
          stackableInspiration: true,
        },
      ],
    });
    rerender();
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not push when the campaign is not found locally', async () => {
    useDmStore.setState({ campaigns: [] });

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    renderHook(() => useDmSettingsSync('MISSING', 'dm-1'));
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
