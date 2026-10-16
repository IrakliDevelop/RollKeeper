/**
 * PR07 P5 / R3-1 / C7-3: the detectable physical-setup signals. A snapshot
 * is taken at Confirm; while the session verification flag is held the
 * monitor listens to every enumerated signal plus a 1 s poll (no event
 * exists for window moves) and reports the first mismatch once. Size-only
 * changes are not part of the snapshot, so a stable-origin resize is a no-op.
 * Browsers cannot detect every output change — the UI says so.
 */

export interface EnvironmentSnapshot {
  fullscreen: boolean;
  devicePixelRatio: number;
  viewportScale: number | null;
  screenWidth: number;
  screenHeight: number;
  orientation: string | null;
  screenX: number;
  screenY: number;
  /** Shell root (always mounted) origin in CSS px. */
  originLeft: number | null;
  originTop: number | null;
}

export interface EnvironmentHost {
  window: Window;
  document: Document;
}

export const POLL_MS = 1_000;

export function browserEnvironmentHost(): EnvironmentHost {
  return { window, document };
}

type ScreenWithOrientation = {
  width?: number;
  height?: number;
  orientation?: (EventTarget & { type?: string }) | undefined;
};

function screenOf(host: EnvironmentHost): ScreenWithOrientation {
  return (host.window.screen ?? {}) as ScreenWithOrientation;
}

export function readEnvironment(
  host: EnvironmentHost,
  origin: Element | null
): EnvironmentSnapshot {
  const win = host.window;
  const screen = screenOf(host);
  const rect = origin?.getBoundingClientRect() ?? null;
  const scale = win.visualViewport?.scale;
  return {
    fullscreen: !!host.document.fullscreenElement,
    devicePixelRatio: win.devicePixelRatio,
    viewportScale: typeof scale === 'number' ? scale : null,
    screenWidth: screen.width ?? 0,
    screenHeight: screen.height ?? 0,
    orientation: screen.orientation?.type ?? null,
    screenX: win.screenX,
    screenY: win.screenY,
    originLeft: rect ? rect.left : null,
    originTop: rect ? rect.top : null,
  };
}

const KEYS: Array<keyof EnvironmentSnapshot> = [
  'fullscreen',
  'devicePixelRatio',
  'viewportScale',
  'screenWidth',
  'screenHeight',
  'orientation',
  'screenX',
  'screenY',
  'originLeft',
  'originTop',
];

export function sameEnvironment(
  a: EnvironmentSnapshot,
  b: EnvironmentSnapshot
): boolean {
  return KEYS.every(key => Object.is(a[key], b[key]));
}

export interface EnvironmentMonitorOptions {
  host: EnvironmentHost;
  readSnapshot: () => EnvironmentSnapshot;
  baseline: EnvironmentSnapshot;
  /** Called once, on the first mismatch; the monitor then stops itself. */
  onMismatch: () => void;
  pollMs?: number;
}

/** Starts monitoring (re-compares immediately); returns an idempotent disposer. */
export function startEnvironmentMonitor(
  options: EnvironmentMonitorOptions
): () => void {
  const { host, baseline } = options;
  const win = host.window;
  const removers: Array<() => void> = [];
  let disposed = false;
  let poll: ReturnType<typeof setInterval> | null = null;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (poll !== null) clearInterval(poll);
    poll = null;
    for (const remove of removers.splice(0)) remove();
  };
  const check = () => {
    if (disposed) return;
    let current: EnvironmentSnapshot;
    try {
      current = options.readSnapshot();
    } catch {
      return;
    }
    if (sameEnvironment(current, baseline)) return;
    dispose();
    options.onMismatch();
  };
  const listen = (target: EventTarget | null | undefined, type: string) => {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, check);
    removers.push(() => target.removeEventListener(type, check));
  };

  listen(host.document, 'fullscreenchange');
  listen(win, 'resize');
  listen(win, 'orientationchange');
  listen(win.visualViewport, 'resize');
  listen(win.visualViewport, 'scroll');
  listen(screenOf(host).orientation, 'change');
  if (typeof win.matchMedia === 'function') {
    try {
      listen(
        win.matchMedia(`(resolution: ${baseline.devicePixelRatio}dppx)`),
        'change'
      );
    } catch {
      // No media query support: the poll still compares the ratio.
    }
  }
  poll = setInterval(check, options.pollMs ?? POLL_MS);
  check();
  return dispose;
}
