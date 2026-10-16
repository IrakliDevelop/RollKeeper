'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TableControlSession } from '@/lib/table/authorityLifecycle';
import type { TableCombatResult } from '@/lib/table/combat';
import {
  buildScenePublication,
  publicationRunState,
} from '@/lib/table/combatPublication';
import {
  createCombatPublisher,
  type CombatPublisher,
  type PublicationStatus,
} from '@/lib/table/combatPublisher';
import { buildCombatReadModel } from '@/lib/table/combatReadModel';
import type { TableRepository } from '@/lib/table/repository';
import { useEncounterStore } from '@/store/encounterStore';
import type { CampaignPlayerData } from '@/types/campaign';

import type { TableCombatIntent } from './useTableCombat';

/**
 * Wires the scene combat publisher to the page's control session (D8). Only
 * a tab holding the lease publishes; every (re)acquire bumps `controlEpoch`
 * and the publisher holds until an explicit "Publish current state" or a new
 * start/end intent. CombatConfig is the DM's existing setting, read-only.
 * PR06 W4: the workspace owns the one publisher of the page (`enabled` is
 * false in a panel fed by the workspace), so a scene switch never holds.
 */
export function useTableCombatPublication(options: {
  repository: TableRepository | null;
  /** False: this caller does not own a publisher (the workspace does). */
  enabled?: boolean;
  controlSession: TableControlSession | null;
  controlEpoch: number;
  tick: number;
  playerData: CampaignPlayerData[] | undefined;
  background: (intent: TableCombatIntent) => Promise<TableCombatResult>;
}) {
  const combatConfig = useEncounterStore(state => state.combatConfig);
  const [status, setStatus] = useState<PublicationStatus>({
    kind: 'saved-locally',
  });
  const latest = useRef(options);
  latest.current = options;
  const config = useRef(combatConfig);
  config.current = combatConfig;
  const publisher = useRef<CombatPublisher | null>(null);
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    const readSnapshot = () => {
      const current = latest.current.repository?.getCurrent();
      return current?.status === 'ready' ? current.snapshot : null;
    };
    const instance = createCombatPublisher({
      getSession: () => latest.current.controlSession,
      readState: () => {
        const snapshot = readSnapshot();
        return snapshot
          ? publicationRunState(snapshot)
          : { active: null, pendingEnds: [] };
      },
      buildPayload: runId => {
        const snapshot = readSnapshot();
        const model = snapshot
          ? buildCombatReadModel({
              snapshot,
              runId,
              players: latest.current.playerData,
            })
          : null;
        return model
          ? buildScenePublication(model, config.current)
          : { status: 'not-running' };
      },
      acknowledge: async targets => {
        const result = await latest.current.background(() => ({
          type: 'combat.acknowledgePublication',
          targets,
          at: new Date().toISOString(),
        }));
        return result.status === 'committed' || result.status === 'unchanged';
      },
      onStatus: setStatus,
    });
    publisher.current = instance;
    return () => {
      instance.dispose();
      publisher.current = null;
    };
  }, [enabled]);

  // Every (re)acquire wipes the public initiative: hold until explicit.
  useEffect(() => {
    publisher.current?.hold();
  }, [options.controlEpoch, options.controlSession]);

  // Repository (any tab) or live player data changed.
  useEffect(() => {
    publisher.current?.changed();
  }, [options.tick, options.playerData]);

  const publishCurrentState = useCallback(async () => {
    await publisher.current?.publishCurrentState();
  }, []);

  return { status, publishCurrentState };
}
