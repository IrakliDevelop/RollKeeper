'use client';

import { useEffect, useRef } from 'react';
import type { FogAppearance } from '@/types/battlemap';
import {
  fogAppearanceFingerprint,
  toProjectedFogAppearance,
} from '@/lib/fogOfWar';

interface FogAppearanceProjectionInput {
  enabled: boolean;
  campaignCode: string;
  battleMapId: string;
  dmId: string;
  appearance: FogAppearance;
  onError?: (error: Error) => void;
}

export async function writeFogAppearanceProjection(
  input: Omit<FogAppearanceProjectionInput, 'enabled' | 'onError'>
): Promise<void> {
  const response = await fetch(
    `/api/campaign/${encodeURIComponent(input.campaignCode)}/battlemaps/${encodeURIComponent(input.battleMapId)}/fog-appearance`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-rollkeeper-csrf': '1',
      },
      body: JSON.stringify({
        dmId: input.dmId,
        appearance: toProjectedFogAppearance(input.appearance),
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Fog appearance projection failed (${response.status})`);
  }
}

/**
 * Publishes the local DM preference on mount and after every change. Writes are
 * serialized so a slow earlier response cannot overwrite the last selection.
 * Remounting retries the current local value after a prior network failure.
 */
export function useFogAppearanceProjection(
  input: FogAppearanceProjectionInput
): void {
  const { enabled, campaignCode, battleMapId, dmId, appearance, onError } =
    input;
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const lastQueuedRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  const mountedRef = useRef(true);
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const fingerprint = fogAppearanceFingerprint(appearance);

  useEffect(() => {
    if (!enabled) return;

    const key = [campaignCode, battleMapId, dmId, fingerprint].join(' ');
    if (lastQueuedRef.current === key) return;
    lastQueuedRef.current = key;

    queueRef.current = queueRef.current
      .then(() =>
        writeFogAppearanceProjection({
          campaignCode,
          battleMapId,
          dmId,
          appearance: appearanceRef.current,
        })
      )
      .catch(error => {
        if (!mountedRef.current) return;
        onErrorRef.current?.(
          error instanceof Error
            ? error
            : new Error('Fog appearance projection failed')
        );
      });
  }, [fingerprint, battleMapId, campaignCode, dmId, enabled]);
}
