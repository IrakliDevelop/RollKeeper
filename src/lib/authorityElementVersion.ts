import { getMovementVisibility } from '@fieldnotes/vtt';

/** SDK movement starts at zero; authority elements require a positive version. */
export function authorityElementVersion<T extends { version?: unknown }>(
  element: T
): T {
  return element.version === 0 && getMovementVisibility(element) !== undefined
    ? { ...element, version: 1 }
    : element;
}
