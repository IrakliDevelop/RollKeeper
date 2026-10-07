'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldNotesCanvas } from '@fieldnotes/react';
import { HandTool, type Viewport } from '@fieldnotes/core';

import { Button } from '@/components/ui/forms/button';
import { useMarkerRegistration } from '@/components/ui/campaign/location-map/useMarkerRegistration';

import {
  bootstrapCampaignDisplay,
  clearDisplayCredential,
  type DisplayBootstrap,
} from './displayCredentialStore';
import {
  DISPLAY_EXPIRED,
  DISPLAY_OPEN_FROM_DM,
  DISPLAY_STORAGE_BLOCKED,
  DISPLAY_WAITING,
} from './displayMessages';
import {
  TableDisplayController,
  type TableDisplayDeps,
  type TableDisplayView,
} from './tableDisplayController';
import { defaultTableDisplayDeps } from './tableDisplayDeps';
import {
  useFitMapVisibility,
  useFullscreenKey,
} from './TableDisplayShell.hooks';

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
const INITIAL_VIEW: TableDisplayView = {
  cover: DISPLAY_WAITING,
  canvas: null,
  showing: false,
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
}: {
  code: string;
  deps?: TableDisplayDeps;
}) {
  const bootRef = useRef<DisplayBootstrap | null>(null);
  const [boot, setBoot] = useState<DisplayBootstrap | null>(null);
  useEffect(() => {
    // Refs survive StrictMode's effect replay: a consumed fragment (and a
    // memory-only credential) is never bootstrapped twice.
    bootRef.current ??= bootstrapCampaignDisplay(code);
    setBoot(bootRef.current);
  }, [code]);

  const [view, setView] = useState<TableDisplayView>(INITIAL_VIEW);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const controllerRef = useRef<TableDisplayController | null>(null);
  const resolvedDeps = useMemo(() => deps ?? defaultTableDisplayDeps(), [deps]);
  const credential = boot?.status === 'ready' ? boot.credential : null;

  useEffect(() => {
    if (!credential) return;
    const controller = new TableDisplayController({
      code,
      credential,
      relayUrl: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
      deps: resolvedDeps,
      onView: setView,
      onCredentialDenied: () => clearDisplayCredential(code),
    });
    controllerRef.current = controller;
    controller.start();
    return () => {
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
      setView(INITIAL_VIEW);
    };
  }, [code, credential, resolvedDeps]);

  // Markers paint on the TV; it never opens a marker panel (gesture null).
  useMarkerRegistration({ viewport, gesture: null });
  useFullscreenKey();
  const fitVisible = useFitMapVisibility();
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
    <div style={SHELL_STYLE}>
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
      {cover === null && view.showing && fitVisible && (
        <div className="fixed right-4 bottom-4 z-[110]">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => controllerRef.current?.fitMap()}
          >
            Fit map
          </Button>
        </div>
      )}
    </div>
  );
}
