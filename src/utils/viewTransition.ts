/**
 * Runs `update` inside a view transition so the layout change animates.
 * Falls back to a plain update where the browser has no view transitions or
 * the user prefers reduced motion. `update` must apply its DOM change
 * synchronously (wrap React state updates in `flushSync`).
 */
export function withViewTransition(update: () => void): void {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }
  document.startViewTransition(update);
}
