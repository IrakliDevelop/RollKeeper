/**
 * Per-viewport lifecycle hook binding one `@fieldnotes/core` viewport to the
 * marker canvas painter and to marker pointer activation, and tearing both
 * down again on unmount / dependency change.
 *
 * Connection-independent: no relay import, no store import, no React state.
 * Registration and activation must work with no relay URL configured
 * (CONSTRAINTS-B, spec §7.2). Wiring this hook into `DmBattleMapCanvas` /
 * `DmLocationEditor` / the player canvas / the display page is a later task
 * (B10 / B11) — this file owns only the lifecycle seam.
 */
import { useEffect, useRef } from 'react';
import type {
  ActivationOptions,
  CanvasElement,
  ElementActivationEvent,
  HtmlPainter,
} from '@fieldnotes/core';
import type { MarkerDetail, PublicMarkerDetail } from '@/types/battlemap';

import { MARKER_TOOL_NAME } from './DmMarkerTool';
import { MARKER_HTML_TYPE, MARKER_HTML_TYPES } from './markerData';
import { createMarkerPainter, type MarkerDataIssue } from './markerPainter';

/** The subset of Viewport this hook needs — structural, so tests can pass a
 * recording double instead of a real `@fieldnotes/core` Viewport. */
export interface MarkerRegistrationViewport {
  expectCanvasHtmlTypes(htmlTypes: Iterable<string>): () => void;
  registerHtmlPainter(htmlType: string, painter: HtmlPainter): () => void;
  setActivation(options: ActivationOptions | null): () => void;
  onElementActivate(
    listener: (event: ElementActivationEvent) => void
  ): () => void;
  requestRender?: () => void;
}

export interface UseMarkerRegistrationArgs {
  /** Null until the canvas reports ready. */
  viewport: MarkerRegistrationViewport | null;
  /** Per-surface gesture. `null` disables activation entirely (the display page). */
  gesture: 'single' | 'double' | null;
  onActivateMarker?: (event: ElementActivationEvent) => void;
  onMarkerDataIssue?: (issue: MarkerDataIssue) => void;
  /** Composed by the host, e.g. `() => animator.animating`. */
  isCameraBusy?: () => boolean;
  /**
   * Host veto making activation inert while a tool that WRITES to the canvas
   * is active. Read at gesture time, never captured.
   *
   * Core's `ElementActivation` listens directly on the viewport wrapper and
   * never consults the tool manager, so without this a double-tap with the
   * marker tool selected places a second pin AND opens a modal panel over it,
   * and a double-tap with the eraser deletes a pin and then opens a panel on
   * an element that is already gone. `select` and `hand` must NOT suppress:
   * single-click-to-select plus double-tap-to-open is the specified DM
   * gesture.
   */
  isActivationSuppressed?: () => boolean;
  /** Product-state details keyed by the marker ref; never written to canvas. */
  markerDetails?: readonly (MarkerDetail | PublicMarkerDetail)[];
}

/**
 * Tools that create or destroy canvas content, for which activation is inert.
 * Deliberately a denylist of writers rather than an allowlist of readers: a
 * tool added later that only reads (a future inspector) should keep working
 * with double-tap-to-open, while a new placement tool is the caller's to add
 * here. `select` and `hand` are the two the spec requires NOT be listed.
 */
export const CANVAS_WRITING_TOOL_NAMES: ReadonlySet<string> = new Set([
  // RollKeeper tools
  MARKER_TOOL_NAME,
  'token', // PlayerTokenTool
  'dmtoken', // dm-vtt/combatantToken.ts DmTokenTool
  'spelltemplate', // player-vtt/SpellTemplateTool
  // @fieldnotes/core tools that add or remove elements
  'eraser',
  'pencil',
  'arrow',
  'shape',
  'text',
  'note',
  'image',
  'template',
]);
// NOT listed, on purpose: 'select' and 'hand' (the specified DM gesture is
// single-click-to-select plus double-tap-to-open), and 'measure' / 'laser' /
// 'ping', which are ephemeral overlays and write no elements.

/**
 * `el.type === 'html' && el.htmlType === MARKER_HTML_TYPE`. Deliberately does
 * NOT parse `data`: an `unsupported` or `invalid` marker must still activate,
 * because the panel shows a typed "cannot display" state for it (spec §6.2) —
 * this is an additional host filter layered on top of core's own
 * canvas-routing gate, not a data-validity gate.
 */
function isMarkerElement(el: Readonly<CanvasElement>): boolean {
  return el.type === 'html' && el.htmlType === MARKER_HTML_TYPE;
}

/**
 * Binds one viewport to the marker painter and pointer activation, and tears
 * both down again. One `useEffect`, keyed on `[viewport, gesture]` only —
 * changing a callback's identity must never tear down and re-create the
 * registration, so every callback is read through a ref kept current on
 * every render.
 *
 * Inside the effect, in order:
 *   1. declare the canvas html type (`expectCanvasHtmlTypes`)
 *   2. register the painter (`registerHtmlPainter`)
 *   3. enable activation, unless `gesture` is `null` (`setActivation`)
 *   4. subscribe to activation events (`onElementActivate`)
 *
 * Step 1 MUST run before step 2: `expect()` is what makes core route the
 * marker `htmlType` to canvas at all. Getting the order backwards does not
 * throw — it just makes the marker silently route to `'missing'` for one
 * registry-change cycle instead of `'canvas'`, so the ordering is enforced
 * here rather than left to a comment.
 *
 * Cleanup disposes all four, in reverse order, and tolerates a `null`
 * activation disposer (the `gesture === null` case).
 */
export function useMarkerRegistration(args: UseMarkerRegistrationArgs): void {
  const { viewport, gesture } = args;

  const onActivateMarkerRef = useRef(args.onActivateMarker);
  onActivateMarkerRef.current = args.onActivateMarker;

  const onMarkerDataIssueRef = useRef(args.onMarkerDataIssue);
  onMarkerDataIssueRef.current = args.onMarkerDataIssue;

  const isCameraBusyRef = useRef(args.isCameraBusy);
  isCameraBusyRef.current = args.isCameraBusy;

  const isActivationSuppressedRef = useRef(args.isActivationSuppressed);
  isActivationSuppressedRef.current = args.isActivationSuppressed;

  const markerStatusesRef = useRef(new Map<string, MarkerDetail['status']>());
  markerStatusesRef.current = new Map(
    (args.markerDetails ?? []).map(detail => [detail.id, detail.status])
  );

  useEffect(() => {
    viewport?.requestRender?.();
  }, [viewport, args.markerDetails]);

  useEffect(() => {
    if (viewport === null) return undefined;

    /**
     * `isActivatable`, the SDK's intended host filter. Reads the suppression
     * veto THROUGH THE REF at gesture time — a value captured when the effect
     * ran would pin the tool that happened to be active at mount, and the
     * effect deliberately does not re-run on callback identity changes.
     */
    const isActivatableMarker = (el: Readonly<CanvasElement>): boolean => {
      if (isActivationSuppressedRef.current?.() === true) return false;
      return isMarkerElement(el);
    };

    const releaseDeclaration =
      viewport.expectCanvasHtmlTypes(MARKER_HTML_TYPES);
    const unregisterPainter = viewport.registerHtmlPainter(
      MARKER_HTML_TYPE,
      createMarkerPainter({
        onMarkerDataIssue: issue => onMarkerDataIssueRef.current?.(issue),
        resolveMarkerStatus: ref => markerStatusesRef.current.get(ref),
      })
    );
    const disposeActivation =
      gesture === null
        ? null
        : viewport.setActivation({
            gesture,
            isActivatable: isActivatableMarker,
            isCameraBusy: () => isCameraBusyRef.current?.() ?? false,
          });
    // Second gate, for the same reason `isActivatable` is the first: the
    // activation emitter is viewport-owned and persistent, so an event raised
    // by some OTHER `setActivation` owner (or by a stale generation) must not
    // open a panel behind a canvas-writing tool either.
    const offActivate = viewport.onElementActivate(event => {
      if (!isActivatableMarker(event.element)) return;
      onActivateMarkerRef.current?.(event);
    });

    return () => {
      offActivate();
      disposeActivation?.();
      unregisterPainter();
      releaseDeclaration();
    };
  }, [viewport, gesture]);
}
