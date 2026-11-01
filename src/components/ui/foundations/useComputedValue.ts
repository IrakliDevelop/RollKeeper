'use client';

import { useEffect, useRef, useState } from 'react';

interface ComputedValueOptions<T extends Element> {
  /** Read a pseudo-element instead, e.g. `::after` for a hit area. */
  pseudoElement?: string;
  /**
   * Read a node inside the ref'd element instead. Define it outside the
   * component so it keeps its identity between renders.
   */
  pick?: (element: T) => Element | null;
}

/**
 * Reads one computed style property (a CSS property such as
 * `border-radius`, or a custom property such as `--surface`) from the
 * element the returned ref is attached to, after mount. The Foundations
 * pages print these values instead of repeating them, so each page shows
 * what the browser actually applies.
 */
export function useComputedValue<T extends Element>(
  property: string,
  { pseudoElement, pick }: ComputedValueOptions<T> = {}
) {
  const ref = useRef<T>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const element = ref.current && (pick ? pick(ref.current) : ref.current);
    if (!element) return;
    setValue(
      getComputedStyle(element, pseudoElement).getPropertyValue(property).trim()
    );
  }, [property, pseudoElement, pick]);

  return { ref, value };
}
