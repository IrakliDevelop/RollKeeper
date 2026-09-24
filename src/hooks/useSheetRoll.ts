import { useCallback, useRef } from 'react';
import { rollD20, type D20RollDeps } from '@/utils/sheetRoll';

/** Stable d20 roller for sheet surfaces (full sheet page, map sheet drawer). */
export function useSheetRoll(deps: D20RollDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  return useCallback(
    (label: string, modifier: number) =>
      rollD20(depsRef.current, label, modifier),
    []
  );
}
