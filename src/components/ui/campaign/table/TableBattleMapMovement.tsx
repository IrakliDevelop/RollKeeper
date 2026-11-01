'use client';

import { BattleMapMovement } from '../location-map/BattleMapMovement';
import type { BattleMapMovementProps } from '../location-map/useBattleMapMovement';
import { useTablePlayersSnapshot } from './useTablePlayersSnapshot';

/** Join the workspace's shared, authorized player read for live walking speed. */
export function TableBattleMapMovement(props: BattleMapMovementProps) {
  const { snapshot } = useTablePlayersSnapshot(props.campaignCode, {
    pollMs: 10_000,
  });
  return (
    <BattleMapMovement
      {...props}
      tablePlayers={snapshot.status === 'ready' ? snapshot.data : undefined}
    />
  );
}
