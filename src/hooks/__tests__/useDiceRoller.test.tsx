import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDiceRoller } from '@/hooks/useDiceRoller';
import type { RollSummary } from '@/types/dice';

describe('useDiceRoller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('rolls one d20 for a zero modifier instead of a huge die', async () => {
    const tray = document.createElement('div');
    tray.id = 'hook-tray';
    document.body.appendChild(tray);

    const { result, unmount } = renderHook(() =>
      useDiceRoller({ containerId: 'hook-tray', autoClearDelay: 0 })
    );
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    const summary: RollSummary | null = await act(() =>
      result.current.roll('1d20')
    );

    expect(summary?.diceResults).toHaveLength(1);
    expect(summary?.diceResults[0]?.sides).toBe(20);
    expect(summary?.modifier).toBe(0);
    const face = summary?.individualValues[0] ?? 0;
    expect(face).toBeGreaterThanOrEqual(1);
    expect(face).toBeLessThanOrEqual(20);
    unmount();
  });

  it('reports invalid notation instead of inventing a result', async () => {
    const tray = document.createElement('div');
    tray.id = 'hook-tray-error';
    document.body.appendChild(tray);
    const errors: string[] = [];

    const { result, unmount } = renderHook(() =>
      useDiceRoller({
        containerId: 'hook-tray-error',
        autoClearDelay: 0,
        onError: message => errors.push(message),
      })
    );
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    const summary = await act(() => result.current.roll('1d200'));

    expect(summary).toBeNull();
    expect(errors.some(message => message.includes('Error rolling dice'))).toBe(
      true
    );
    unmount();
  });
});
