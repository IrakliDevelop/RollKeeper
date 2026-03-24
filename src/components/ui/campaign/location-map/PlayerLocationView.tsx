'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, Map, Loader2 } from 'lucide-react';
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
    // Defer to avoid calling setState during render
    setTimeout(() => handleSelectLocation(locations[0]), 0);
  } else if (locations.length !== 1) {
    prevLocationsLengthRef.current = locations.length;
  }

  const handleReady = useCallback(
    (vp: Viewport) => {
      if (!canvasState?.canvasState) return;
      try {
        vp.loadJSON(canvasState.canvasState);
        // Center camera on the map and reset zoom
        const { w, h } = canvasState.mapImageSize;
        vp.camera.moveTo(w / 2, h / 2);
        vp.camera.setZoom(1);
      } catch {
        // State may be malformed — leave canvas blank
      }
    },
    [canvasState]
  );

  const handleBack = useCallback(() => {
    setSelectedLocation(null);
    setCanvasState(null);
    setCanvasError(false);
  }, []);

  // Empty state — no campaign or no locations
  if (!campaignCode || (!loading && locations.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Map size={36} className="text-faint" />
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
      <div className="flex h-full flex-col">
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

        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden">
          {canvasLoading && (
            <div className="bg-surface/70 absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 size={24} className="text-muted animate-spin" />
            </div>
          )}

          {canvasError && (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted text-sm">No map available</p>
            </div>
          )}

          {!canvasLoading && !canvasError && canvasState && (
            <Canvas
              ref={canvasRef}
              tools={tools}
              defaultTool="hand"
              onReady={handleReady}
              className="h-full w-full"
            />
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
            {/* Thumbnail */}
            <div className="bg-surface-secondary relative h-40 w-full overflow-hidden">
              {location.mapImageUrl ? (
                <img
                  src={location.mapImageUrl}
                  alt={location.name}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="text-muted flex h-full w-full items-center justify-center">
                  <Map size={28} />
                </div>
              )}
            </div>

            {/* Name */}
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
