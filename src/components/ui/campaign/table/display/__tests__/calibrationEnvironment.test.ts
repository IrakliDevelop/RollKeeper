import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoLiveTimers, trackTimers } from '@/test/timerLeakGuard';
import {
  readEnvironment,
  sameEnvironment,
  startEnvironmentMonitor,
  type EnvironmentHost,
} from '../calibration/environment';

/**
 * P5 detection with an injected environment: every enumerated signal, the
 * 1 s poll for window and origin moves, size-only no-ops, and disposal.
 */

interface FakeHost {
  host: EnvironmentHost;
  win: EventTarget & Record<string, unknown>;
  doc: EventTarget & Record<string, unknown>;
  viewport: EventTarget & { scale: number };
  orientation: EventTarget & { type: string };
  queries: Array<EventTarget & { media: string }>;
  origin: { left: number; top: number };
  element: Element;
  listeners(): number;
}

function fakeHost(): FakeHost {
  let live = 0;
  const counted = <T extends EventTarget>(target: T): T => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = ((...args: Parameters<typeof add>) => {
      live += 1;
      add(...args);
    }) as typeof add;
    target.removeEventListener = ((...args: Parameters<typeof remove>) => {
      live -= 1;
      remove(...args);
    }) as typeof remove;
    return target;
  };
  const viewport = counted(Object.assign(new EventTarget(), { scale: 1 }));
  const orientation = counted(
    Object.assign(new EventTarget(), { type: 'landscape-primary' })
  );
  const queries: FakeHost['queries'] = [];
  const doc = counted(
    Object.assign(new EventTarget(), {
      fullscreenElement: {} as Element | null,
    })
  );
  const win = counted(
    Object.assign(new EventTarget(), {
      devicePixelRatio: 1,
      screenX: 1920,
      screenY: 0,
      innerWidth: 1920,
      innerHeight: 1080,
      visualViewport: viewport,
      screen: { width: 1920, height: 1080, orientation },
      matchMedia: (media: string) => {
        const query = counted(Object.assign(new EventTarget(), { media }));
        queries.push(query);
        return query;
      },
    })
  );
  const origin = { left: 0, top: 0 };
  const element = {
    getBoundingClientRect: () => ({ left: origin.left, top: origin.top }),
  } as unknown as Element;
  return {
    host: {
      window: win as unknown as Window,
      document: doc as unknown as Document,
    },
    win: win as unknown as FakeHost['win'],
    doc: doc as unknown as FakeHost['doc'],
    viewport,
    orientation,
    queries,
    origin,
    element,
    listeners: () => live,
  };
}

let fake: FakeHost;
let dispose: (() => void) | null;
let onMismatch: ReturnType<typeof vi.fn<() => void>>;

function start() {
  const baseline = readEnvironment(fake.host, fake.element);
  dispose = startEnvironmentMonitor({
    host: fake.host,
    readSnapshot: () => readEnvironment(fake.host, fake.element),
    baseline,
    onMismatch,
  });
  return baseline;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake = fakeHost();
  dispose = null;
  onMismatch = vi.fn<() => void>();
});
afterEach(() => {
  dispose?.();
  cleanup();
  vi.useRealTimers();
});

describe('environment snapshot', () => {
  it('records every enumerated field and compares exactly', () => {
    const snapshot = readEnvironment(fake.host, fake.element);
    expect(snapshot).toEqual({
      fullscreen: true,
      devicePixelRatio: 1,
      viewportScale: 1,
      screenWidth: 1920,
      screenHeight: 1080,
      orientation: 'landscape-primary',
      screenX: 1920,
      screenY: 0,
      originLeft: 0,
      originTop: 0,
    });
    expect(sameEnvironment(snapshot, { ...snapshot })).toBe(true);
    expect(sameEnvironment(snapshot, { ...snapshot, screenY: 1 })).toBe(false);
  });

  it('tolerates hosts without visualViewport, orientation or an origin element', () => {
    delete fake.win.visualViewport;
    (fake.win.screen as Record<string, unknown>).orientation = undefined;
    const snapshot = readEnvironment(fake.host, null);
    expect(snapshot.viewportScale).toBeNull();
    expect(snapshot.orientation).toBeNull();
    expect(snapshot.originLeft).toBeNull();
  });
});

describe('invalidation signals (P5)', () => {
  const signals: Array<[string, (host: FakeHost) => void]> = [
    [
      'fullscreenchange',
      host => {
        host.doc.fullscreenElement = null;
        host.doc.dispatchEvent(new Event('fullscreenchange'));
      },
    ],
    [
      'devicePixelRatio change',
      host => {
        host.win.devicePixelRatio = 2;
        host.queries.at(-1)!.dispatchEvent(new Event('change'));
      },
    ],
    [
      'visualViewport scale (pinch / browser zoom)',
      host => {
        host.viewport.scale = 1.25;
        host.viewport.dispatchEvent(new Event('resize'));
      },
    ],
    [
      'screen size',
      host => {
        (host.win.screen as Record<string, unknown>).width = 2560;
        host.win.dispatchEvent(new Event('resize'));
      },
    ],
    [
      'screen orientation',
      host => {
        host.orientation.type = 'portrait-primary';
        host.orientation.dispatchEvent(new Event('change'));
      },
    ],
    [
      'legacy orientationchange',
      host => {
        host.orientation.type = 'portrait-primary';
        host.win.dispatchEvent(new Event('orientationchange'));
      },
    ],
  ];

  it.each(signals)('%s → mismatch at once', (_name, fire) => {
    start();
    expect(fake.queries.at(-1)!.media).toBe('(resolution: 1dppx)');
    fire(fake);
    expect(onMismatch).toHaveBeenCalledTimes(1);
    // One-shot: later signals do not repeat it.
    fake.win.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(3_000);
    expect(onMismatch).toHaveBeenCalledTimes(1);
  });

  it('window move (screenX/screenY) is caught by the 1 s poll', () => {
    start();
    fake.win.screenX = 0;
    vi.advanceTimersByTime(999);
    expect(onMismatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMismatch).toHaveBeenCalledTimes(1);
  });

  it('canvas origin move is caught by the 1 s poll', () => {
    start();
    fake.origin.left = 12;
    vi.advanceTimersByTime(1_000);
    expect(onMismatch).toHaveBeenCalledTimes(1);
  });

  it('size-only window resize and same-scale visualViewport scroll are no-ops', () => {
    start();
    fake.win.innerWidth = 1200;
    fake.win.innerHeight = 700;
    fake.win.dispatchEvent(new Event('resize'));
    fake.viewport.dispatchEvent(new Event('scroll'));
    fake.viewport.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(5_000);
    expect(onMismatch).not.toHaveBeenCalled();
  });

  it('re-compares immediately when listeners are (re)registered', () => {
    const baseline = readEnvironment(fake.host, fake.element);
    fake.doc.fullscreenElement = null;
    dispose = startEnvironmentMonitor({
      host: fake.host,
      readSnapshot: () => readEnvironment(fake.host, fake.element),
      baseline,
      onMismatch,
    });
    expect(onMismatch).toHaveBeenCalledTimes(1);
  });

  it('disposes every listener', () => {
    const before = fake.listeners();
    start();
    expect(fake.listeners()).toBeGreaterThan(before);
    dispose!();
    dispose = null;
    expect(fake.listeners()).toBe(before);
  });
});

describe('timer discipline', () => {
  it('leaves no live poll interval after dispose', () => {
    vi.useRealTimers();
    trackTimers();
    try {
      start();
      dispose!();
      dispose = null;
    } finally {
      expectNoLiveTimers();
    }
  });
});
