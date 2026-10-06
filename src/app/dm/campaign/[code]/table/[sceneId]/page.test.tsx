import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TableSceneRecordV1 } from '@/lib/table/schema';

const mocks = vi.hoisted(() => ({
  activate: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  createAdapter: vi.fn(),
  workspace: vi.fn(),
  canvasProps: vi.fn(),
  rosterProps: vi.fn(),
  query: '',
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'CAMP', sceneId: 'scene-1' }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock(
  '@/components/ui/campaign/table/useAuthenticatedTableWorkspace',
  () => ({
    useAuthenticatedTableWorkspace: mocks.workspace,
  })
);
vi.mock('@/lib/table/authorityLifecycle', () => ({
  prepareTableSceneAuthority: mocks.activate,
  getTableAuthoritySessionId: () => 'table-session-1',
}));
vi.mock('@/lib/table/checkpoint', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/table/checkpoint')>();
  return {
    ...actual,
    restoreAuthorityFork: mocks.restore,
    saveSceneCheckpoint: mocks.save,
  };
});
vi.mock('@/lib/table/sceneAdapter', () => ({
  createTableSceneAdapter: mocks.createAdapter,
  isTableWorkspaceBoundToCampaign: (
    selection: { workspace: { routeCampaignCode?: string | null } },
    campaignCode: string
  ) => selection.workspace.routeCampaignCode === campaignCode,
}));
vi.mock('@/store/dmStore', () => ({
  useDmStore: (selector: (state: { dmId: string }) => unknown) =>
    selector({ dmId: 'dm-1' }),
}));
vi.mock('@/components/ui/campaign/dm-vtt/DmBattleMapCanvas', () => ({
  DmBattleMapCanvas: (props: {
    sessionControls: ReactNode;
    children?: ReactNode;
    onViewportReady?: unknown;
    tokenConfigRef?: unknown;
  }) => {
    mocks.canvasProps(props);
    return (
      <div data-testid="canvas">
        {props.sessionControls}
        {props.children}
      </div>
    );
  },
}));
vi.mock('@/components/ui/campaign/table/TableRosterPanel', () => ({
  TableRosterPanel: (props: Record<string, unknown>) => {
    mocks.rosterProps(props);
    return <div data-testid="table-roster" />;
  },
}));
vi.mock('@/components/ui/campaign/dm-vtt/TokenPlacementController', () => ({
  TokenPlacementController: (props: { pending: unknown }) => (
    <div data-testid="placement" data-pending={props.pending ? 'yes' : 'no'} />
  ),
}));

import TableScenePage from './page';

function scene(): TableSceneRecordV1 {
  const authorityState = {
    elements: [{ id: 'token-1', type: 'token' }],
    layers: [],
    extensions: {
      fog: { pluginName: 'fog', version: 1, data: null },
    },
    cursor: {
      generation: 'generation-1',
      streamId: '0123456789abcdef0123456789abcdef',
      revision: 1,
    },
    casToken: 'cas-1',
  };
  return {
    schemaVersion: 1,
    workspaceKey: 'guest/workspace:workspace-1',
    sceneId: 'scene-1',
    originalMapId: 'map-original',
    map: {
      name: 'Crypt',
      mapImageUrl: '/map.webp',
      mapImageSize: { w: 100, h: 100 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: {
      protocolVersion: 1,
      generation: 'generation-1',
      revision: 1,
      capturedAt: '2026-10-06T00:00:00.000Z',
      state: authorityState,
    },
    localDraft: {
      protocolVersion: 1,
      generation: 'offline-1',
      revision: 2,
      capturedAt: '2026-10-06T00:01:00.000Z',
      state: {
        version: 4,
        camera: { position: { x: 0, y: 0 }, zoom: 1 },
        elements: [{ id: 'offline-token' }],
        layers: [],
        extensions: { fog: { version: 1, data: null } },
      },
    },
    members: [],
    arrivalPoint: null,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:01:00.000Z',
  };
}

describe('Table scene recovery UI', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query = '';
    const stored = scene();
    const repository = {
      workspaceSelection: {
        account: { kind: 'guest' },
        workspace: {
          localWorkspaceId: 'workspace-1',
          routeCampaignCode: 'CAMP',
        },
      },
      getCurrent: () => ({
        status: 'ready',
        snapshot: {
          campaign: { revision: 3 },
          scenes: [stored],
        },
      }),
      reload: vi.fn(),
    };
    mocks.workspace.mockReturnValue({
      repository,
      revision: 1,
      loading: false,
      error: null,
    });
    mocks.createAdapter.mockReturnValue({
      sceneId: 'scene-1',
      sourceMapId: 'map-original',
      getBattleMap: () => ({
        id: 'scene-1',
        name: 'Crypt',
        canvasState: '{}',
      }),
      subscribe: () => () => {},
      getLocalEditGeneration: () => 0,
      getPendingConflict: () => null,
      refreshPendingConflict: vi.fn(),
      retryPendingConflict: vi.fn(),
      discardPendingConflict: vi.fn(),
      flush: vi.fn(),
      dispose: vi.fn(),
    });
    mocks.activate.mockResolvedValue({ status: 'prepared', renew: vi.fn() });
    mocks.restore.mockResolvedValue({ status: 'conflict' });
  });

  it('shows truthful persisted status and invokes guarded restore/reapply actions', async () => {
    render(<TableScenePage />);
    await screen.findByTestId('canvas');
    expect(screen.getByText(/local operations: pending/i)).toBeVisible();
    expect(
      screen.getByText(
        /Local draft: saved.*authoritative checkpoint: committed locally/i
      )
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Restore saved checkpoint' })
    );
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce());
    expect(mocks.restore).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-1',
        checkpoint: expect.objectContaining({ generation: 'generation-1' }),
      })
    );
    expect(
      await screen.findByText(
        /was not restored because live authority changed/i
      )
    ).toBeVisible();

    mocks.restore.mockResolvedValueOnce({ status: 'restored' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Reapply local draft' })
    );
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledTimes(2));
    expect(mocks.restore.mock.calls[1]?.[0]).toMatchObject({
      checkpoint: { generation: 'offline-1' },
    });
    expect(
      await screen.findByText(/Local draft restored to live authority/i)
    ).toBeVisible();
  });

  it('mounts the scene roster inside the canvas with the shared placement ref', async () => {
    render(<TableScenePage />);
    await screen.findByTestId('table-roster');
    expect(screen.getByTestId('placement')).toHaveAttribute(
      'data-pending',
      'no'
    );
    const canvasProps = mocks.canvasProps.mock.calls.at(-1)![0] as {
      onViewportReady?: unknown;
      tokenConfigRef?: unknown;
    };
    expect(canvasProps.onViewportReady).toEqual(expect.any(Function));
    expect(mocks.rosterProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sceneId: 'scene-1',
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        canvas: null,
        live: false,
      })
    );
  });

  it('preserves imported workspace selection in Battle Maps links', async () => {
    mocks.query = 'tableWorkspace=fork-1';
    render(<TableScenePage />);
    await screen.findByTestId('canvas');
    expect(screen.getByRole('link', { name: 'Battle Maps' })).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/battlemaps?tableWorkspace=fork-1'
    );
    expect(mocks.workspace).toHaveBeenCalledWith(
      expect.objectContaining({ localWorkspaceId: 'fork-1' })
    );
  });

  it('surfaces refresh, deliberate retry and discard for a pending adapter conflict', async () => {
    const refreshPendingConflict = vi.fn().mockResolvedValue(true);
    const retryPendingConflict = vi.fn().mockResolvedValue('conflict');
    const discardPendingConflict = vi.fn();
    mocks.createAdapter.mockReturnValue({
      sceneId: 'scene-1',
      sourceMapId: 'map-original',
      getBattleMap: () => ({
        id: 'scene-1',
        name: 'Crypt',
        canvasState: '{}',
      }),
      subscribe: () => () => {},
      getLocalEditGeneration: () => 0,
      getPendingConflict: () => ({
        operationId: 'stale-name',
        fields: ['name'],
        createdAt: '2026-10-06T00:02:00.000Z',
      }),
      refreshPendingConflict,
      retryPendingConflict,
      discardPendingConflict,
      flush: vi.fn(),
      dispose: vi.fn(),
    });
    render(<TableScenePage />);
    await screen.findByText(/was not replayed/i);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh winner' }));
    await waitFor(() => expect(refreshPendingConflict).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Retry pending edit' }));
    await waitFor(() => expect(retryPendingConflict).toHaveBeenCalledOnce());
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard pending edit' })
    );
    expect(discardPendingConflict).toHaveBeenCalledOnce();
  });

  it('rejects a forged imported-workspace campaign route before adapter or authority calls', async () => {
    mocks.query = 'tableWorkspace=fork-1';
    const crossRouteRepository = {
      workspaceSelection: {
        account: { kind: 'guest' },
        workspace: {
          localWorkspaceId: 'fork-1',
          routeCampaignCode: 'OTHER-CAMPAIGN',
        },
      },
      getCurrent: () => ({
        status: 'ready',
        snapshot: { campaign: { revision: 1 }, scenes: [scene()] },
      }),
    };
    mocks.workspace.mockReturnValue({
      repository: crossRouteRepository,
      revision: 1,
      loading: false,
      error: null,
    });

    render(<TableScenePage />);
    expect(
      await screen.findByText(/not bound to this campaign route/i)
    ).toBeVisible();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument();
  });
});
