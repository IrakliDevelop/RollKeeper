import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  compare: vi.fn(),
  importBundle: vi.fn(),
  query: '',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock('./useAuthenticatedTableWorkspace', () => ({
  useAuthenticatedTableWorkspace: mocks.workspace,
}));
vi.mock('@/lib/table/adoption', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/table/adoption')>();
  return { ...actual, compareTableSceneSource: mocks.compare };
});
vi.mock('@/lib/table/bundle', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/table/bundle')>();
  return { ...actual, importTableBundle: mocks.importBundle };
});
vi.mock('@/store/dmStore', () => ({
  useDmStore: { getState: () => ({ dmId: 'dm-1' }) },
}));

import { TableScenePanel } from './TableScenePanel';

describe('Table scene panel acceptance states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query = '';
    const repository = {
      indexedDbFactory: null,
      workspaceIdentity: 'guest/workspace:source',
      workspaceSelection: {
        account: { kind: 'guest' },
        workspace: {
          localWorkspaceId: 'source',
          routeCampaignCode: 'CAMP',
        },
      },
      getCurrent: () => ({
        status: 'ready',
        snapshot: {
          campaign: {
            revision: 1,
            sourceMappings: [
              {
                sourceCampaignId: 'CAMP',
                sourceMapId: 'map-1',
                sceneId: 'scene-1',
              },
            ],
          },
          scenes: [
            {
              sceneId: 'scene-1',
              map: { name: 'Crypt' },
              canvasCheckpoint: null,
              localDraft: null,
            },
          ],
        },
      }),
    };
    mocks.workspace.mockReturnValue({
      repository,
      revision: 1,
      loading: false,
      error: null,
    });
    mocks.compare.mockResolvedValue({
      status: 'source-changed',
      changedSourceKeys: ['map:map-1'],
    });
    mocks.importBundle.mockResolvedValue({
      status: 'imported',
      localWorkspaceId: 'fork-1',
      workspaceKey: 'guest/workspace:fork-1',
    });
  });

  it('shows post-adoption source change and an accessible imported-fork selection link', async () => {
    const { container } = render(
      <TableScenePanel campaignCode="CAMP" battleMaps={[]} />
    );
    expect(await screen.findByText('Source changed')).toBeVisible();

    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('missing input');
    fireEvent.change(input, {
      target: {
        files: [new File(['{}'], 'table.json', { type: 'application/json' })],
      },
    });
    await waitFor(() => expect(mocks.importBundle).toHaveBeenCalledOnce());
    expect(mocks.importBundle).toHaveBeenCalledWith(
      expect.objectContaining({ targetCampaignCode: 'CAMP' })
    );
    expect(
      await screen.findByRole('link', { name: 'Open imported Table' })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/battlemaps?tableWorkspace=fork-1'
    );
  });

  it('rejects a forged imported workspace under another campaign without any authority request', async () => {
    mocks.query = 'tableWorkspace=fork-from-a';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mocks.workspace.mockReturnValue({
      repository: {
        workspaceIdentity: 'guest/workspace:fork-from-a',
        workspaceSelection: {
          account: { kind: 'guest' },
          workspace: {
            localWorkspaceId: 'fork-from-a',
            routeCampaignCode: 'CAMPAIGN-A',
          },
        },
        getCurrent: () => ({
          status: 'ready',
          snapshot: { campaign: { revision: 1 }, scenes: [] },
        }),
      },
      revision: 1,
      loading: false,
      error: null,
    });

    render(<TableScenePanel campaignCode="CAMPAIGN-B" battleMaps={[]} />);
    expect(
      screen.getByText(/belongs to another campaign, so it can't go live here/u)
    ).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
