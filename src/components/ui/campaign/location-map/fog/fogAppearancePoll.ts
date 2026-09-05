import type { Viewport } from '@fieldnotes/core';
import { parseFogAppearance, resolveFogRendererOptions } from './fogAppearance';
import { normalizeFogAppearanceProjectionTimestamp } from '@/lib/fogOfWar';

const POLL_INTERVAL_MS = 60_000;
const requestVersions = new WeakMap<Viewport, number>();
const appliedProjectionVersions = new WeakMap<Viewport, string>();

interface FogAppearancePollOptions {
  viewport: Viewport;
  url: string;
}

function invalidateFogAppearanceRequests(viewport: Viewport): void {
  requestVersions.set(viewport, (requestVersions.get(viewport) ?? 0) + 1);
}

export function applyFogAppearanceMetadata(
  viewport: Viewport,
  raw: unknown,
  updatedAt: unknown
): void {
  const version = normalizeFogAppearanceProjectionTimestamp(updatedAt);
  const currentVersion = appliedProjectionVersions.get(viewport);
  if (currentVersion && (!version || version < currentVersion)) return;
  if (version) appliedProjectionVersions.set(viewport, version);
  const appearance = parseFogAppearance(raw);
  viewport.setFogStyle(resolveFogRendererOptions(appearance));
}

export function fetchAndApplyFogAppearance(
  viewport: Viewport,
  url: string
): void {
  const requestVersion = (requestVersions.get(viewport) ?? 0) + 1;
  requestVersions.set(viewport, requestVersion);
  void fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (data && typeof data === 'object') {
        if (requestVersions.get(viewport) !== requestVersion) return;
        const metadata = data as {
          fogAppearance?: unknown;
          updatedAt?: unknown;
        };
        applyFogAppearanceMetadata(
          viewport,
          metadata.fogAppearance,
          metadata.updatedAt
        );
      }
    })
    .catch(() => {});
}

export function startFogAppearancePoll(
  opts: FogAppearancePollOptions
): () => void {
  const { viewport, url } = opts;

  const timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetchAndApplyFogAppearance(viewport, url);
  }, POLL_INTERVAL_MS);

  const handleVisibility = (): void => {
    if (!document.hidden) fetchAndApplyFogAppearance(viewport, url);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return () => {
    clearInterval(timer);
    invalidateFogAppearanceRequests(viewport);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}
