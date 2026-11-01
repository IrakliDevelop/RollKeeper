import { Viewport, type ViewportOptions } from '@fieldnotes/core';

/**
 * A real @fieldnotes/core `Viewport` in jsdom: a no-op 2D context (jsdom has
 * no canvas), a controllable CSS size for the container, wrapper and canvas,
 * and a captured `ResizeObserver` so tests drive core's own resize path.
 */

type ResizeCallback = () => void;

export interface RealViewportHarness {
  viewport: Viewport;
  container: HTMLDivElement;
  /** The core wrapper element that the core `InputHandler` listens on. */
  wrapper: HTMLElement;
  size: { w: number; h: number };
  /** Changes the CSS size and runs core's ResizeObserver callback. */
  resize(w: number, h: number): void;
  destroy(): void;
}

const contextMethods = new Proxy(
  {},
  {
    get: (_target, key) => {
      // Render frames read the backing size from `ctx.canvas`.
      if (key === 'canvas') return { width: 1000, height: 800 };
      if (key === 'measureText') return () => ({ width: 0 });
      if (key === 'getImageData')
        return () => ({ data: new Uint8ClampedArray(4) });
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return () => ({ addColorStop: () => {} });
      if (key === 'createPattern') return () => null;
      if (key === 'getTransform') return () => new DOMMatrix();
      return () => {};
    },
    set: () => true,
  }
);

let observers: Array<{ callback: ResizeCallback; target: Element | null }> = [];

class CapturedResizeObserver {
  private readonly entry: { callback: ResizeCallback; target: Element | null };
  constructor(callback: ResizeCallback) {
    this.entry = { callback, target: null };
    observers.push(this.entry);
  }
  observe(target: Element) {
    this.entry.target = target;
  }
  unobserve() {}
  disconnect() {
    observers = observers.filter(item => item !== this.entry);
  }
}

let installed: null | (() => void) = null;

/** Installs the canvas context and ResizeObserver doubles (idempotent). */
export function installRealViewportEnvironment(): () => void {
  if (installed) return installed;
  const proto = HTMLCanvasElement.prototype;
  const originalGetContext = proto.getContext;
  proto.getContext = function getContext() {
    return contextMethods as CanvasRenderingContext2D;
  } as unknown as typeof proto.getContext;
  const globals = globalThis as { ResizeObserver?: unknown };
  const originalObserver = globals.ResizeObserver;
  globals.ResizeObserver = CapturedResizeObserver;
  installed = () => {
    proto.getContext = originalGetContext;
    globals.ResizeObserver = originalObserver;
    observers = [];
    installed = null;
  };
  return installed;
}

function sizeElement(element: Element, size: { w: number; h: number }) {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    get: () => size.w,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => size.h,
  });
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: size.w,
        bottom: size.h,
        width: size.w,
        height: size.h,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

/** Mounts a real Viewport into a sized container appended to `parent`. */
export function mountRealViewport(
  options: ViewportOptions = {},
  initial = { w: 1000, h: 800 },
  parent: HTMLElement = document.body
): RealViewportHarness {
  installRealViewportEnvironment();
  const size = { ...initial };
  const container = document.createElement('div');
  sizeElement(container, size);
  parent.appendChild(container);
  const viewport = new Viewport(container, options);
  const wrapper = viewport.domLayer.parentElement as HTMLElement;
  sizeElement(wrapper, size);
  const canvas = wrapper.querySelector('canvas');
  if (canvas) sizeElement(canvas, size);
  return {
    viewport,
    container,
    wrapper,
    size,
    resize(w, h) {
      size.w = w;
      size.h = h;
      for (const entry of [...observers])
        if (entry.target === container) entry.callback();
    },
    destroy() {
      viewport.destroy();
      container.remove();
    },
  };
}
