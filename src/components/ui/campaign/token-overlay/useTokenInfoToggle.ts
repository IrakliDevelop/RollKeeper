'use client';

import { useCallback, useEffect, useState } from 'react';

/** Persisted show/hide state for token decorations. Defaults ON. */
export function useTokenInfoToggle(storageKey: string): [boolean, () => void] {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'false') setVisible(false);
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(visible));
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey, visible]);

  const toggle = useCallback(() => setVisible(v => !v), []);
  return [visible, toggle];
}
