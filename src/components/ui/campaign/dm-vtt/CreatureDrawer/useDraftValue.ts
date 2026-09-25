'use client';

import { useState } from 'react';

/**
 * A local edit buffer for a field that commits on blur/Enter instead of on
 * every keystroke. The draft resyncs whenever `source` changes elsewhere
 * (another client, the stat block editor), so the field never goes stale.
 */
export function useDraftValue<T>(source: T) {
  const [draft, setDraft] = useState(source);
  const [prevSource, setPrevSource] = useState(source);
  if (!Object.is(source, prevSource)) {
    setPrevSource(source);
    setDraft(source);
  }
  const revert = () => setDraft(source);
  return [draft, setDraft, revert] as const;
}
