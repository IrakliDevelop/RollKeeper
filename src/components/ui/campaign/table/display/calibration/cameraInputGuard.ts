import type { CalibrationReport } from './session';

/**
 * PR07 P7 / R3-2 / C7-3: camera input policy on the display canvas.
 *
 * - `free` (uncalibrated / unsupported): PR05 behaviour, nothing blocked.
 * - `pan-only` (verified): one-pointer HandTool pan only. Wheel (incl.
 *   ctrl+wheel trackpad pinch), Safari `gesture*`, multi-touch and any
 *   second concurrent pointer are swallowed before core sees them; moves
 *   of pointers this guard did not let down are swallowed too.
 * - `frozen` (verify-required): every pointer, wheel, gesture and touch
 *   event is swallowed, except the end event of a pointer that went down
 *   before the freeze (so core ends that gesture).
 *
 * Listeners are capture-phase on an ancestor of the core wrapper, so they
 * run before core's InputHandler (bubble/target phase on the wrapper).
 * Keyboard zoom/fit shortcuts are disabled separately (`viewport.shortcuts`).
 */

export type CameraInputMode = 'free' | 'pan-only' | 'frozen';

export const CAMERA_ZOOM_SHORTCUTS = [
  'view.zoom-in',
  'view.zoom-out',
  'view.zoom-reset',
  'view.zoom-to-fit',
] as const;

export function cameraInputMode(report: CalibrationReport): CameraInputMode {
  if (report === 'verified') return 'pan-only';
  if (report === 'verify-required') return 'frozen';
  return 'free';
}

const POINTER_END = ['pointerup', 'pointercancel', 'lostpointercapture'];
const BLOCKED_WHEN_LOCKED = [
  'wheel',
  'gesturestart',
  'gesturechange',
  'gestureend',
];

export function attachCameraInputGuard(
  container: HTMLElement,
  getMode: () => CameraInputMode
): () => void {
  /** Pointers this guard let down and that have not ended. */
  const active = new Set<number>();
  /** Pointers this guard swallowed on down (until they end). */
  const blocked = new Set<number>();
  const swallow = (event: Event) => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
  };

  const onLocked = (event: Event) => {
    if (getMode() !== 'free') swallow(event);
  };
  const onTouch = (event: Event) => {
    const mode = getMode();
    const touches = (event as TouchEvent).touches?.length ?? 0;
    if (mode === 'frozen' || (mode === 'pan-only' && touches > 1))
      swallow(event);
  };
  const onDown = (event: Event) => {
    const { pointerId } = event as PointerEvent;
    const mode = getMode();
    if (
      mode === 'frozen' ||
      (mode === 'pan-only' && active.size > 0 && !active.has(pointerId))
    ) {
      blocked.add(pointerId);
      swallow(event);
      return;
    }
    active.add(pointerId);
  };
  const onMove = (event: Event) => {
    const { pointerId } = event as PointerEvent;
    const mode = getMode();
    if (mode === 'frozen' || blocked.has(pointerId)) swallow(event);
    else if (mode === 'pan-only' && !active.has(pointerId)) swallow(event);
  };
  const onEnd = (event: Event) => {
    const { pointerId } = event as PointerEvent;
    const wasBlocked = blocked.delete(pointerId);
    const wasActive = active.delete(pointerId);
    // Review 01 F3: a pointer let down before a freeze must still end its
    // core gesture (its moves stay swallowed, so the camera cannot move);
    // otherwise core stays mid-drag and a later hover would pan.
    if (wasBlocked || (getMode() === 'frozen' && !wasActive)) swallow(event);
  };

  const listeners: Array<[string, (event: Event) => void]> = [
    ...BLOCKED_WHEN_LOCKED.map(
      type => [type, onLocked] as [string, (event: Event) => void]
    ),
    ['touchstart', onTouch],
    ['touchmove', onTouch],
    ['pointerdown', onDown],
    ['pointermove', onMove],
    ...POINTER_END.map(
      type => [type, onEnd] as [string, (event: Event) => void]
    ),
  ];
  const options = { capture: true, passive: false } as const;
  for (const [type, listener] of listeners)
    container.addEventListener(type, listener, options);
  return () => {
    for (const [type, listener] of listeners)
      container.removeEventListener(type, listener, options);
    active.clear();
    blocked.clear();
  };
}
