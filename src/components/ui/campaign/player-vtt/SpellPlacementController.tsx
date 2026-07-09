'use client';

import { useEffect, useRef } from 'react';
import { useActiveTool } from '@fieldnotes/react';

import type { MutableRefObject } from 'react';
import type { SpellTemplateConfig } from './SpellTemplateTool';

export interface PendingPlacement {
  spellName: string;
  /** For the banner text ("circle · 20 ft"). */
  aoe: import('@/types/spellAoe').SpellAoe;
  config: SpellTemplateConfig;
}

interface SpellPlacementControllerProps {
  pending: PendingPlacement | null;
  configRef: MutableRefObject<SpellTemplateConfig | null>;
  /** User cancelled (Escape / banner button). Parent clears `pending`. */
  onCancel: () => void;
}

/**
 * Headless bridge between screen state and the canvas tool system: arming a
 * placement loads the config ref and switches to the spelltemplate tool;
 * clearing it (placed or cancelled) switches back to select. Escape cancels
 * (spec §1a desktop keyboard rule).
 */
export function SpellPlacementController({
  pending,
  configRef,
  onCancel,
}: SpellPlacementControllerProps) {
  const [activeTool, setTool] = useActiveTool();
  // True only once we have OBSERVED the template tool actually active while
  // this placement is pending. `setTool` propagates to `activeTool` on the
  // NEXT render, so the steal detector must not react to the stale value in
  // the arming commit — doing so cancelled every placement instantly.
  const sawTemplateToolRef = useRef(false);
  // Latest tool for the disarm branch without re-running it on tool changes.
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Arm/disarm strictly on `pending` transitions.
  useEffect(() => {
    if (pending) {
      configRef.current = pending.config;
      sawTemplateToolRef.current = false;
      setTool('spelltemplate');
    } else {
      configRef.current = null;
      // Only force back to select if the template tool is still active; a
      // steal-cancel already left the user's chosen tool in place.
      if (activeToolRef.current === 'spelltemplate') setTool('select');
      sawTemplateToolRef.current = false;
    }
  }, [pending, configRef, setTool]);

  // Observe tool changes: record when arming has actually taken effect, and
  // treat a change AWAY from the template tool after that as a user cancel
  // (e.g. tapping a toolbar button).
  // INVARIANT: the success path stays cancel-free ONLY because the tool's
  // onPointerUp calls switchTool('select') and onPlaced() synchronously in
  // one tick, and the parent clears `pending` synchronously inside onPlaced —
  // React batches both updates into one commit, so this effect never sees
  // select-with-pending on success. If onPlaced ever gains an async gap
  // before clearing pending, a successful placement will spuriously cancel.
  useEffect(() => {
    if (!pending) return;
    if (activeTool === 'spelltemplate') {
      sawTemplateToolRef.current = true;
      return;
    }
    if (sawTemplateToolRef.current) onCancel();
  }, [activeTool, pending, onCancel]);

  useEffect(() => {
    if (!pending) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pending, onCancel]);

  return null;
}
