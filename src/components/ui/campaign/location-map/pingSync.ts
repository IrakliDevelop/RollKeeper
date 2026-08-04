import {
  RemotePingOverlay,
  toPingPresence,
  type PingTool,
  type RemotePingOverlayHost,
} from '@fieldnotes/core';

/**
 * Map ping ("look here") wiring over battle-map presence. Ping traffic is
 * ephemeral by contract: presence frames only — never elements, undo
 * history, `canvasState`/autosave, or the durable operation queue — and it
 * is room-visible (element `canRead` filtering is unrelated). Pings never
 * move the viewer's camera. Broadcast is role-based product policy: today
 * only DM canvases attach the broadcast side; every synced canvas attaches
 * the receiving side, so enabling player pings later is configuration, not
 * code.
 */

/** The presence surface `createManagedBattleMapConnection` exposes. */
export interface PingPresenceConnection {
  sendPresence: (data: unknown) => void;
  onPresence: (handler: (from: string, data: unknown) => void) => () => void;
  onPresenceLeave: (handler: (from: string) => void) => () => void;
}

/**
 * Broadcasts the local `PingTool`'s accepted taps as ping presence. The tool
 * already rate-limits taps (`minIntervalMs`), and sends while not live are
 * dropped by the connection (never queued), matching the ephemerality
 * contract. Returns unsubscribe.
 */
export function attachPingBroadcast(
  tool: PingTool,
  connection: Pick<PingPresenceConnection, 'sendPresence'>
): () => void {
  return tool.onPing(emission => {
    connection.sendPresence(toPingPresence(emission));
  });
}

/**
 * Renders remote map pings on a synced canvas, whatever tool the viewer
 * holds. The presence `from` (the relay's server-owned connection id) is
 * used purely as an opaque per-sender key; `RemotePingOverlay.apply`
 * validates payloads, so hub pokes (`data.kind === 'poke'`), laser trails
 * (`data.kind === 'laser'`), and any other presence traffic are ignored
 * here and their own handlers stay undisturbed. A sender's pings expire on
 * their own and disappear immediately on presence-leave. Returns a cleanup
 * that unsubscribes and disposes the overlay.
 */
export function attachRemotePings(
  vp: RemotePingOverlayHost,
  connection: Pick<PingPresenceConnection, 'onPresence' | 'onPresenceLeave'>
): () => void {
  const overlay = new RemotePingOverlay(vp);
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
