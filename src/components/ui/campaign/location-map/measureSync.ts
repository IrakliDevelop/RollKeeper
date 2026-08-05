import {
  RemoteMeasureOverlay,
  toMeasurePresence,
  type MeasureTool,
  type RemoteMeasureOverlayHost,
} from '@fieldnotes/core';

/**
 * Shared-ruler wiring over battle-map presence. Measure traffic is ephemeral
 * by contract: presence frames only — never elements, undo history,
 * `canvasState`/autosave, or the durable operation queue — and it is
 * room-visible (element `canRead` filtering is unrelated). Broadcast is
 * role-based product policy: today only DM canvases attach the broadcast
 * side; every synced canvas attaches the receiving side, so enabling player
 * rulers later is configuration, not code.
 */

/** The presence surface `createManagedBattleMapConnection` exposes. */
export interface MeasurePresenceConnection {
  sendPresence: (data: unknown) => void;
  onPresence: (handler: (from: string, data: unknown) => void) => () => void;
  onPresenceLeave: (handler: (from: string) => void) => () => void;
}

export interface MeasureBroadcastHandle {
  /**
   * Push-based sharing switch. Turning sharing off sends one cleared frame
   * immediately when the last broadcast frame was an active measurement — a
   * pull-based check could not react while the pointer is stationary, and a
   * remote ruler must never stick after the DM goes private.
   */
  setSharing(enabled: boolean): void;
  dispose(): void;
}

/**
 * Broadcasts the local `MeasureTool`'s per-frame coalesced measurement
 * emissions as shared-ruler presence, gated by `setSharing`. Sends while not
 * sharing (or not live) are dropped by the connection (never queued),
 * matching the ephemerality contract.
 */
export function attachMeasureBroadcast(
  tool: MeasureTool,
  connection: Pick<MeasurePresenceConnection, 'sendPresence'>
): MeasureBroadcastHandle {
  let sharing = false;
  let lastFrameActive = false;
  let disposed = false;

  const sendClearIfActive = () => {
    if (!lastFrameActive) return;
    lastFrameActive = false;
    connection.sendPresence(toMeasurePresence(null));
  };

  const unsubscribe = tool.onMeasurement(emission => {
    if (disposed || !sharing) return;
    connection.sendPresence(toMeasurePresence(emission));
    lastFrameActive = emission !== null;
  });

  return {
    setSharing(enabled: boolean) {
      if (disposed || sharing === enabled) return;
      sharing = enabled;
      if (!enabled) sendClearIfActive();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      sendClearIfActive();
    },
  };
}

/** The receiving side of measure presence plus the overlay it renders through. */
export interface RemoteMeasureHandle {
  overlay: RemoteMeasureOverlay;
  dispose: () => void;
}

/**
 * Renders remote shared-ruler measurements on a synced canvas, whatever tool
 * the viewer holds. The presence `from` (the relay's server-owned connection
 * id) is used purely as an opaque per-sender key; `RemoteMeasureOverlay.apply`
 * validates payloads, so hub pokes (`data.kind === 'poke'`), laser trails
 * (`data.kind === 'laser'`), map pings (`data.kind === 'ping'`), and any
 * other presence traffic are ignored here and their own handlers stay
 * undisturbed. A sender's ruler disappears on fade and immediately on
 * presence-leave. `dispose` unsubscribes and disposes the overlay.
 */
export function attachRemoteMeasurements(
  vp: RemoteMeasureOverlayHost,
  connection: Pick<MeasurePresenceConnection, 'onPresence' | 'onPresenceLeave'>
): RemoteMeasureHandle {
  const overlay = new RemoteMeasureOverlay(vp);
  const unsubscribePresence = connection.onPresence((from, data) => {
    overlay.apply(from, data);
  });
  const unsubscribeLeave = connection.onPresenceLeave(from => {
    overlay.remove(from);
  });
  return {
    overlay,
    dispose: () => {
      unsubscribePresence();
      unsubscribeLeave();
      overlay.dispose();
    },
  };
}
