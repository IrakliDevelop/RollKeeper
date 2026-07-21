import { useEffect, useRef } from 'react';

import {
  createBattleMapPokeListener,
  type PokeListenerOptions,
} from '@/lib/battlemapPokeListener';

export interface UseBattleMapPokesOptions {
  campaignCode: string | null;
  battleMapId: string | null;
  tokenRequest: PokeListenerOptions['tokenRequest'] | null;
  onPoke: (feature: string) => void;
}

/**
 * Mounts a read-only `createBattleMapPokeListener` for non-canvas pages (the
 * character sheet, party HP sidebar, etc.) so a DM poke shaves latency off
 * the next initiative/party-HP refetch instead of waiting on the poll
 * interval. Starts only once `campaignCode`, `battleMapId`, and
 * `tokenRequest` are all non-null; stops on unmount or whenever
 * `campaignCode`/`battleMapId`/the token identity changes.
 *
 * `onPoke` is read via a latest-value ref (the established house pattern —
 * see `DmBattleMapCanvas.hooks.ts` / `PlayerBattleMapCanvas`): a plain
 * closure would go stale after the listener is created, but rebuilding the
 * socket on every `onPoke` identity change (e.g. an inline arrow prop) would
 * churn the connection for no reason.
 */
export function useBattleMapPokes({
  campaignCode,
  battleMapId,
  tokenRequest,
  onPoke,
}: UseBattleMapPokesOptions): void {
  const onPokeRef = useRef(onPoke);
  onPokeRef.current = onPoke;

  // Only primitives that identify "which token" go in the dep array — the
  // tokenRequest object's reference identity is not stable across renders.
  const tokenRole = tokenRequest?.role ?? null;
  const tokenSubjectId =
    tokenRequest?.role === 'player'
      ? tokenRequest.playerId
      : tokenRequest?.role === 'dm'
        ? tokenRequest.dmId
        : null;

  useEffect(() => {
    if (!campaignCode || !battleMapId || !tokenRequest) return;

    const stop = createBattleMapPokeListener({
      campaignCode,
      battleMapId,
      tokenRequest,
      onPoke: feature => onPokeRef.current(feature),
    });

    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignCode, battleMapId, tokenRole, tokenSubjectId]);
}
