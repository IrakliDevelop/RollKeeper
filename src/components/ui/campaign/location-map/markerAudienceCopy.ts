/**
 * DM-facing copy for the marker audience controls, shared by both DM surfaces
 * (the location editor toolbar and the VTT command dock) so the two cannot
 * drift and tests can assert against the exact string rather than a retyped
 * copy. Pure strings: no React, no store, no SDK.
 */

/**
 * Shown when `setMarkerAudienceForRef` returns
 * `{ status: 'refused', reason: 'mixed-audience' }`. Publication is `every`,
 * not `some` (spec §6.4), so a half-applied sibling set is refused outright
 * rather than silently picking a winner — the DM has to be told what is wrong
 * AND what to do about it, or the toggle just looks broken.
 */
export const MARKER_MIXED_AUDIENCE_MESSAGE =
  "This marker's pins don't currently agree: some are DM-only and some are " +
  'shared. Set them to match before changing the audience.';

/**
 * Spec §7.4: sharing a marker publishes its kind, label and colour along with
 * the detail record — so sharing a `trap` or `secret` pin reveals that
 * classification to players before a single word of detail is published. This
 * has to be stated plainly on the control that does it.
 */
export const MARKER_SHARE_REVEALS_CLASSIFICATION =
  "Sharing a marker also makes its kind, label and colour public — a 'trap' " +
  "or 'secret' pin reveals that classification to players before any detail " +
  'is published.';

/** Title / aria-label for a DM-only toggle whose selected element is a marker.
 *  Every sibling pin sharing this marker's ref moves together. */
export function markerAudienceToggleTitle(isDmOnly: boolean): string {
  const action = isDmOnly
    ? 'Share this marker with players'
    : 'Hide this marker from players';
  return `${action} — applies to every pin sharing it. ${MARKER_SHARE_REVEALS_CLASSIFICATION}`;
}
