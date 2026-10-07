import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDmBattleMapSync } from '../useDmBattleMapSync';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('useDmBattleMapSync.pushActive (PR04 P9)', () => {
  it('legacy: POSTs the shared battlemap pointer with CSRF and reports ok', async () => {
    const fetchFn = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useDmBattleMapSync('CODE', 'dm-1'));
    await expect(result.current.pushActive('map-a', 'Cave')).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/campaign/CODE/shared');
    expect(new Headers(init.headers).get('x-rollkeeper-csrf')).toBe('1');
    expect(JSON.parse(String(init.body))).toMatchObject({
      feature: 'battlemap',
      dmId: 'dm-1',
      data: { activeBattleMapId: 'map-a', name: 'Cave' },
    });
  });

  it('legacy: a rejected or failed request is reported, never swallowed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({}, { status: 426 }))
    );
    const { result } = renderHook(() => useDmBattleMapSync('CODE', 'dm-1'));
    await expect(result.current.pushActive('map-a')).resolves.toEqual({
      ok: false,
      status: 426,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      })
    );
    await expect(result.current.pushActive(null)).resolves.toEqual({
      ok: false,
      status: 0,
    });
  });

  it('Table v1: sends nothing and reports table-v1', async () => {
    vi.stubEnv('NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED', 'true');
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useDmBattleMapSync('CODE', 'dm-1'));
    await expect(result.current.pushActive('map-a', 'Cave')).resolves.toEqual({
      ok: false,
      reason: 'table-v1',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
