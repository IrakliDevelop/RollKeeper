'use client';

import { useCallback, useRef, useState } from 'react';

import type { TableControlSession } from '@/lib/table/authorityLifecycle';
import { runCombatCommand, type TableCombatResult } from '@/lib/table/combat';
import type { TableRepository } from '@/lib/table/repository';

import type { TableCombatBridge } from '../combat/TableCombatPanel';
import type { TableCombatIntent } from '../combat/useTableCombat';
import { useTableCombatPublication } from '../combat/useTableCombatPublication';

/**
 * PR06 W4: the page's ONE combat publisher. It reads the campaign-level
 * publication state, so it does not depend on which scene is mounted; the
 * mounted scene panel lends it its serialized command queue and live player
 * data (bridge). It holds only on (re)acquire, never on a scene switch.
 */
export function useWorkspaceCombatPublication(options: {
  repository: TableRepository | null;
  controlSession: TableControlSession | null;
  controlEpoch: number;
  /** Repository change signal (any tab). */
  tick: number;
}) {
  const bridge = useRef<TableCombatBridge | null>(null);
  const [playerData, setPlayerData] =
    useState<TableCombatBridge['playerData']>(undefined);
  const { repository } = options;

  const background = useCallback(
    async (intent: TableCombatIntent): Promise<TableCombatResult> => {
      const lent = bridge.current;
      if (lent) return lent.background(intent);
      // No scene panel mounted (mid-switch): same background contract.
      if (!repository)
        return { status: 'failed', reason: 'indexeddb-unavailable' };
      const attempt = () => {
        const current = repository.getCurrent();
        return runCombatCommand(repository, {
          expectedRevision:
            current?.status === 'ready'
              ? (current.snapshot.campaign?.revision ?? 0)
              : 0,
          operationId: crypto.randomUUID(),
          command: intent(),
        });
      };
      let result = await attempt();
      if (result.status === 'conflict') {
        await repository.reload();
        result = await attempt();
      }
      return result;
    },
    [repository]
  );

  const publication = useTableCombatPublication({
    repository,
    controlSession: options.controlSession,
    controlEpoch: options.controlEpoch,
    tick: options.tick,
    playerData,
    background,
  });

  const onCombatBridge = useCallback((next: TableCombatBridge | null) => {
    bridge.current = next;
    if (next) setPlayerData(next.playerData);
  }, []);

  return { publication, onCombatBridge };
}
