'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
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
import { configureFogView } from '@/components/ui/campaign/location-map/fog';
import {
  applyFogAppearanceMetadata,
  fetchAndApplyFogAppearance,
  startFogAppearancePoll,
} from '@/components/ui/campaign/location-map/fog/fogAppearancePoll';
import { fogAppearanceReadUrl } from '@/components/ui/campaign/table/sideChannelRequests';
import {
  bootstrapMapPinnedDisplay,
  scrubDisplayUrl,
} from '@/components/ui/campaign/table/display/displayCredentialStore';
import { TableDisplayShell } from '@/components/ui/campaign/table/display/TableDisplayShell';
import { DISPLAY_FOCUS_OPTIONS } from './focusOptions';
import {
  createRollKeeperFogPlugin,
  installVttGridController,
} from '@/lib/fieldnotesVtt';

/**
 * Legacy (Table v1 off) map-pinned TV display. The `?dk=` key is consumed
 * from the location into this tab's session storage and scrubbed from the
 * URL before any request (PR05 E8); authorization is unchanged. The
 * explicit DM "Views → Display" send (focus receiver) is kept (R4-F4).
 */
function DisplayCanvas({ code, id }: { code: string; id: string }) {
  // The credential comes only from the consumed location/storage (never
  // from useSearchParams after the scrub, C5-4).
  // `FieldNotesCanvas` calls `onReady` once on mount, so the canvas mounts
  // only after the key is consumed.
  const [displayKey, setDisplayKey] = useState<string | null>(null);
  const bootRef = useRef<string | null>(null);
  useEffect(() => {
    if (bootRef.current === null) {
      const boot = bootstrapMapPinnedDisplay(code, false);
      bootRef.current = boot.status === 'legacy' ? boot.displayKey : '';
    }
    setDisplayKey(bootRef.current);
  }, [code]);
  // After the router's history patch exists (the next commit), so a later
  // router history sync cannot restore `?dk=` (see scrubDisplayUrl).
  useEffect(() => {
    if (displayKey !== null) scrubDisplayUrl();
  }, [displayKey]);

  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const laserCleanupRef = useRef<(() => void) | null>(null);
  const awarenessRef = useRef<AwarenessSyncHandle | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  // E11: one pending first-live fit per canvas; cancelled on teardown.
  const fitFrameRef = useRef<number | null>(null);
  // `useMarkerRegistration` is keyed on the viewport VALUE (not a ref), so it
  // needs its own state slot even though nothing else on this page reads
  // viewport-dependent chrome. Keep `viewportRef` too — other code here
  // reads it synchronously inside `handleReady`. One extra render on ready
  // is acceptable.
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const toolsRef = useRef([new HandTool()]);
  const fogPlugin = useMemo(() => createRollKeeperFogPlugin(), []);

  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  // P10: the token route's 403 body decides the cover wording.
  const [tokenDenied, setTokenDenied] = useState(false);

  // OUTSIDE the `if (relayUrl)` guard below, and NOT part of
  // `laserCleanupRef`/`connectionRef` or any other connection-scoped
  // cleanup: painter registration is connection-independent (spec §7.2) and
  // must work with no relay URL configured. `gesture: null` is the contract
  // for "register the marker painter, never call setActivation" (task B6)
  // — the TV display is deliberately non-interactive, so nothing here ever
  // opens a panel.
  useMarkerRegistration({ viewport, gesture: null });

  const cancelFit = () => {
    if (fitFrameRef.current !== null) cancelAnimationFrame(fitFrameRef.current);
    fitFrameRef.current = null;
  };

  const handleReady = (vp: Viewport) => {
    viewportRef.current = vp;
    setViewport(vp);
    const fogManager = fogPlugin.manager;
    installVttGridController(vp);
    configureFogView(fogManager, 'display', false);
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
    cancelFit();
    // E11: fit only on the first `live` of this canvas — never on later
    // authority notifications or reconnects (the camera stays where the
    // TV, or an explicit DM "Views → Display" send, put it).
    let fitted = false;
    const connection = createManagedBattleMapConnection({
      relayUrl,
      campaignCode: code,
      battleMapId: id,
      store: vp.store,
      clientId: `display-${code}`,
      tokenRequest: { role: 'display', battleMapId: id, displayKey },
      fog: { manager: fogManager },
      layers: {
        applyLayer: makeApplyRemoteLayer(vp, 'display', {
          onApplied: () => vp.requestRender(),
        }),
      },
      onTokenDenied: denial =>
        setTokenDenied(denial.status === 403 || denial.status === 400),
      onTokenMetadata: meta => {
        setTokenDenied(false);
        applyFogAppearanceMetadata(
          vp,
          meta.fogAppearance,
          meta.fogAppearanceUpdatedAt
        );
      },
      onStatus: s => {
        setStatus(s);
        if (s === 'live') {
          if (!fitted) {
            fitted = true;
            fitFrameRef.current = requestAnimationFrame(() => {
              fitFrameRef.current = null;
              vp.fitToContent(60);
            });
          }
          awarenessRef.current?.announce();
        }
      },
      onPoke: feature => {
        if (feature === 'fog-appearance') {
          fetchAndApplyFogAppearance(
            vp,
            fogAppearanceReadUrl('battlemap', code, id, {
              role: 'display',
              displayKey,
            })
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
      });
    } catch (error) {
      // attachConnectionScope already disposed every helper it saw and
      // stopped `connection`; drop the dead reference so unmount and the
      // next re-attach do not stop it twice, then surface the error.
      connectionRef.current = null;
      throw error;
    }
  };

  useEffect(() => {
    if (!viewport || !relayUrl || !displayKey) return;
    return startFogAppearancePoll({
      viewport,
      url: fogAppearanceReadUrl('battlemap', code, id, {
        role: 'display',
        displayKey,
      }),
    });
  }, [viewport, relayUrl, displayKey, id, code]);

  useEffect(
    () => () => {
      laserCleanupRef.current?.();
      laserCleanupRef.current = null;
      connectionRef.current?.stop();
      connectionRef.current = null;
      if (fitFrameRef.current !== null)
        cancelAnimationFrame(fitFrameRef.current);
      fitFrameRef.current = null;
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
    : displayKey === null
      ? 'Connecting to the table…'
      : !displayKey
        ? 'Open this display from the battle map editor ("Open TV Display")'
        : status === 'denied' || (status !== 'live' && tokenDenied)
          ? 'Display link expired — reopen it from the battle map editor'
          : status !== 'live'
            ? 'Connecting to the table…'
            : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {displayKey !== null && (
        <FieldNotesCanvas
          tools={toolsRef.current}
          defaultTool="hand"
          onReady={handleReady}
          options={{
            background: { pattern: 'none' },
            plugins: [fogPlugin],
            requiredCapabilities: ['vtt:fog'],
          }}
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {overlayMessage && (
        <div
          data-testid="battlemap-bootstrap-privacy-cover"
          style={{
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
          }}
        >
          {overlayMessage}
        </div>
      )}
    </div>
  );
}

/**
 * Map-pinned display. Under Table v1 (PR05 E8, R4-F3) an old map-pinned URL
 * is the campaign display restricted to this map: `?dk=` is consumed and
 * scrubbed before any request, the descriptor binds the session nonce
 * before any mint, and only a presented scene adopted from this map is
 * shown; anything else is the neutral "Nothing is being shown on this map
 * right now" cover. No legacy access grant exists.
 */
export default function BattleMapDisplayPage() {
  const params = useParams();
  const code = params.code as string;
  const id = params.id as string;
  const tableV1 = process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED === 'true';
  return (
    <Suspense fallback={null}>
      {tableV1 ? (
        <TableDisplayShell code={code} mapId={id} />
      ) : (
        <DisplayCanvas code={code} id={id} />
      )}
    </Suspense>
  );
}
