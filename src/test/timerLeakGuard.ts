import { expect } from 'vitest';

/**
 * CI leak guard: every interval, and every timeout of 5 s or longer, created
 * by a test must be cleared once the test's trees are unmounted — a live
 * one fires after this file's jsdom is gone and crashes React in a later
 * file of the same worker.
 */
const realTimers = {
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};
const liveTimers = new Set<unknown>();
export function trackTimers() {
  liveTimers.clear();
  globalThis.setInterval = ((handler: () => void, delay?: number) => {
    const id = realTimers.setInterval(handler, delay);
    liveTimers.add(id);
    return id;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id: Parameters<typeof clearInterval>[0]) => {
    liveTimers.delete(id);
    realTimers.clearInterval(id);
  }) as typeof clearInterval;
  globalThis.setTimeout = ((handler: () => void, delay?: number) => {
    const id = realTimers.setTimeout(() => {
      liveTimers.delete(id);
      handler();
    }, delay);
    if ((delay ?? 0) >= 5_000) liveTimers.add(id);
    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: Parameters<typeof clearTimeout>[0]) => {
    liveTimers.delete(id);
    realTimers.clearTimeout(id);
  }) as typeof clearTimeout;
}
export function expectNoLiveTimers() {
  const live = liveTimers.size;
  Object.assign(globalThis, realTimers);
  expect(live, 'timers left running after the test').toBe(0);
}
