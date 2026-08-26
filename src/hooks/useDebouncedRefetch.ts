import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_WINDOW_MS = 1000;

/**
 * Generic leading+trailing debounce for refetch-style callbacks (e.g. relay
 * poke handlers fanning out to a heavy fetch). Mirrors the semantics of
 * `useDmVttPlayersRefresh`'s debounce: the first call in a window fires
 * `fn` immediately (leading edge); any call landing inside the window
 * coalesces into exactly ONE trailing call fired at window expiry instead
 * of being dropped — otherwise the last call of a burst (e.g. one poke per
 * party member autosave) would leave state stale until the next poll. A
 * latest-value ref on `fn` ensures the trailing call always invokes the
 * most recent callback identity, even if it changes mid-window. Pending
 * timeout is cleared on unmount.
 */
export function useDebouncedRefetch(
  fn: () => void,
  windowMs: number = DEFAULT_WINDOW_MS
): () => void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const lastFireRef = useRef(0);
  const trailingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastFireRef.current;
    if (elapsed >= windowMs) {
      lastFireRef.current = now;
      fnRef.current();
      return;
    }
    if (trailingTimeoutRef.current) return;
    trailingTimeoutRef.current = setTimeout(() => {
      trailingTimeoutRef.current = null;
      lastFireRef.current = Date.now();
      fnRef.current();
    }, windowMs - elapsed);
  }, [windowMs]);

  useEffect(() => {
    return () => {
      if (trailingTimeoutRef.current) {
        clearTimeout(trailingTimeoutRef.current);
        trailingTimeoutRef.current = null;
      }
    };
  }, []);

  return trigger;
}
