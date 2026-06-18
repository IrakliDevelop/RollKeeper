import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/**
 * Clamp a dragged vertical position so the element stays on screen.
 * Pure — exported for unit testing.
 */
export function clampTop(
  startTop: number,
  dy: number,
  innerHeight: number,
  bottomMargin = 120,
  topMargin = 8
): number {
  return Math.max(
    topMargin,
    Math.min(startTop + dy, innerHeight - bottomMargin)
  );
}

interface DraggableY<T extends HTMLElement> {
  topPx: number | null; // null => not yet positioned (use the component's default)
  containerRef: React.RefObject<T | null>;
  startDrag: (e: ReactPointerEvent) => void;
}

/**
 * Vertical-only drag positioning for a fixed-position panel, persisted to
 * localStorage. Returns `topPx: null` until a stored value loads or the user
 * drags, so the consumer can keep its own default placement (e.g. centered)
 * until then. Attach `containerRef` to the panel and `startDrag` to its handle.
 */
export function useDraggableY<T extends HTMLElement = HTMLDivElement>(
  storageKey: string
): DraggableY<T> {
  const [topPx, setTopPx] = useState<number | null>(null);
  const containerRef = useRef<T | null>(null);
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setTopPx(Number(stored));
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    setTopPx(clampTop(dragRef.current.startTop, dy, window.innerHeight));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    setTopPx(t => {
      if (t !== null) {
        try {
          localStorage.setItem(storageKey, String(t));
        } catch {
          // Ignore localStorage errors
        }
      }
      return t;
    });
  }, [handlePointerMove, storageKey]);

  const startDrag = useCallback(
    (e: ReactPointerEvent) => {
      const startTop =
        topPx ?? containerRef.current?.getBoundingClientRect().top ?? 0;
      dragRef.current = { startY: e.clientY, startTop };
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [topPx, handlePointerMove, handlePointerUp]
  );

  // Clean up listeners if unmounted mid-drag.
  useEffect(
    () => () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp]
  );

  return { topPx, containerRef, startDrag };
}
