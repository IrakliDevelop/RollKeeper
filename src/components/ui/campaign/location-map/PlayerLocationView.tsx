'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Map as MapIcon, Loader2, X, Maximize2 } from 'lucide-react';
import { FieldNotesCanvas as Canvas } from '@fieldnotes/react';
import { HandTool, type Viewport } from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import { useLocationSync } from '@/hooks/useLocationSync';
import type { LocationMetadata, SyncedLocation } from '@/types/location';

interface PlayerLocationViewProps {
  characterId: string;
  campaignCode: string | undefined;
}

/* ─── Fullscreen lightbox with pan / zoom ───────────────────── */

function MapLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Track active pointers for pan + pinch-to-zoom
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    originX: number;
    originY: number;
    originScale: number;
    startMidX: number;
    startMidY: number;
    startDist: number;
  } | null>(null);

  // Wheel zoom (desktop)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.1, Math.min(10, prev.scale * delta)),
      }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Prevent iOS Safari bounce / pull-to-refresh inside the lightbox
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  const getMidpoint = useCallback(
    (pointers: Map<number, { x: number; y: number }>) => {
      const pts = Array.from(pointers.values());
      const sumX = pts.reduce((s, p) => s + p.x, 0);
      const sumY = pts.reduce((s, p) => s + p.y, 0);
      return { x: sumX / pts.length, y: sumY / pts.length };
    },
    []
  );

  const getDistance = useCallback(
    (pointers: Map<number, { x: number; y: number }>) => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only capture on the image container, not buttons
      if (containerRef.current?.contains(e.target as Node)) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const mid = getMidpoint(pointersRef.current);
      gestureRef.current = {
        originX: transform.x,
        originY: transform.y,
        originScale: transform.scale,
        startMidX: mid.x,
        startMidY: mid.y,
        startDist: getDistance(pointersRef.current),
      };
    },
    [transform.x, transform.y, transform.scale, getMidpoint, getDistance]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const mid = getMidpoint(pointersRef.current);

      // Pan
      const dx = mid.x - gesture.startMidX;
      const dy = mid.y - gesture.startMidY;

      // Pinch zoom (2+ pointers)
      let newScale = gesture.originScale;
      if (pointersRef.current.size >= 2 && gesture.startDist > 0) {
        const currentDist = getDistance(pointersRef.current);
        newScale = Math.max(
          0.1,
          Math.min(10, gesture.originScale * (currentDist / gesture.startDist))
        );
      }

      setTransform({
        x: gesture.originX + dx,
        y: gesture.originY + dy,
        scale: newScale,
      });
    },
    [getMidpoint, getDistance]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);

      if (pointersRef.current.size === 0) {
        gestureRef.current = null;
      } else {
        // Remaining fingers — reset gesture origin so pan doesn't jump
        setTransform(prev => {
          const mid = getMidpoint(pointersRef.current);
          gestureRef.current = {
            originX: prev.x,
            originY: prev.y,
            originScale: prev.scale,
            startMidX: mid.x,
            startMidY: mid.y,
            startDist: getDistance(pointersRef.current),
          };
          return prev;
        });
      }
    },
    [getMidpoint, getDistance]
  );

  // Close on backdrop click (click that didn't drag)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const handleBackdropPointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if click target is the backdrop itself (not children)
      if (e.target !== e.currentTarget) return;
      // Only close if pointer didn't move (not a drag)
      const down = pointerDownPosRef.current;
      if (down) {
        const dist = Math.sqrt(
          (e.clientX - down.x) ** 2 + (e.clientY - down.y) ** 2
        );
        if (dist > 5) return;
      }
      onClose();
    },
    [onClose]
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
      onPointerDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        <X size={22} />
      </button>

      {/* Reset zoom */}
      <button
        onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
        className="absolute right-4 bottom-4 z-10 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        Reset zoom
      </button>

      {/* Pannable / zoomable image */}
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <img
            src={src}
            alt="Location map"
            draggable={false}
            className="max-h-full max-w-full object-contain select-none"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Main component ────────────────────────────────────────── */

export default function PlayerLocationView({
  campaignCode,
}: PlayerLocationViewProps) {
  const { locations, loading, fetchLocationState } =
    useLocationSync(campaignCode);

  const [selectedLocation, setSelectedLocation] =
    useState<LocationMetadata | null>(null);
  const [canvasState, setCanvasState] = useState<SyncedLocation | null>(null);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasError, setCanvasError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const canvasRef = useRef<FieldNotesCanvasRef>(null);
  const tools = useMemo(() => [new HandTool()], []);

  const handleSelectLocation = useCallback(
    async (location: LocationMetadata) => {
      setSelectedLocation(location);
      setCanvasState(null);
      setCanvasError(false);
      setCanvasLoading(true);
      try {
        const state = await fetchLocationState(location.id);
        if (!state) {
          setCanvasError(true);
        } else {
          setCanvasState(state);
        }
      } catch {
        setCanvasError(true);
      } finally {
        setCanvasLoading(false);
      }
    },
    [fetchLocationState]
  );

  // Auto-select if only one location
  const prevLocationsLengthRef = useRef(0);
  if (
    locations.length === 1 &&
    prevLocationsLengthRef.current !== 1 &&
    !selectedLocation
  ) {
    prevLocationsLengthRef.current = 1;
    setTimeout(() => handleSelectLocation(locations[0]), 0);
  } else if (locations.length !== 1) {
    prevLocationsLengthRef.current = locations.length;
  }

  const handleReady = useCallback(
    (vp: Viewport) => {
      if (!canvasState?.canvasState) return;
      const img = new window.Image();
      img.onload = () => {
        try {
          vp.loadJSON(canvasState.canvasState);
          vp.requestRender();
        } catch {
          // State may be malformed
        }
      };
      img.onerror = () => {
        try {
          vp.loadJSON(canvasState.canvasState);
          vp.requestRender();
        } catch {
          // ignore
        }
      };
      img.src = canvasState.mapImageUrl;
    },
    [canvasState]
  );

  const handleBack = useCallback(() => {
    setSelectedLocation(null);
    setCanvasState(null);
    setCanvasError(false);
  }, []);

  const hasSnapshot = !!canvasState?.snapshotUrl;
  const hasCanvas = !!(
    canvasState?.canvasState && canvasState.canvasState.length > 0
  );

  // Empty state
  if (!campaignCode || (!loading && locations.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <MapIcon size={36} className="text-faint" />
          <p className="text-muted text-sm">No maps shared yet</p>
        </div>
      </div>
    );
  }

  // Loading locations list
  if (loading && locations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <Loader2 size={24} className="text-muted animate-spin" />
      </div>
    );
  }

  // Map view — a location is selected
  if (selectedLocation) {
    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="border-divider bg-surface-raised flex items-center gap-2 border-b px-3 py-2">
          {locations.length > 1 && (
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleBack}
              title="Back to map list"
            >
              <ArrowLeft size={15} />
            </Button>
          )}
          <span className="text-heading truncate text-sm font-semibold">
            {selectedLocation.name}
          </span>
        </div>

        {/* Map area */}
        <div className="relative">
          {canvasLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="text-muted animate-spin" />
            </div>
          )}

          {canvasError && (
            <div className="flex items-center justify-center py-24">
              <p className="text-muted text-sm">No map available</p>
            </div>
          )}

          {!canvasLoading && !canvasError && canvasState && (
            <>
              {hasSnapshot ? (
                <>
                  {/* Fitted preview image */}
                  <div
                    className="group relative cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <img
                      src={canvasState.snapshotUrl}
                      alt={selectedLocation.name}
                      className="w-full rounded-b-lg object-contain"
                      style={{ maxHeight: '60vh' }}
                    />
                    {/* Expand overlay */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-b-lg bg-black/0 transition-colors group-hover:bg-black/20">
                      <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-3 py-1.5 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                        <Maximize2 size={13} />
                        Click to expand
                      </div>
                    </div>
                  </div>

                  {/* Fullscreen lightbox */}
                  {lightboxOpen && (
                    <MapLightbox
                      src={canvasState.snapshotUrl!}
                      onClose={() => setLightboxOpen(false)}
                    />
                  )}
                </>
              ) : hasCanvas ? (
                <div style={{ height: '60vh' }}>
                  <Canvas
                    ref={canvasRef}
                    tools={tools}
                    defaultTool="hand"
                    options={{
                      background: {
                        pattern: 'dots',
                        color: '#cbd5e1',
                        spacing: 24,
                        dotRadius: 1,
                      },
                      camera: { minZoom: 0.1, maxZoom: 5 },
                    }}
                    onReady={handleReady}
                    className="h-full w-full"
                    style={{ minHeight: 0 }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-24">
                  <p className="text-muted text-sm">No map available</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Location list view
  return (
    <div className="p-4">
      <h2 className="text-heading mb-4 text-sm font-semibold">Maps</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {locations.map(location => (
          <button
            key={location.id}
            onClick={() => handleSelectLocation(location)}
            className="bg-surface-raised border-divider group overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="bg-surface-secondary relative h-40 w-full overflow-hidden">
              {location.mapImageUrl ? (
                <img
                  src={location.mapImageUrl}
                  alt={location.name}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="text-muted flex h-full w-full items-center justify-center">
                  <MapIcon size={28} />
                </div>
              )}
            </div>
            <div className="bg-surface-raised border-divider border-t px-3 py-2 text-left">
              <p className="text-heading truncate text-sm font-semibold">
                {location.name}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
