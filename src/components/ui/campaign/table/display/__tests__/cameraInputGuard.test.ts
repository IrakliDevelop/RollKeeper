import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachCameraInputGuard,
  type CameraInputMode,
} from '../calibration/cameraInputGuard';

/** PR07 R3-2 / C7-3 guard unit cases (review 01 F2 GUARD_TOUCH, F3). */

let container: HTMLDivElement;
let target: HTMLDivElement;
let mode: CameraInputMode;
let dispose: () => void;
let reached: string[];

function touch(type: string, touches: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: Array.from({ length: touches }, () => ({})),
  });
  target.dispatchEvent(event);
  return event;
}
function pointer(type: string, pointerId: number) {
  const event = new PointerEvent(type, {
    pointerId,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  container = document.createElement('div');
  target = document.createElement('div');
  container.append(target);
  document.body.append(container);
  reached = [];
  for (const type of [
    'touchstart',
    'touchmove',
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'lostpointercapture',
  ])
    target.addEventListener(type, event =>
      reached.push(`${type}:${(event as PointerEvent).pointerId ?? ''}`)
    );
  mode = 'pan-only';
  dispose = attachCameraInputGuard(container, () => mode);
});
afterEach(() => {
  dispose();
  container.remove();
  cleanup();
  vi.restoreAllMocks();
});

describe('multi-touch guard (GUARD_TOUCH)', () => {
  it('pan-only swallows multi-touch touchstart/touchmove and passes one finger', () => {
    expect(touch('touchstart', 2).defaultPrevented).toBe(true);
    expect(touch('touchmove', 2).defaultPrevented).toBe(true);
    expect(touch('touchstart', 1).defaultPrevented).toBe(false);
    expect(touch('touchmove', 1).defaultPrevented).toBe(false);
    expect(reached).toEqual(['touchstart:', 'touchmove:']);
  });

  it('frozen swallows every touch; free passes multi-touch', () => {
    mode = 'frozen';
    expect(touch('touchstart', 1).defaultPrevented).toBe(true);
    mode = 'free';
    expect(touch('touchstart', 2).defaultPrevented).toBe(false);
    expect(reached).toEqual(['touchstart:']);
  });
});

describe('frozen end events (review 01 F3)', () => {
  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'lets %s through for a pointer that went down before the freeze, still swallowing its moves',
    end => {
      pointer('pointerdown', 1);
      mode = 'frozen';
      pointer('pointermove', 1);
      pointer(end, 1);
      // A pointer that went down while frozen stays swallowed end to end.
      pointer('pointerdown', 2);
      pointer(end, 2);
      expect(reached).toEqual(['pointerdown:1', `${end}:1`]);
    }
  );
});
