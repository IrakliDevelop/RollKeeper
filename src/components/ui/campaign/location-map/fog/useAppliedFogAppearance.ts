'use client';

import { useMemo } from 'react';
import type { FogAppearance } from '@/types/battlemap';
import { fogAppearanceFingerprint } from '@/lib/fogOfWar';
import { parseFogAppearance } from './fogAppearance';

/**
 * Parses the stored map/location value once per raw reference so effects that
 * depend on the result do not fire (or clobber an open draft preview) on every
 * render. Zustand only changes the raw reference when the field changes.
 */
export function useAppliedFogAppearance(
  raw: unknown,
  enabled: boolean
): { appearance: FogAppearance; fingerprint: string } {
  return useMemo(() => {
    const appearance: FogAppearance = enabled
      ? parseFogAppearance(raw)
      : 'solid';
    return { appearance, fingerprint: fogAppearanceFingerprint(appearance) };
  }, [raw, enabled]);
}
