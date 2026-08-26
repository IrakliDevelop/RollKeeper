/**
 * The pure state resolver for the marker detail panel, plus the class-name
 * constants the panel's containment and touch-target rules are pinned to.
 *
 * `resolveMarkerPanelState` is where spec §6.2's "re-validated before every
 * use — paint, activation, publication, detail lookup" is honoured for the
 * detail-lookup path: it never trusts a previously-computed `parseMarkerData`
 * result and never reads a map id out of marker `data`.
 */
import type { CanvasElement } from '@fieldnotes/core';

import type { MarkerDetail, PublicMarkerDetail } from '@/types/battlemap';

import { MARKER_HTML_TYPE, parseMarkerData } from '../markerData';

import type {
  MarkerPanelMode,
  MarkerPanelState,
} from './MarkerDetailPanel.types';

/**
 * Containment for pathological title/body lengths (spec §6.3): wraps
 * anywhere (so a single unbroken run of characters cannot blow out the
 * dialog width) and caps height with a scrollbar. Exported so tests assert
 * against this exact string rather than a retyped copy.
 */
export const MARKER_PANEL_CONTAINMENT_CLASS =
  'max-h-48 overflow-y-auto break-words [overflow-wrap:anywhere]';

/**
 * Minimum touch target (44x44 CSS px) for every interactive control in the
 * panel. Exported so tests assert against this exact string rather than a
 * retyped copy.
 */
export const MARKER_PANEL_TOUCH_TARGET_CLASS = 'min-h-[44px] min-w-[44px]';

/**
 * Resolves which of the five panel states applies to `element` for the given
 * `mode`. Evaluation order (per the brief):
 *
 * 1. `element` is null, not `type === 'html'`, or its `htmlType` is not
 *    `MARKER_HTML_TYPE` -> `invalid-data`.
 * 2. `parseMarkerData(element.data)` is `invalid` -> `invalid-data`;
 *    `unsupported` -> `unsupported-version`.
 * 3. Valid: look up the detail whose `id === data.ref`, ignoring
 *    soft-deleted records (`deletedAt` set). Found -> `ready`. Not found ->
 *    `unpublished` in player mode, `missing-detail` in DM mode.
 */
export function resolveMarkerPanelState(
  element: Readonly<CanvasElement> | null,
  markers: readonly (MarkerDetail | PublicMarkerDetail)[],
  mode: MarkerPanelMode
): MarkerPanelState {
  if (element === null) {
    return { kind: 'invalid-data', reason: 'no element is selected' };
  }
  if (element.type !== 'html') {
    return {
      kind: 'invalid-data',
      reason: `element type "${element.type}" is not a marker`,
    };
  }
  if (element.htmlType !== MARKER_HTML_TYPE) {
    return {
      kind: 'invalid-data',
      reason: 'element htmlType is not a marker',
    };
  }

  const result = parseMarkerData(element.data);
  if (result.status === 'invalid') {
    return { kind: 'invalid-data', reason: result.reason };
  }
  if (result.status === 'unsupported') {
    return { kind: 'unsupported-version', version: result.version };
  }

  const detail = markers.find(marker => {
    const deleted = 'deletedAt' in marker && Boolean(marker.deletedAt);
    return marker.id === result.data.ref && !deleted;
  });
  if (detail) {
    return { kind: 'ready', data: result.data, detail };
  }

  return mode === 'player'
    ? { kind: 'unpublished', data: result.data }
    : { kind: 'missing-detail', data: result.data };
}
