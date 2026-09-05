import type { Viewport } from '@fieldnotes/core';
import type { FogAppearanceV1 } from '@/types/battlemap';
import { parseFogAppearance } from './fogAppearance';
import { resolveFogRendererOptions } from './fogAppearance';

const POLL_INTERVAL_MS = 60_000;

interface FogAppearancePollOptions {
  viewport: Viewport;
  url: string;
}

function applyFogAppearance(viewport: Viewport, raw: unknown): void {
  const appearance = parseFogAppearance(raw);
  viewport.setFogStyle(resolveFogRendererOptions(appearance));
}

export function fetchAndApplyFogAppearance(
  viewport: Viewport,
  url: string
): void {
  void fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (data && typeof data === 'object' && 'fogAppearance' in data) {
        applyFogAppearance(
          viewport,
          (data as { fogAppearance: unknown }).fogAppearance
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
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}
