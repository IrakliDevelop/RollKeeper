import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableControlSession } from '@/lib/table/authorityLifecycle';
import {
  runCombatCommand,
  type TableCombatCommandV1,
} from '@/lib/table/combat';
import {
  AT,
  SCENE_ID,
  openFixture,
  repositories,
  revisionOf,
} from '@/lib/table/combat.fixture';

import { useTableCombatPublication } from './useTableCombatPublication';

afterEach(() => {
  repositories.splice(0).forEach(repository => repository.dispose());
});

describe('Table combat publication on live control acquisition', () => {
  it('restores an already running combat for players after the lease clears initiative', async () => {
    const repository = await openFixture();
    let operation = 0;
    const commit = (command: TableCombatCommandV1) =>
      runCombatCommand(repository, {
        expectedRevision: revisionOf(repository),
        operationId: `restore-${++operation}`,
        command,
      });
    await commit({
      type: 'combat.createRun',
      sceneId: SCENE_ID,
      runId: 'run-restore',
      label: 'Restore',
      at: AT,
    });
    await commit({
      type: 'combat.setParticipants',
      runId: 'run-restore',
      actorIds: ['goblin'],
      at: AT,
    });
    await commit({
      type: 'combat.setInitiative',
      runId: 'run-restore',
      actorId: 'goblin',
      value: 12,
      at: AT,
    });
    await commit({ type: 'combat.start', runId: 'run-restore', at: AT });

    const publishInitiative = vi.fn(async () => ({
      status: 'committed' as const,
    }));
    const session = {
      isLost: () => false,
      publishInitiative,
      endInitiative: vi.fn(async () => ({ status: 'committed' as const })),
    } as unknown as TableControlSession;
    const background = async (intent: () => TableCombatCommandV1) =>
      commit(intent());
    const { rerender } = renderHook(
      ({ controlSession, controlEpoch }) =>
        useTableCombatPublication({
          repository,
          controlSession,
          controlEpoch,
          tick: 0,
          playerData: undefined,
          background,
        }),
      {
        initialProps: {
          controlSession: null as TableControlSession | null,
          controlEpoch: 0,
        },
      }
    );
    rerender({ controlSession: session, controlEpoch: 1 });
    await waitFor(() =>
      expect(publishInitiative).toHaveBeenCalledWith(
        'run-restore',
        expect.objectContaining({ isActive: true, round: 1 })
      )
    );
  });
});
