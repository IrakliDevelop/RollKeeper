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
import { useMarkerRegistration } from '@/components/ui/campaign/location-map/useMarkerRegistration';
import { makeApplyRemoteLayer } from '@/components/ui/campaign/location-map/layerSync';
import { attachRemoteLaserTrails } from '@/components/ui/campaign/location-map/laserSync';
import { attachRemotePings } from '@/components/ui/campaign/location-map/pingSync';
import { attachRemoteMeasurements } from '@/components/ui/campaign/location-map/measureSync';
import { attachFocusReceiver } from '@/components/ui/campaign/location-map/focusSync';
import { attachRemotePaths } from '@/components/ui/campaign/location-map/pathSync';
import { attachAwarenessSync } from '@/components/ui/campaign/location-map/awarenessSync';
import type { AwarenessSyncHandle } from '@/components/ui/campaign/location-map/awarenessSync';
import { attachConnectionScope } from '@/components/ui/campaign/location-map/connectionScope';
import {
  configureFogView,
  resolveFogRendererOptions,
} from '@/components/ui/campaign/location-map/fog';
import { parseFogAppearance } from '@/components/ui/campaign/location-map/fog/fogAppearance';
import {
  fetchAndApplyFogAppearance,
  startFogAppearancePoll,
} from '@/components/ui/campaign/location-map/fog/fogAppearancePoll';
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
  const awarenessRef = useRef<AwarenessSyncHandle | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  // `useMarkerRegistration` is keyed on the viewport VALUE (not a ref), so it
  // needs its own state slot even though nothing else on this page reads
  // viewport-dependent chrome. Keep `viewportRef` too — other code here
  // reads it synchronously inside `handleReady`. One extra render on ready
  // is acceptable.
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const toolsRef = useRef([new HandTool()]);

  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  // OUTSIDE the `if (relayUrl)` guard below, and NOT part of
  // `laserCleanupRef`/`connectionRef` or any other connection-scoped
  // cleanup: painter registration is connection-independent (spec §7.2) and
  // must work with no relay URL configured. `gesture: null` is the contract
  // for "register the marker painter, never call setActivation" (task B6)
  // — the TV display is deliberately non-interactive, so nothing here ever
  // opens a panel.
  useMarkerRegistration({ viewport, gesture: null });

  const handleReady = (vp: Viewport) => {
    viewportRef.current = vp;
    setViewport(vp);
    configureFogView(vp.fog, 'display', false);
    // Canonical bands so map/annotation elements stack correctly; custom and
    // player layer definitions arrive over layer sync. Read-only view — the
    // 'player' lock stance is irrelevant here.
    ensureCanonicalLayers(vp, 'player');
    if (!relayUrl || !displayKey) return;
    // Re-attach: tear down the OLD connection-scoped handles BEFORE stopping
    // the old connection, so their final frames (awareness `cleared`, etc.)
    // ride the still-live socket — the same order the unmount effect uses.
    laserCleanupRef.current?.();
    laserCleanupRef.current = null;
    connectionRef.current?.stop();
    connectionRef.current = null;
    const connection = createManagedBattleMapConnection({
      relayUrl,
      campaignCode: code,
      battleMapId: id,
      store: vp.store,
      clientId: `display-${code}`,
      tokenRequest: { role: 'display', battleMapId: id, displayKey },
      fog: { manager: vp.fog },
      layers: {
        applyLayer: makeApplyRemoteLayer(vp, 'display', {
          onApplied: () => vp.requestRender(),
        }),
      },
      onTokenMetadata: meta => {
        const appearance = parseFogAppearance(meta.fogAppearance);
        vp.setFogStyle(resolveFogRendererOptions(appearance));
      },
      onStatus: s => {
        setStatus(s);
        if (s === 'live') {
          requestAnimationFrame(() => vp.fitToContent(60));
          awarenessRef.current?.announce();
        }
      },
      onPoke: feature => {
        if (feature === 'fog-appearance') {
          fetchAndApplyFogAppearance(
            vp,
            `/api/campaign/${code}/battlemaps/${id}/fog-appearance?role=display&displayKey=${encodeURIComponent(displayKey)}`
          );
        }
      },
    });
    connectionRef.current = connection;
    // Render remote laser trails + map pings (DM pointer) on the TV view.
    //
    // The whole attach sequence runs inside a connection scope: if any
    // helper below throws, everything already created is unwound (in push
    // order) and the NEW connection is stopped before the error surfaces —
    // no half-attached handles, no orphaned socket. On success the returned
    // composite cleanup is what laserCleanupRef carries forward (unmount and
    // re-attach both call it before connection.stop()).
    try {
      laserCleanupRef.current = attachConnectionScope(connection, scope => {
        scope.push(attachRemoteLaserTrails(vp, connection));
        scope.push(attachRemotePings(vp, connection).dispose);
        scope.push(attachRemoteMeasurements(vp, connection).dispose);
        scope.push(
          attachFocusReceiver(vp, connection, DISPLAY_FOCUS_OPTIONS).dispose
        );
        scope.push(attachRemotePaths(vp, connection).dispose);

        // Shared presence, identity only: the DM's "who is viewing" shows the
        // TV as connected; the TV draws the DM's cursor when the DM shares it
        // and never players' (awarenessSync CURSOR_RULES.display).
        const awareness = attachAwarenessSync(vp, connection, {
          identity: {
            id: `display-${code}`,
            name: 'TV display',
            role: 'display',
          },
          shareCursor: false,
          showPlayerCursors: true,
        });
        awarenessRef.current = awareness;
        scope.push(() => {
          awarenessRef.current = null;
          awareness.dispose();
        });

        scope.push(
          startFogAppearancePoll({
            viewport: vp,
            url: `/api/campaign/${code}/battlemaps/${id}/fog-appearance?role=display&displayKey=${encodeURIComponent(displayKey)}`,
          })
        );
      });
    } catch (error) {
      // attachConnectionScope already disposed every helper it saw and
      // stopped `connection`; drop the dead reference so unmount and the
      // next re-attach do not stop it twice, then surface the error.
      connectionRef.current = null;
      throw error;
    }
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
        options={{ background: { pattern: 'none' }, fog: {} }}
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
