'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { SyncedBattleMap } from '@/types/battlemap';

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function BattleMapDisplayPage() {
  const params = useParams();
  const code = params.code as string;
  const id = params.id as string;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Fetch from Redis
  const fetchFromRedis = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${code}/battlemaps/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { battleMap: SyncedBattleMap };
      const bm = data.battleMap;
      setImageUrl(bm.snapshotUrl || bm.mapImageUrl);
      setLoading(false);
    } catch {
      // Silently fail — will retry on visibility change
    }
  }, [code, id]);

  // Apply synced data from BroadcastChannel or Redis
  const applySyncData = useCallback((bm: SyncedBattleMap) => {
    setImageUrl(bm.snapshotUrl || bm.mapImageUrl);
    setLoading(false);
  }, []);

  // Initial fetch + BroadcastChannel subscription
  useEffect(() => {
    fetchFromRedis();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(`battlemap:${code}:${id}`);
      channel.onmessage = (event: MessageEvent<SyncedBattleMap>) => {
        applySyncData(event.data);
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      channel?.close();
    };
  }, [code, id, fetchFromRedis, applySyncData]);

  // Visibility change — re-fetch from Redis when tab regains focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFromRedis();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchFromRedis]);

  const zoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(10, prev.scale * 1.2),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, prev.scale / 1.2),
    }));
  }, []);

  // Keyboard: F for fullscreen, +/- for zoom, Escape exits fullscreen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [zoomIn, zoomOut]);

  // Pointer drag for pan
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.x,
        originY: transform.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [transform.x, transform.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform(prev => ({
      ...prev,
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Double-click to reset
  const handleDoubleClick = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        cursor: 'default',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {loading || !imageUrl ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#fff',
            fontSize: '1.25rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Waiting for DM to push map...
        </div>
      ) : (
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: dragRef.current ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      )}

      {/* Fixed zoom controls — bottom-left */}
      <div
        onDoubleClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        }}
      >
        <button
          onClick={zoomIn}
          title="Zoom in (+)"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 22,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          +
        </button>
        <button
          onClick={zoomOut}
          title="Zoom out (−)"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 22,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          −
        </button>
      </div>
    </div>
  );
}
