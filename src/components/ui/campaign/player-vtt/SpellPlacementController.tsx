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
  const wasArmedRef = useRef(false);

  useEffect(() => {
    if (pending) {
      configRef.current = pending.config;
      wasArmedRef.current = true;
      setTool('spelltemplate');
    } else if (wasArmedRef.current) {
      configRef.current = null;
      wasArmedRef.current = false;
      setTool('select');
    }
  }, [pending, configRef, setTool]);

  // If something else steals the tool while armed (e.g. user taps a toolbar
  // button), treat it as a cancel so the banner doesn't dangle.
  useEffect(() => {
    if (pending && wasArmedRef.current && activeTool !== 'spelltemplate') {
      onCancel();
    }
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
