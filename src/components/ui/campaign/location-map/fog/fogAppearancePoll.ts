import type { Viewport } from '@fieldnotes/core';
import type { ProjectedFogAppearance } from '@/types/battlemap';
import { resolveFogRendererOptions } from './fogAppearance';
import {
  normalizeFogAppearanceProjectionTimestamp,
  parseProjectedFogAppearance,
} from '@/lib/fogOfWar';
import { setViewportFogStyle } from '@/lib/fieldnotesVtt';

const POLL_INTERVAL_MS = 60_000;
const requestVersions = new WeakMap<Viewport, number>();
const appliedProjectionVersions = new WeakMap<Viewport, string>();
const appliedAppearances = new WeakMap<Viewport, ProjectedFogAppearance>();

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
  const appearance = parseProjectedFogAppearance(raw);
  appliedAppearances.set(viewport, appearance);
  setViewportFogStyle(viewport, resolveFogRendererOptions(appearance));
}

/** The last appearance applied to this viewport; Solid until metadata arrives. */
export function getAppliedFogAppearance(
  viewport: Viewport
): ProjectedFogAppearance {
  return appliedAppearances.get(viewport) ?? 'solid';
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
