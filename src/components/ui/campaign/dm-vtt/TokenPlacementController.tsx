'use client';

import { useEffect, useRef } from 'react';
import { useActiveTool } from '@fieldnotes/react';

import type { MutableRefObject } from 'react';
import type { DmTokenConfig } from './combatantToken';

export interface PendingTokenPlacement {
  /** For the board banner. */
  entityName: string;
  config: DmTokenConfig;
}

interface TokenPlacementControllerProps {
  pending: PendingTokenPlacement | null;
  configRef: MutableRefObject<DmTokenConfig | null>;
  /** User cancelled (Escape / banner button). Parent clears `pending`. */
  onCancel: () => void;
}

/**
 * Headless bridge between screen state and the canvas tool system: arming a
 * placement loads the config ref and switches to the dmtoken tool; clearing
 * it (placed or cancelled) switches back to select. Escape cancels (spec
 * §1a desktop keyboard rule).
 */
export function TokenPlacementController({
  pending,
  configRef,
  onCancel,
}: TokenPlacementControllerProps) {
  const [activeTool, setTool] = useActiveTool();
  // True only once we have OBSERVED the token tool actually active while
  // this placement is pending. `setTool` propagates to `activeTool` on the
  // NEXT render, so the steal detector must not react to the stale value in
  // the arming commit — doing so cancelled every placement instantly.
  const sawTokenToolRef = useRef(false);
  // Latest tool for the disarm branch without re-running it on tool changes.
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Arm/disarm strictly on `pending` transitions.
  useEffect(() => {
    if (pending) {
      configRef.current = pending.config;
      sawTokenToolRef.current = false;
      setTool('dmtoken');
    } else {
      configRef.current = null;
      // Only force back to select if the token tool is still active; a
      // steal-cancel already left the user's chosen tool in place.
      if (activeToolRef.current === 'dmtoken') setTool('select');
      sawTokenToolRef.current = false;
    }
  }, [pending, configRef, setTool]);

  // Observe tool changes: record when arming has actually taken effect, and
  // treat a change AWAY from the token tool after that as a user cancel
  // (e.g. tapping a toolbar button).
  // INVARIANT: the success path stays cancel-free ONLY because the tool's
  // onPointerUp calls switchTool('select') and onPlaced() synchronously in
  // one tick, and the parent clears `pending` synchronously inside onPlaced —
  // React batches both updates into one commit, so this effect never sees
  // select-with-pending on success. If onPlaced ever gains an async gap
  // before clearing pending, a successful placement will spuriously cancel.
  useEffect(() => {
    if (!pending) return;
    if (activeTool === 'dmtoken') {
      sawTokenToolRef.current = true;
      return;
    }
    if (sawTokenToolRef.current) onCancel();
  }, [activeTool, pending, onCancel]);

  useEffect(() => {
    if (!pending) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Defer to any open dialog: registered in the CAPTURE phase so this
      // runs BEFORE Radix's document-level listener flushes the dialog
      // closed — a bubble listener could observe data-state already
      // "closed" and cancel placement anyway. Escape closes the dialog
      // first; the next Escape cancels placement.
      if (document.querySelector('[role="dialog"][data-state="open"]')) {
        return;
      }
      onCancel();
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [pending, onCancel]);

  return null;
}
