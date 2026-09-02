import { RemotePathOverlay, toPathPresence } from '@fieldnotes/core';

import { movableTokenIdentity } from './tokenIdentity';

import type {
  CanvasElement,
  PathEmission,
  PathTool,
  RemotePathOverlayHost,
} from '@fieldnotes/core';

/**
 * Movement-path presence wiring. Path traffic is ephemeral by contract:
 * presence frames only — never elements, undo history, canvasState/autosave,
 * or the durable operation queue — and it is room-visible (element canRead
 * filtering is unrelated). The DM-only gate below is therefore HOST-side
 * and fail-closed: a DM-only anchor's path never leaves this client, and a
 * path whose anchor TURNS DM-only mid-gesture is cleared remotely at the
 * next emission. Broadcast policy (spec decision 5): player self-paths
 * always broadcast; DM paths obey a session share toggle (default OFF).
 */

/** The presence surface `createManagedBattleMapConnection` exposes. */
export interface PathPresenceConnection {
  sendPresence: (data: unknown) => void;
  onPresence: (handler: (from: string, data: unknown) => void) => () => void;
  onPresenceLeave: (handler: (from: string) => void) => () => void;
}

export interface PathBroadcastHandle {
  /** Push-based, like the shared ruler: turning sharing off mid-path sends
   * one cleared frame immediately — a remote path must never stick. */
  setSharing(enabled: boolean): void;
  dispose(): void;
}

export function attachPathBroadcast(
  tool: Pick<PathTool, 'onPath'>,
  connection: Pick<PathPresenceConnection, 'sendPresence'>,
  options: {
    role: 'dm' | 'player';
    /** Live reads against current product/store state, PER EMISSION. */
    isDmOnlyElement: (elementId: string) => boolean;
    getElement: (elementId: string) => CanvasElement | null;
  }
): PathBroadcastHandle {
  let sharing = options.role === 'player';
  let lastFrameActive = false;
  let disposed = false;

  const sendClearIfActive = () => {
    if (!lastFrameActive) return;
    lastFrameActive = false;
    connection.sendPresence(toPathPresence(null));
  };

  /**
   * Fail-closed anchor gate, evaluated per emission: the anchor key must be
   * present, the element must still exist in the live store, must still be
   * a movable token (not deleted-and-replaced by something else under the
   * same id, not retyped), and must not be DM-only. Any failure suppresses
   * the frame and clears the remote path if one was showing.
   */
  const anchorBroadcastable = (emission: PathEmission): boolean => {
    const key = emission.anchorKey;
    if (key === undefined) return false;
    const el = options.getElement(key);
    if (!el || movableTokenIdentity(el) === null) return false;
    return !options.isDmOnlyElement(key);
  };

  const unsubscribe = tool.onPath((emission: PathEmission | null) => {
    if (disposed) return;
    const broadcastable =
      emission !== null && sharing && anchorBroadcastable(emission);
    if (!broadcastable) {
      sendClearIfActive();
      return;
    }
    connection.sendPresence(toPathPresence(emission));
    lastFrameActive = true;
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

/** The receiving side plus the overlay it renders through. */
export interface RemotePathHandle {
  overlay: RemotePathOverlay;
  dispose: () => void;
}

/**
 * Renders remote movement paths on a synced canvas, whatever tool the
 * viewer holds. `RemotePathOverlay.apply` validates payloads, so every
 * other presence kind (poke/laser/ping/measure/focus) is ignored here and
 * their own handlers stay undisturbed. A sender's path disappears on
 * hold+fade after its cleared frame and immediately on presence-leave.
 */
export function attachRemotePaths(
  vp: RemotePathOverlayHost,
  connection: Pick<PathPresenceConnection, 'onPresence' | 'onPresenceLeave'>
): RemotePathHandle {
  const overlay = new RemotePathOverlay(vp);
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
