import {
  CameraAnimator,
  RemoteFocusReceiver,
  toFocusPresence,
  type CameraAnimatorOptions,
  type CameraView,
  type FocusAudience,
  type FocusRole,
} from '@fieldnotes/core';

/**
 * Camera focus requests ("bring them here") over battle-map presence. Focus
 * traffic is ephemeral by contract: presence frames only — never elements,
 * undo history, `canvasState`/autosave, or the durable operation queue. It is
 * room-visible; `audience` is a delivery hint that receivers honour, not a
 * security boundary (element `canRead` filtering is unrelated and unchanged).
 *
 * Broadcast is DM-only product policy expressed as role-based wiring, and the
 * DM must additionally opt in per session — see `BattleMapViewsControl`.
 */

/** The presence surface `createManagedBattleMapConnection` exposes. */
export interface FocusPresenceConnection {
  sendPresence: (data: unknown) => void;
  onPresence: (handler: (from: string, data: unknown) => void) => () => void;
}

/** The minimum viewport surface focus wiring needs. `Viewport` satisfies it. */
interface FocusViewport {
  camera: ConstructorParameters<typeof CameraAnimator>[1];
  domLayer: HTMLElement;
  getCanvasSize: () => { w: number; h: number };
  registerOverlay: (
    draw: (ctx: CanvasRenderingContext2D) => void
  ) => () => void;
  requestRender: () => void;
}

/**
 * Builds an animator wired to a viewport. The ELEMENT is the wrapper
 * (`domLayer.parentElement`) — the element core input listens on, and the only
 * one a consumer can reach, since `Viewport.container`/`wrapper` are private.
 * It is used for passive cancel listeners ONLY. The SIZE comes from
 * `getCanvasSize()`, which measures the same canvas `getVisibleRect()` does, so
 * captured views round-trip exactly. Two concerns, two sources, deliberately.
 */
export function createLocalCameraAnimator(
  viewport: FocusViewport,
  options?: Partial<Omit<CameraAnimatorOptions, 'getCanvasSize'>>
): CameraAnimator {
  const element = viewport.domLayer.parentElement;
  if (!element) throw new Error('viewport wrapper element unavailable');
  return new CameraAnimator(element, viewport.camera, {
    ...options,
    getCanvasSize: () => viewport.getCanvasSize(),
  });
}

export interface FocusBroadcastHandle {
  send: (view: CameraView, audience: FocusAudience, color?: string) => void;
  dispose: () => void;
}

/**
 * Broadcasts focus requests. Intentionally stateless: the DM's session opt-in
 * gate lives in the UI layer, so there is no handle state to re-apply after a
 * reattach (the hazard the shared-ruler `setSharing` handle has to manage).
 * Sends while not live are dropped by the connection, never queued, matching
 * the ephemerality contract.
 */
export function attachFocusBroadcast(
  connection: Pick<FocusPresenceConnection, 'sendPresence'>
): FocusBroadcastHandle {
  let disposed = false;
  return {
    send: (view, audience, color) => {
      if (disposed) return;
      connection.sendPresence(toFocusPresence(view, audience, color));
    },
    dispose: () => {
      disposed = true;
    },
  };
}

export interface RemoteFocusHandle {
  receiver: RemoteFocusReceiver;
  animator: CameraAnimator;
  dispose: () => void;
}

/**
 * Receives focus requests addressed to this client's role. DM canvases do NOT
 * call this — a DM device is never moved by a focus frame; they use
 * `createLocalCameraAnimator` for the popover's local "go" action instead.
 */
export function attachFocusReceiver(
  viewport: FocusViewport,
  connection: FocusPresenceConnection,
  options: { role: FocusRole; color?: string }
): RemoteFocusHandle {
  const animator = createLocalCameraAnimator(viewport);
  const receiver = new RemoteFocusReceiver(viewport, {
    role: options.role,
    animator,
    ...(options.color === undefined ? {} : { pulseColor: options.color }),
  });
  const unsubscribe = connection.onPresence((from, data) => {
    receiver.apply(from, data);
  });
  return {
    receiver,
    animator,
    dispose: () => {
      unsubscribe();
      receiver.dispose();
      animator.dispose();
    },
  };
}
