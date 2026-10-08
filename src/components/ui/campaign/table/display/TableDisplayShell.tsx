'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldNotesCanvas } from '@fieldnotes/react';
import { HandTool, type Viewport } from '@fieldnotes/core';

import { Button } from '@/components/ui/forms/button';
import { useMarkerRegistration } from '@/components/ui/campaign/location-map/useMarkerRegistration';

import {
  bootstrapCampaignDisplay,
  bootstrapMapPinnedDisplay,
  clearDisplayCredential,
  scrubDisplayUrl,
  type DisplayBootstrap,
} from './displayCredentialStore';
import {
  DISPLAY_EXPIRED,
  DISPLAY_OPEN_FROM_DM,
  DISPLAY_STORAGE_BLOCKED,
  DISPLAY_WAITING,
} from './displayMessages';
import { TableDisplayCalibration } from './TableDisplayCalibration';
import {
  TableDisplayController,
  UNCALIBRATED_VIEW,
  type TableDisplayDeps,
  type TableDisplayView,
} from './tableDisplayController';
import { defaultTableDisplayDeps } from './tableDisplayDeps';
import {
  useCalibrationMonitor,
  useCalibrationState,
  useCameraAttributes,
  useCameraInputPolicy,
  useFitMapVisibility,
  useFullscreenKey,
} from './TableDisplayShell.hooks';
import { cameraInputMode } from './calibration/cameraInputGuard';
import {
  browserEnvironmentHost,
  readEnvironment,
} from './calibration/environment';
import { getCalibrationStore } from './calibration/session';

const SHELL_STYLE = {
  position: 'fixed',
  inset: 0,
  background: '#000',
} as const;
const COVER_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: '1.25rem',
  fontFamily: 'system-ui, sans-serif',
  background: '#000',
  pointerEvents: 'none',
  textAlign: 'center',
  padding: '1rem',
} as const;
const CANVAS_STYLE = { width: '100%', height: '100%' } as const;
/** PR07 R3-2: the guarded ancestor of the core wrapper (always mounted). */
const CANVAS_CONTAINER_STYLE = {
  position: 'absolute',
  inset: 0,
  touchAction: 'none',
} as const;
const INITIAL_VIEW: TableDisplayView = {
  cover: DISPLAY_WAITING,
  canvas: null,
  showing: false,
  calibration: UNCALIBRATED_VIEW,
};

/**
 * PR05 E8–E11: the persistent campaign table display. The credential is
 * bootstrapped from the fragment (or this tab's sessionStorage) before any
 * request; the controller then follows what the DM presents, covered until
 * each scene is rendered, with a camera that only explicit local moves
 * change. No DM layout, sync providers, focus receiver or awareness.
 */
export function TableDisplayShell({
  code,
  deps,
  mapId,
}: {
  code: string;
  deps?: TableDisplayDeps;
  /** Map-pinned display (old `…/battlemaps/<id>/display?dk=` URLs). */
  mapId?: string;
}) {
  const bootRef = useRef<DisplayBootstrap | null>(null);
  const [boot, setBoot] = useState<DisplayBootstrap | null>(null);
  useEffect(() => {
    // Refs survive StrictMode's effect replay: a consumed fragment/query
    // (and a memory-only credential) is never bootstrapped twice.
    if (!bootRef.current) {
      const result =
        mapId === undefined
          ? bootstrapCampaignDisplay(code)
          : bootstrapMapPinnedDisplay(code, true);
      bootRef.current =
        result.status === 'legacy' ? { status: 'missing' } : result;
    }
    setBoot(bootRef.current);
  }, [code, mapId]);

  const [view, setView] = useState<TableDisplayView>(INITIAL_VIEW);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const controllerRef = useRef<TableDisplayController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const readCurrentEnvironment = useCallback(
    () => readEnvironment(browserEnvironmentHost(), rootRef.current),
    []
  );
  const resolvedDeps = useMemo(() => deps ?? defaultTableDisplayDeps(), [deps]);
  const credential = boot?.status === 'ready' ? boot.credential : null;

  // Runs (in order) before the controller below starts its first request.
  useEffect(() => {
    if (boot) scrubDisplayUrl();
  }, [boot]);

  useEffect(() => {
    if (!credential) return;
    const controller = new TableDisplayController({
      code,
      credential,
      relayUrl: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
      deps: resolvedDeps,
      onView: setView,
      onCredentialDenied: () => clearDisplayCredential(code),
      mapPinned: mapId === undefined ? undefined : { mapId },
      calibration: {
        store: getCalibrationStore(code),
        readEnvironment: readCurrentEnvironment,
      },
    });
    controllerRef.current = controller;
    controller.start();
    return () => {
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
      setView(INITIAL_VIEW);
    };
  }, [code, credential, resolvedDeps, mapId, readCurrentEnvironment]);

  // Markers paint on the TV; it never opens a marker panel (gesture null).
  useMarkerRegistration({ viewport, gesture: null });
  useFullscreenKey();
  const fitVisible = useFitMapVisibility();
  const calibration = useCalibrationState(code);
  useCalibrationMonitor(calibration.store, rootRef);
  const inputMode = cameraInputMode(view.calibration.report);
  useCameraInputPolicy(canvasContainerRef, viewport, inputMode);
  useCameraAttributes(rootRef, viewport);
  const tools = useMemo(() => [new HandTool()], []);
  const canvasKey = view.canvas?.key ?? null;
  const handleReady = useCallback(
    (vp: Viewport) => {
      if (canvasKey === null) return;
      setViewport(vp);
      controllerRef.current?.onViewportReady(canvasKey, vp);
    },
    [canvasKey]
  );
  const canvasOptions = useMemo(
    () =>
      view.canvas
        ? {
            background: { pattern: 'none' as const },
            plugins: [view.canvas.fogPlugin],
            requiredCapabilities: ['vtt:fog'],
          }
        : null,
    [view.canvas]
  );

  const cover =
    boot === null
      ? DISPLAY_WAITING
      : boot.status === 'missing'
        ? DISPLAY_OPEN_FROM_DM
        : boot.status === 'expired'
          ? DISPLAY_EXPIRED
          : view.cover;
  return (
    <div
      ref={rootRef}
      data-testid="table-display"
      data-calibration-state={view.calibration.report}
      style={SHELL_STYLE}
    >
      <div
        ref={canvasContainerRef}
        data-testid="table-display-canvas"
        style={CANVAS_CONTAINER_STYLE}
      >
        {view.canvas && canvasOptions && (
          <FieldNotesCanvas
            key={view.canvas.key}
            tools={tools}
            defaultTool="hand"
            onReady={handleReady}
            options={canvasOptions}
            style={CANVAS_STYLE}
          />
        )}
      </div>
      {cover !== null && (
        <div data-testid="table-display-cover" style={COVER_STYLE}>
          {cover}
        </div>
      )}
      {boot?.status === 'ready' && !boot.persisted && (
        <p
          data-testid="table-display-notice"
          className="bg-surface-raised text-muted fixed bottom-2 left-2 z-[110] rounded px-2 py-1 text-xs"
        >
          {DISPLAY_STORAGE_BLOCKED}
        </p>
      )}
      {cover === null &&
        view.showing &&
        fitVisible &&
        inputMode !== 'frozen' && (
          <div className="fixed right-4 bottom-4 z-[110]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => controllerRef.current?.fitMap()}
            >
              {inputMode === 'pan-only' ? 'Centre map' : 'Fit map'}
            </Button>
          </div>
        )}
      {boot?.status === 'ready' && (
        <TableDisplayCalibration
          store={calibration.store}
          state={calibration.state}
          view={view.calibration}
          pointerActive={fitVisible}
          readEnvironment={readCurrentEnvironment}
        />
      )}
    </div>
  );
}
