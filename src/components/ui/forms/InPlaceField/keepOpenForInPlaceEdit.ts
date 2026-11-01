/** Set on an `InPlaceField` input while its draft differs from the value. */
export const IN_PLACE_DIRTY_ATTR = 'data-in-place-dirty';

/**
 * Escape belongs to an in-place edit first: while the field holds a draft,
 * keep the surrounding dialog or drawer open so the field can cancel the
 * draft. Radix runs this before the field's own keydown (its Escape
 * listener is a document capture listener), so the marker is still set.
 * The next Escape finds no draft and closes as usual.
 */
export function keepOpenForInPlaceEdit(event: KeyboardEvent): void {
  const target = event.target;
  if (target instanceof Element && target.hasAttribute(IN_PLACE_DIRTY_ATTR)) {
    event.preventDefault();
  }
}
