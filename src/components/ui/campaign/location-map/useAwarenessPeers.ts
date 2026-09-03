import { useCallback, useSyncExternalStore } from 'react';

import type { Peer, PeerRoster } from '@fieldnotes/core';

const EMPTY: readonly Peer[] = Object.freeze([]);
const noopSubscribe = () => () => {};
const getEmpty = () => EMPTY;

/**
 * Live roster snapshot. `getPeers()` is reference-stable across equal-state
 * heartbeats and `onChange` fires only when the reference changes, so
 * heartbeats never re-render consumers.
 */
export function useAwarenessPeers(roster: PeerRoster | null): readonly Peer[] {
  const subscribe = useCallback(
    (listener: () => void) =>
      roster ? roster.onChange(listener) : noopSubscribe(),
    [roster]
  );
  const getSnapshot = useCallback(
    () => (roster ? roster.getPeers() : EMPTY),
    [roster]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getEmpty);
}
