'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const PANEL_TOP_VAR = '--player-vtt-panel-top';

/** Publish the measured block's bottom edge plus a 12px gap. */
function publishPanelTop(measured: HTMLElement | null) {
  if (!measured) return;
  document.documentElement.style.setProperty(
    PANEL_TOP_VAR,
    `${Math.ceil(measured.getBoundingClientRect().bottom + 12)}px`
  );
}

/**
 * Keep tools in view when a mobile keyboard or page zoom pans the viewport.
 * `children` is the island plus the movement strip: its bottom edge is
 * published as `--player-vtt-panel-top` so the side panels sit under it.
 * `footer` (the casting banner) hangs below, outside that measurement.
 */
export function PlayerMapToolControls({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const measuredRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const element = ref.current;
    if (!viewport || !element) return;

    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      element.style.top = `calc(${viewport.offsetTop}px + 0.75rem)`;
      element.style.left = `${viewport.offsetLeft + viewport.width / 2}px`;
      element.style.maxWidth = `calc(${viewport.width}px - 1.5rem)`;
      publishPanelTop(measuredRef.current);
    };
    const scheduleUpdate = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };

    update();
    viewport.addEventListener('resize', scheduleUpdate);
    viewport.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', scheduleUpdate);
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    const measured = measuredRef.current;
    if (!measured) return;
    const updatePanelTop = () => publishPanelTop(measured);
    updatePanelTop();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePanelTop);
    observer?.observe(measured);
    window.addEventListener('resize', updatePanelTop);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePanelTop);
      document.documentElement.style.removeProperty(PANEL_TOP_VAR);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="player-map-tool-controls"
      className="pointer-events-none fixed top-3 left-1/2 z-20 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2"
    >
      <div
        ref={measuredRef}
        className="flex w-full max-w-full min-w-0 flex-col items-center gap-2"
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
