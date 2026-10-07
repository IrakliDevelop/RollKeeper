'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  displayStatusUrl,
  type DisplayStatus,
} from '../display/displayRequests';
import type { DisplayStatusRead } from './TablePresentationControls.types';

const POLL_MS = 5_000;
const READ_TIMEOUT_MS = 5_000;
const STATES = new Set([
  'none',
  'loaded',
  'blank',
  'waiting',
  'updating',
  'stale',
]);

function parse(value: unknown): DisplayStatus | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (typeof body.state !== 'string' || !STATES.has(body.state)) return null;
  return {
    state: body.state as DisplayStatus['state'],
    sceneId: typeof body.sceneId === 'string' ? body.sceneId : null,
    ageMs: typeof body.ageMs === 'number' ? body.ageMs : null,
  };
}

/**
 * PR05 E13: the DM display status read (holder and non-holder alike),
 * every 5 s with one request in flight and a 5 s abort, aborted on
 * unmount; `refresh()` re-reads at once (after a committed presentation
 * command or Open display).
 */
export function useTableDisplayStatus(campaignCode: string, dmId: string) {
  const [status, setStatus] = useState<DisplayStatusRead | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const pendingRefresh = useRef(false);

  const read = useCallback(
    async (refresh = false): Promise<void> => {
      if (inFlight.current) {
        // A poll tick skips; an explicit refresh re-reads after it settles.
        if (refresh) pendingRefresh.current = true;
        return;
      }
      const abort = new AbortController();
      inFlight.current = abort;
      const timeout = setTimeout(() => abort.abort(), READ_TIMEOUT_MS);
      try {
        const response = await fetch(displayStatusUrl(campaignCode, dmId), {
          cache: 'no-store',
          signal: abort.signal,
        });
        const parsed = response.ok ? parse(await response.json()) : null;
        if (mounted.current && !abort.signal.aborted)
          setStatus(parsed ?? 'error');
      } catch {
        if (mounted.current && !abort.signal.aborted) setStatus('error');
      } finally {
        clearTimeout(timeout);
        if (inFlight.current === abort) inFlight.current = null;
        if (pendingRefresh.current && mounted.current) {
          pendingRefresh.current = false;
          void read();
        }
      }
    },
    [campaignCode, dmId]
  );

  useEffect(() => {
    mounted.current = true;
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      // A1: an aborted read must not block the next mount (StrictMode).
      inFlight.current?.abort();
      inFlight.current = null;
      pendingRefresh.current = false;
    };
  }, [read]);

  const refresh = useCallback(() => void read(true), [read]);
  return { status, refresh };
}
