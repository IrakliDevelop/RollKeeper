/** Dev/test-only: exposes zustand stores on window for Playwright e2e.
 * Guarded so production builds never attach anything. */
export function exposeStoreForE2E(name: string, store: unknown): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production') return;
  const w = window as unknown as { __rkStores?: Record<string, unknown> };
  w.__rkStores = { ...w.__rkStores, [name]: store };
}
