import {
  PingInput,
  RemotePingOverlay,
  toPingPresence,
  type PingInputHost,
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

/** The receiving side of ping presence plus the overlay it renders through. */
export interface RemotePingHandle {
  /**
   * The overlay every remote sender renders through. Exposed so the DM's own
   * `PingInput` pulses can share it under the `'self'` sender key instead of
   * growing a second drawing path.
   */
  overlay: RemotePingOverlay;
  dispose: () => void;
}

/**
 * Renders remote map pings on a synced canvas, whatever tool the viewer
 * holds. The presence `from` (the relay's server-owned connection id) is
 * used purely as an opaque per-sender key; `RemotePingOverlay.apply`
 * validates payloads, so hub pokes (`data.kind === 'poke'`), laser trails
 * (`data.kind === 'laser'`), and any other presence traffic are ignored
 * here and their own handlers stay undisturbed. A sender's pings expire on
 * their own and disappear immediately on presence-leave. `dispose`
 * unsubscribes and disposes the overlay.
 */
export function attachRemotePings(
  vp: RemotePingOverlayHost,
  connection: Pick<PingPresenceConnection, 'onPresence' | 'onPresenceLeave'>
): RemotePingHandle {
  const overlay = new RemotePingOverlay(vp);
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

/** The sender key `attachPingInput` renders the local DM's pulses under. */
const SELF_SENDER = 'self';

export interface AttachPingInputOptions {
  /** Emission color (the DM accent, matching the `PingTool` registration). */
  color?: string;
  /**
   * Product hotkey for ping-at-cursor (the SDK ships no binding). Ignored
   * while focus is in a form control or contenteditable; modifier chords and
   * key repeat never ping.
   */
  hotkey?: string;
  /** Veto, e.g. exclude the active ping tool to avoid double pings. */
  shouldPing?: () => boolean;
}

/**
 * Always-available DM pings alongside the active tool: long-press (mouse,
 * touch, or pen — `longPressEnabled` opt-in) plus an optional ping-at-cursor
 * hotkey. Emissions broadcast as the same ping presence `attachPingBroadcast`
 * sends AND render locally through the shared receive overlay under the
 * `'self'` key, so local and remote pulses stay pixel-identical. DM-only is
 * call-site policy: only DM canvases attach this. `PingInput` is passive by
 * contract — it never blocks or captures pointers, so tools, panning, and
 * pinch navigation are unaffected. Returns a cleanup.
 */
export function attachPingInput(
  vp: { domLayer: HTMLElement; camera: PingInputHost },
  overlay: RemotePingOverlay,
  connection: Pick<PingPresenceConnection, 'sendPresence'>,
  options: AttachPingInputOptions = {}
): () => void {
  // The wrapper around the canvas stack is the element the Viewport's own
  // input listens on; PingInput needs the same origin for screen coords.
  const element = vp.domLayer.parentElement;
  if (!element) return () => {};

  const input = new PingInput(element, vp.camera, {
    longPressEnabled: true,
    ...(options.color !== undefined ? { color: options.color } : {}),
    ...(options.shouldPing !== undefined
      ? { shouldPing: options.shouldPing }
      : {}),
  });
  const unsubscribe = input.onPing(emission => {
    const presence = toPingPresence(emission);
    connection.sendPresence(presence);
    overlay.apply(SELF_SENDER, presence);
  });

  let removeHotkey: (() => void) | undefined;
  if (options.hotkey !== undefined) {
    const hotkey = options.hotkey.toLowerCase();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== hotkey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }
      input.pingAtPointer();
    };
    document.addEventListener('keydown', onKeyDown);
    removeHotkey = () => document.removeEventListener('keydown', onKeyDown);
  }

  return () => {
    removeHotkey?.();
    unsubscribe();
    input.dispose();
  };
}
