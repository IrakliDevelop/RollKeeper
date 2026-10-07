import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEncounterStore } from '@/store/encounterStore';

const lookups = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: 'account-1' } } })),
  campaign: vi.fn(),
  encounter: vi.fn(async () => []),
}));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser: lookups.getUser } }),
}));
vi.mock('@/lib/table/combatLibrary', () => ({
  findSceneRunsForCampaign: lookups.campaign,
  findSceneRunsForEncounter: lookups.encounter,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { EncounterList } from '../EncounterList';

const encounter = (id: string) => ({
  id,
  name: `Fight ${id}`,
  campaignCode: 'CAMP',
  entities: [],
  currentTurn: 0,
  round: 0,
  isActive: false,
  sortOrder: 'initiative' as const,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
});

beforeEach(() => {
  lookups.getUser.mockClear();
  lookups.encounter.mockClear();
  lookups.campaign.mockReset();
  lookups.campaign.mockResolvedValue(
    new Map([
      [
        'enc-2',
        [
          {
            runId: 'run-2',
            sceneId: 'scene-1',
            label: 'Adopted',
            localWorkspaceId: 'w',
            defaultWorkspace: true,
          },
        ],
      ],
    ])
  );
  useEncounterStore.setState({
    encounters: [encounter('enc-1'), encounter('enc-2'), encounter('enc-3')],
  });
});
afterEach(cleanup);

describe('encounter library scene-run lookup (F7)', () => {
  it('runs one auth lookup and one Table read for the whole list', async () => {
    render(<EncounterList campaignCode="CAMP" />);
    expect(
      await screen.findByRole('link', { name: /Open scene run/ })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table/scene-1?run=run-2');
    await waitFor(() => expect(lookups.campaign).toHaveBeenCalledTimes(1));
    expect(lookups.campaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignCode: 'CAMP',
        account: { kind: 'authenticated', accountId: 'account-1' },
      })
    );
    expect(lookups.getUser).toHaveBeenCalledTimes(1);
    expect(lookups.encounter).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('link', { name: /Open scene run/ })
    ).toHaveLength(1);
  });
});
