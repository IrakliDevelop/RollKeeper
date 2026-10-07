import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  TableControlSession,
  TableDescriptor,
} from '@/lib/table/authorityLifecycle';
import type { TableRepository } from '@/lib/table/repository';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';

const prepared = vi.hoisted(() => ({ session: null as unknown }));
vi.mock('@/lib/table/authorityLifecycle', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/table/authorityLifecycle')>()),
  prepareTableSceneAuthority: vi.fn(async () => ({
    status: 'prepared',
    session: prepared.session,
    renew: async () => true,
  })),
}));

import { useTableSceneAuthority } from './useTableSceneAuthority';

const descriptor = (holderSessionId: string): TableDescriptor => ({
  epoch: 'epoch-a',
  revision: 3,
  writerFence: 2,
  leaseUntil: Date.now() + 30_000,
  holderSessionId,
  presentation: { sceneId: 'scene-tavern', revision: 1, blanked: false },
  publicRunId: null,
});

function fakeSession() {
  const listeners = new Set<() => void>();
  let lost: string | null = null;
  let current = descriptor('table-session-1');
  const session = {
    holderSessionId: 'table-session-1',
    current: () => current,
    isLost: () => lost !== null,
    lostReason: () => lost,
    renew: vi.fn(async () => ({ status: 'committed' as const })),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as TableControlSession;
  return {
    session,
    listeners,
    lose(reason: string, next: TableDescriptor) {
      lost = reason;
      current = next;
      listeners.forEach(listener => listener());
    },
    change(next: TableDescriptor) {
      current = next;
      listeners.forEach(listener => listener());
    },
  };
}

const repository = {
  getCurrent: () => ({
    status: 'ready',
    snapshot: {
      campaign: { revision: 1 },
      scenes: [
        {
          sceneId: 'scene-tavern',
          originalMapId: 'map-tavern',
          map: { name: 'Tavern' },
          canvasCheckpoint: null,
        },
      ],
    },
  }),
  workspaceSelection: { workspace: { localWorkspaceId: 'workspace-a' } },
} as unknown as TableRepository;
const adapter = {} as TableSceneAdapter;

describe('useTableSceneAuthority subscribes to its control session (PR04 P3.5)', () => {
  it('surfaces a lost result from ANY command immediately, without waiting for renew', async () => {
    const fake = fakeSession();
    prepared.session = fake.session;
    const { result, unmount } = renderHook(() =>
      useTableSceneAuthority({
        repository,
        adapter,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-tavern',
      })
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    act(() => fake.lose('lease-lost', descriptor('mapless-encounter')));
    expect(result.current.state).toMatchObject({
      phase: 'lost',
      reason: 'lease-lost',
      foreignHolder: true,
    });
    expect(fake.session.renew).not.toHaveBeenCalled();
    unmount();
    expect(fake.listeners.size).toBe(0);
  });

  it('publishes descriptor changes so presentation status updates at once', async () => {
    const fake = fakeSession();
    prepared.session = fake.session;
    const { result } = renderHook(() =>
      useTableSceneAuthority({
        repository,
        adapter,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-tavern',
      })
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(result.current.descriptor?.presentation.sceneId).toBe(
      'scene-tavern'
    );
    act(() =>
      fake.change({
        ...descriptor('table-session-1'),
        presentation: { sceneId: null, revision: 2, blanked: false },
      })
    );
    expect(result.current.descriptor?.presentation.sceneId).toBeNull();
  });
});
