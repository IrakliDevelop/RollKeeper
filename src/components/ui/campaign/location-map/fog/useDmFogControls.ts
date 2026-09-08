'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Bounds, Viewport } from '@fieldnotes/core';
import type { FogOperation, FogTool } from '@fieldnotes/vtt';
import { getViewportFogManager } from '@/lib/fieldnotesVtt';
import { configureFogView } from './configureFogView';
import { initializeMapFog } from './initializeMapFog';
import { reconcileMapFogBounds } from './reconcileMapFogBounds';

export type FogConfirmationAction =
  | 'enable'
  | 'cover-all'
  | 'reveal-all'
  | 'disable';

export type FogShape = 'brush' | 'rectangle' | 'polygon';

export interface DmFogControls {
  initialized: boolean;
  disabled: boolean;
  disabledReason?: string;
  operation: FogOperation;
  shape: FogShape;
  radius: number;
  preview: boolean;
  diagnostic: string | null;
  pendingAction: FogConfirmationAction | null;
  requestActivate(): void;
  setOperation(operation: FogOperation): void;
  setShape(shape: FogShape): void;
  setRadius(radius: number): void;
  setPreview(preview: boolean): void;
  requestAction(action: Exclude<FogConfirmationAction, 'enable'>): void;
  confirmAction(): void;
  cancelAction(): void;
  /** Recompute canonical map bounds after map-image mutations. */
  reconcileBounds(): void;
  reportError(error: unknown): void;
}

function fogDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/tile|256|limit|capacity/i.test(message)) {
    return 'Fog could not be updated because this map exceeds the 256-tile limit. Reduce the map bounds or use a larger fog cell size.';
  }
  return message || 'Fog of war could not be updated';
}

export function useDmFogControls(options: {
  viewport: Viewport | null;
  getBounds: () => Bounds;
  disabled?: boolean;
  disabledReason?: string;
}): DmFogControls {
  const { viewport, getBounds } = options;
  const fogManager = viewport ? getViewportFogManager(viewport) : null;
  const disabled = options.disabled ?? false;
  const [initialized, setInitialized] = useState(false);
  const [operation, setOperationState] = useState<FogOperation>('reveal');
  const [shape, setShapeState] = useState<FogShape>('brush');
  const [radius, setRadiusState] = useState(40);
  const [preview, setPreviewState] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [pendingAction, setPendingAction] =
    useState<FogConfirmationAction | null>(null);

  useEffect(() => {
    if (!viewport) {
      setInitialized(false);
      return;
    }
    if (!fogManager) return;
    configureFogView(fogManager, 'dm', false);
    setPreviewState(false);
    setInitialized(fogManager.getState() !== null);
    const unsubscribe = fogManager.on('change', () => {
      setInitialized(fogManager.getState() !== null);
    });
    return unsubscribe;
  }, [fogManager, viewport]);

  useEffect(() => {
    if (disabled && viewport?.toolManager.activeTool?.name === 'fog') {
      if (fogManager) configureFogView(fogManager, 'dm', false);
      setPreviewState(false);
      viewport.setTool('select');
    }
  }, [disabled, fogManager, viewport]);

  const withDiagnostic = useCallback((run: () => void) => {
    try {
      run();
      setDiagnostic(null);
    } catch (error) {
      setDiagnostic(fogDiagnostic(error));
    }
  }, []);

  const updateTool = useCallback(
    (
      patch: Partial<{
        operation: FogOperation;
        shape: FogShape;
        radius: number;
      }>
    ) => {
      viewport?.toolManager.getTool<FogTool>('fog')?.setOptions(patch);
    },
    [viewport]
  );

  const requestActivate = useCallback(() => {
    if (!viewport) return;
    if (disabled) {
      setDiagnostic(
        options.disabledReason ??
          'Finish the current map operation before editing fog.'
      );
      return;
    }
    if (!fogManager?.getState()) {
      setPendingAction('enable');
      return;
    }
    configureFogView(fogManager, 'dm', preview);
    viewport.setTool('fog');
    setDiagnostic(null);
  }, [disabled, fogManager, options.disabledReason, preview, viewport]);

  const confirmAction = useCallback(() => {
    if (!viewport || !fogManager || !pendingAction) return;
    withDiagnostic(() => {
      if (pendingAction === 'enable') {
        initializeMapFog(fogManager, getBounds());
        configureFogView(fogManager, 'dm', false);
        setPreviewState(false);
        viewport.setTool('fog');
      } else if (pendingAction === 'cover-all') {
        fogManager.reset('covered');
      } else if (pendingAction === 'reveal-all') {
        const state = fogManager.getState();
        if (!state) throw new Error('Fog is not initialized');
        const { x, y, w, h } = state.definition.bounds;
        fogManager.applyRegion(
          { kind: 'rectangle', from: { x, y }, to: { x: x + w, y: y + h } },
          'reveal'
        );
      } else {
        fogManager.disable();
        configureFogView(fogManager, 'dm', false);
        setPreviewState(false);
        viewport.setTool('select');
      }
    });
    setPendingAction(null);
  }, [fogManager, getBounds, pendingAction, viewport, withDiagnostic]);

  return {
    initialized,
    disabled,
    disabledReason: options.disabledReason,
    operation,
    shape,
    radius,
    preview,
    diagnostic,
    pendingAction,
    requestActivate,
    setOperation: next => {
      setOperationState(next);
      updateTool({ operation: next });
    },
    setShape: next => {
      setShapeState(next);
      updateTool({ shape: next });
    },
    setRadius: next => {
      setRadiusState(next);
      updateTool({ radius: next });
    },
    setPreview: next => {
      setPreviewState(next);
      if (fogManager) configureFogView(fogManager, 'dm', next);
    },
    requestAction: setPendingAction,
    confirmAction,
    cancelAction: () => setPendingAction(null),
    reconcileBounds: () => {
      if (!fogManager?.getState()) return;
      withDiagnostic(() => reconcileMapFogBounds(fogManager, getBounds()));
    },
    reportError: error => setDiagnostic(fogDiagnostic(error)),
  };
}
