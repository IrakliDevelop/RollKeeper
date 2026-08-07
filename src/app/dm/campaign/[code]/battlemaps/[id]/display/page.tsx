'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FieldNotesCanvas } from '@fieldnotes/react';
import { HandTool, type Viewport } from '@fieldnotes/core';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { ensureCanonicalLayers } from '@/components/ui/campaign/location-map/layerContract';
import { makeApplyRemoteLayer } from '@/components/ui/campaign/location-map/layerSync';
import { attachRemoteLaserTrails } from '@/components/ui/campaign/location-map/laserSync';
import { attachRemotePings } from '@/components/ui/campaign/location-map/pingSync';
import { attachRemoteMeasurements } from '@/components/ui/campaign/location-map/measureSync';
import { attachFocusReceiver } from '@/components/ui/campaign/location-map/focusSync';
import { DISPLAY_FOCUS_OPTIONS } from './focusOptions';

function DisplayCanvas() {
  const params = useParams();
  const search = useSearchParams();
  const code = params.code as string;
  const id = params.id as string;
  const displayKey = search.get('dk') ?? '';

  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const laserCleanupRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const toolsRef = useRef([new HandTool()]);

  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  const handleReady = (vp: Viewport) => {
    viewportRef.current = vp;
    // Canonical bands so map/annotation elements stack correctly; custom and
    // player layer definitions arrive over layer sync. Read-only view — the
    // 'player' lock stance is irrelevant here.
    ensureCanonicalLayers(vp, 'player');
    if (!relayUrl || !displayKey) return;
    connectionRef.current?.stop();
    const connection = createManagedBattleMapConnection({
      relayUrl,
      campaignCode: code,
      battleMapId: id,
      store: vp.store,
      clientId: `display-${code}`,
      tokenRequest: { role: 'display', battleMapId: id, displayKey },
      layers: {
        applyLayer: makeApplyRemoteLayer(vp, 'display', {
          onApplied: () => vp.requestRender(),
        }),
      },
      onStatus: s => {
        setStatus(s);
        if (s === 'live') {
          // frame the map once the snapshot has been applied
          requestAnimationFrame(() => vp.fitToContent(60));
        }
      },
    });
    connectionRef.current = connection;
    // Render remote laser trails + map pings (DM pointer) on the TV view.
    laserCleanupRef.current?.();
    const presenceCleanups = [
      attachRemoteLaserTrails(vp, connection),
      attachRemotePings(vp, connection).dispose,
      attachRemoteMeasurements(vp, connection).dispose,
      attachFocusReceiver(vp, connection, DISPLAY_FOCUS_OPTIONS).dispose,
    ];
    laserCleanupRef.current = () => {
      for (const cleanup of presenceCleanups) cleanup();
    };
  };

  useEffect(
    () => () => {
      laserCleanupRef.current?.();
      connectionRef.current?.stop();
    },
    []
  );

  // F toggles fullscreen (kept from the old display page)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const overlayMessage = !relayUrl
    ? 'Live display is not configured'
    : !displayKey
      ? 'Open this display from the battle map editor ("Open TV Display")'
      : status === 'denied'
        ? 'Display link expired — reopen it from the battle map editor'
        : status !== 'live'
          ? 'Connecting to the table…'
          : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <FieldNotesCanvas
        tools={toolsRef.current}
        defaultTool="hand"
        onReady={handleReady}
        options={{ background: { pattern: 'none' } }}
        style={{ width: '100%', height: '100%' }}
      />
      {overlayMessage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1.25rem',
            fontFamily: 'system-ui, sans-serif',
            background: 'rgba(0,0,0,0.75)',
            pointerEvents: 'none',
          }}
        >
          {overlayMessage}
        </div>
      )}
    </div>
  );
}

export default function BattleMapDisplayPage() {
  return (
    <Suspense fallback={null}>
      <DisplayCanvas />
    </Suspense>
  );
}
