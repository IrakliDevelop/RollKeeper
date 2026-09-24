'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Keep tools in view when a mobile keyboard or page zoom pans the viewport. */
export function PlayerMapToolControls({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={ref}
      data-testid="player-map-tool-controls"
      className="pointer-events-none fixed top-3 left-1/2 z-20 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-1"
    >
      {children}
    </div>
  );
}
