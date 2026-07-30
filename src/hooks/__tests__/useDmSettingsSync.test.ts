import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
