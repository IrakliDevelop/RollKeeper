import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const removeBattleMap = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'ABC123' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => null,
}));
vi.mock('@/components/ui/campaign/table/TableScenePanel', () => ({
  TableScenePanel: () => null,
}));
vi.mock('@/components/ui/campaign/battle-map/BattleMapListCard', () => ({
  BattleMapListCard: (props: {
    battleMap: { id: string; name: string };
    onDelete: (id: string) => void;
  }) => (
    <button type="button" onClick={() => props.onDelete(props.battleMap.id)}>
      {`Delete ${props.battleMap.name}`}
    </button>
  ),
}));
vi.mock('@/hooks/useHydration', () => ({ useHydration: () => true }));
vi.mock('@/utils/uploadAsset', () => ({ uploadAsset: vi.fn() }));
vi.mock('@/store/dmStore', () => ({
  useDmStore: () => ({
    getCampaign: () => ({ name: 'Campaign' }),
    dmId: 'dm-1',
  }),
}));
vi.mock('@/store/battleMapStore', () => ({
  generateBattleMapId: () => 'generated',
  useBattleMapStore: () => ({
    getBattleMaps: () => [{ id: 'map-a', name: 'Cave' }],
    addBattleMap: vi.fn(),
    removeBattleMap,
  }),
}));

import CampaignBattleMapsPage from './page';

const fetchFn = vi.fn();
beforeEach(() => {
  removeBattleMap.mockClear();
  fetchFn.mockReset();
  vi.stubGlobal('fetch', fetchFn);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function clickDelete() {
  render(<CampaignBattleMapsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete Cave' }));
  await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
}

describe('Battle maps list delete (PR04 P9)', () => {
  it('Table v1: sends the P6 DELETE and removes the local copy on success', async () => {
    vi.stubEnv('NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED', 'true');
    fetchFn.mockResolvedValue(Response.json({ success: true }));
    await clickDelete();
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/campaign/ABC123/battlemaps/map-a');
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('x-rollkeeper-csrf')).toBe('1');
    await vi.waitFor(() =>
      expect(removeBattleMap).toHaveBeenCalledWith('ABC123', 'map-a')
    );
  });

  it('Table v1: a refusal is explained in words and keeps the local map', async () => {
    vi.stubEnv('NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED', 'true');
    for (const [status, text] of [
      [404, 'Not deleted — this map is used by a Table scene.'],
      [403, 'Not deleted — only the campaign DM can delete battle maps.'],
      [503, 'Not deleted — live storage is unavailable. Try again shortly.'],
    ] as const) {
      fetchFn.mockResolvedValue(Response.json({}, { status }));
      await clickDelete();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(text);
      expect(alert.textContent).not.toMatch(/\(\d{3}\)/u);
      cleanup();
      fetchFn.mockReset();
    }
    expect(removeBattleMap).not.toHaveBeenCalled();
  });

  it('legacy: the existing rejection message is unchanged', async () => {
    fetchFn.mockResolvedValue(Response.json({}, { status: 403 }));
    await clickDelete();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Delete was rejected (403)'
    );
  });
});
