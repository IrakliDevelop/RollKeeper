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
}

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

  useEffect(() => {
    if (viewport === null) return undefined;

    const releaseDeclaration =
      viewport.expectCanvasHtmlTypes(MARKER_HTML_TYPES);
    const unregisterPainter = viewport.registerHtmlPainter(
      MARKER_HTML_TYPE,
      createMarkerPainter({
        onMarkerDataIssue: issue => onMarkerDataIssueRef.current?.(issue),
      })
    );
    const disposeActivation =
      gesture === null
        ? null
        : viewport.setActivation({
            gesture,
            isActivatable: isMarkerElement,
            isCameraBusy: () => isCameraBusyRef.current?.() ?? false,
          });
    const offActivate = viewport.onElementActivate(event => {
      if (!isMarkerElement(event.element)) return;
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
