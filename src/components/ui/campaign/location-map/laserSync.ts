import {
  RemoteLaserOverlay,
  toLaserTrailPresence,
  type LaserTool,
  type RemoteLaserOverlayHost,
} from '@fieldnotes/core';

/**
 * Live laser pointer wiring over battle-map presence. Laser traffic is
 * ephemeral by contract: presence frames only — never elements, undo
 * history, `canvasState`/autosave, or the durable operation queue — and it
 * is room-visible (element `canRead` filtering is unrelated). Broadcast is
 * role-based product policy: today only DM canvases attach the broadcast
 * side; every synced canvas attaches the receiving side, so enabling player
 * lasers later is configuration, not code.
 */

/** The presence surface `createManagedBattleMapConnection` exposes. */
export interface LaserPresenceConnection {
  sendPresence: (data: unknown) => void;
  onPresence: (handler: (from: string, data: unknown) => void) => () => void;
  onPresenceLeave: (handler: (from: string) => void) => () => void;
}

/**
 * Broadcasts the local `LaserTool`'s per-frame coalesced trail emissions as
 * laser presence. Sends while not live are dropped by the connection (never
 * queued), matching the ephemerality contract. Returns unsubscribe.
 */
export function attachLaserBroadcast(
  tool: LaserTool,
  connection: Pick<LaserPresenceConnection, 'sendPresence'>
): () => void {
  return tool.onTrail(emission => {
    connection.sendPresence(toLaserTrailPresence(emission));
  });
}

/**
 * Renders remote laser trails on a synced canvas, whatever tool the viewer
 * holds. The presence `from` (the relay's server-owned connection id) is
 * used purely as an opaque per-sender trail key; `RemoteLaserOverlay.apply`
 * validates payloads, so hub pokes (`data.kind === 'poke'`) and any other
 * presence traffic are ignored here and poke parsing elsewhere is
 * undisturbed. A sender's trail disappears on fade and immediately on
 * presence-leave. Returns a cleanup that unsubscribes and disposes the
 * overlay.
 */
export function attachRemoteLaserTrails(
  vp: RemoteLaserOverlayHost,
  connection: Pick<LaserPresenceConnection, 'onPresence' | 'onPresenceLeave'>
): () => void {
  const overlay = new RemoteLaserOverlay(vp);
  const unsubscribePresence = connection.onPresence((from, data) => {
    overlay.apply(from, data);
  });
  const unsubscribeLeave = connection.onPresenceLeave(from => {
    overlay.remove(from);
  });
  return () => {
    unsubscribePresence();
    unsubscribeLeave();
    overlay.dispose();
  };
}
