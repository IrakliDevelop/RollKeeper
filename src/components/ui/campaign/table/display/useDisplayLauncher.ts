'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OpenTableDisplayResult } from '@/lib/openTableDisplay';

/**
 * PR05 E12: runs a display launcher from a click handler (the launcher
 * opens its window synchronously, so it is invoked before any await) and
 * keeps its failure message for the surface to show.
 */
export function useDisplayLauncher(onLaunched?: () => void) {
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const launchedRef = useRef(onLaunched);
  launchedRef.current = onLaunched;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const launch = useCallback(
    (open: () => Promise<OpenTableDisplayResult | void> | void) => {
      setMessage(null);
      const pending = open();
      void Promise.resolve(pending).then(result => {
        if (!mounted.current || !result) return;
        if (result.ok) launchedRef.current?.();
        else setMessage(result.message);
      });
    },
    []
  );
  return { message, launch };
}
