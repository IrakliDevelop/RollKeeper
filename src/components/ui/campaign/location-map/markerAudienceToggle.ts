/**
 * The DM-only toggle's marker branch, in ONE place.
 *
 * Both DM surfaces (`DmLocationEditor.hooks.ts` handleToggleDmOnly and
 * `dm-vtt/DmBattleMapCanvas.hooks.ts` handleToggleSelectedDmOnly) used to
 * carry a near-identical copy of this logic, and the branch has already had to
 * be patched in both at once once (commit `42a00ee`, clearing the notice on
 * selection change). Three safety-relevant decisions live here — the sibling
 * routing, the LIVE audience read, and the mixed-audience refusal — and the
 * two surfaces have parallel test files, so a fix applied to one copy and not
 * the other stays green on both. Hence one function, two call sites.
 *
 * Pure: no React, no Zustand, no viewport. The caller supplies the element it
 * already looked up and a live reader for `dmOnlyElements`.
 */

import type { CanvasElement } from '@fieldnotes/core';

import { MARKER_MIXED_AUDIENCE_MESSAGE } from './markerAudienceCopy';
import { markerRefForElement } from './markerWrites';
import type { MarkerAudienceTransition } from './markerWrites';

export interface MarkerAudienceToggleInput {
  /** The currently selected element, as read from the canvas store. */
  element: Readonly<CanvasElement> | null | undefined;
  selectedElementId: string;
  /**
   * Read LIVE, never from a render-time snapshot: `dmOnlyElements` is reached
   * through a store getter whose identity never changes, so a captured value
   * can be one toggle behind and flip the set the wrong way.
   */
  readDmOnlyElements: () => Readonly<Record<string, boolean>>;
  setMarkerAudienceForRef: (
    ref: string,
    dmOnly: boolean
  ) => MarkerAudienceTransition;
}

export type MarkerAudienceToggleOutcome =
  /** Not a marker (or its data no longer parses): the caller must fall through
   *  to the plain per-element toggle. */
  | { handled: false }
  /** Handled as a marker sibling set. `notice` explains a refusal, or is null. */
  | { handled: true; notice: string | null };

/**
 * Applies the DM-only toggle to the selected element's whole marker sibling
 * SET, or reports that it is not a marker at all.
 *
 * Publication is `every`, not `some` (§6.4): flipping one pin of a shared ref
 * while its twins keep the old audience produces a permanently unpublishable
 * marker, so the transition moves every sibling or none of them.
 */
export function applyMarkerAudienceToggle(
  input: MarkerAudienceToggleInput
): MarkerAudienceToggleOutcome {
  const markerRef = markerRefForElement(input.element);
  if (markerRef === null) return { handled: false };

  const currentDmOnly = input.readDmOnlyElements();
  const transition = input.setMarkerAudienceForRef(
    markerRef,
    currentDmOnly[input.selectedElementId] !== true
  );

  return {
    handled: true,
    notice:
      transition.status === 'refused' && transition.reason === 'mixed-audience'
        ? MARKER_MIXED_AUDIENCE_MESSAGE
        : null,
  };
}
