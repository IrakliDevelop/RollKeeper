'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface SheetFloatingStackProps {
  prompt?: ReactNode;
  notifications?: ReactNode;
  mapAccess?: ReactNode;
  toasts: ReactNode;
  onHeightChange: (height: number) => void;
}

export function SheetFloatingStack({
  prompt,
  notifications,
  mapAccess,
  toasts,
  onHeightChange,
}: SheetFloatingStackProps) {
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const measure = () => onHeightChange(stack.getBoundingClientRect().height);
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(stack);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [onHeightChange]);

  return (
    <div
      ref={stackRef}
      data-testid="sheet-floating-stack"
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-96 flex-col gap-2 overflow-y-auto"
    >
      {prompt}
      {notifications && (
        <aside
          aria-label="Campaign notifications"
          className="flex flex-col gap-2"
        >
          {notifications}
        </aside>
      )}
      {mapAccess}
      {toasts}
    </div>
  );
}
