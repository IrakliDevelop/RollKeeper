'use client';

import { createContext, useContext } from 'react';

/** A collapsed DM utility row keeps its controls mounted. Child portals
 * follow its visibility without discarding a draft or an in-flight export. */
export const MapControlsVisibility = createContext<boolean | null>(null);
export const useMapControlsVisible = () =>
  useContext(MapControlsVisibility) ?? true;

export function isMapControlsToggle(target: EventTarget | null) {
  return (
    target instanceof Element && !!target.closest('[data-map-controls-toggle]')
  );
}

export const useMapControlsDock = () =>
  useContext(MapControlsVisibility) !== null;
