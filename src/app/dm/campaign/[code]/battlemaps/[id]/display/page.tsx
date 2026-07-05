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

function DisplayCanvas() {
  const params = useParams();
  const search = useSearchParams();
  const code = params.code as string;
  const id = params.id as string;
  const displayKey = search.get('dk') ?? '';

  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const toolsRef = useRef([new HandTool()]);

  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  const handleReady = (vp: Viewport) => {
    viewportRef.current = vp;
    if (!relayUrl || !displayKey) return;
    connectionRef.current?.stop();
    connectionRef.current = createManagedBattleMapConnection({
      relayUrl,
      campaignCode: code,
      battleMapId: id,
      store: vp.store,
      clientId: `display-${code}`,
      tokenRequest: { role: 'display', battleMapId: id, displayKey },
      onStatus: s => {
        setStatus(s);
        if (s === 'live') {
          // frame the map once the snapshot has been applied
          requestAnimationFrame(() => vp.fitToContent(60));
        }
      },
    });
  };

  useEffect(() => () => connectionRef.current?.stop(), []);

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
