'use client';
import { BattleMapMovement } from './BattleMapMovement';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Layers } from 'lucide-react';
import { FieldNotesCanvas as Canvas, ViewportContext } from '@fieldnotes/react';
import DmLocationToolbar from './DmLocationToolbar';
import DmLocationToolOptions from './DmLocationToolOptions';
import DmLocationLayersPanel from './DmLocationLayersPanel';
import MarkerDetailPanel from './MarkerDetailPanel';
import { BattleMapExportControl } from './BattleMapExportControl';
import { BattleMapViewsControl } from './BattleMapViewsControl';
import { PresenceControl } from './PresenceControl';
import { useDmLocationEditor } from './DmLocationEditor.hooks';
import type { DmLocationEditorProps } from './DmLocationEditor.types';
import {
  resolveFogRendererOptions,
  resolvePlayerFogStyle,
  useAppliedFogAppearance,
  useFogPresetControls,
} from './fog';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useFogAppearanceProjection } from './fog/useFogAppearanceProjection';
import { useToast, ToastContainer } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import type { BattleMap } from '@/types/battlemap';
import {
  createRollKeeperFogPlugin,
  getViewportFogManager,
  setViewportFogStyle,
} from '@/lib/fieldnotesVtt';

export default function DmLocationEditor(props: DmLocationEditorProps) {
  const linkEncounter = useBattleMapStore(s => s.linkEncounter);
  const unlinkEncounter = useBattleMapStore(s => s.unlinkEncounter);
  const { toasts, addToast, dismissToast } = useToast();
  // Session-scoped only — pure UI state, no connection dependency. Off by
  // default; the DM opts in each session before a focus request can move
  // anyone else's camera.
  const [cameraSharing, setCameraSharing] = useState(false);

  const {
    canvasRef,
    fileInputRef,
    mapImageInputRef,
    viewport,
    tools,
    layersPanelOpen,
    setLayersPanelOpen,
    gridEnabled,
    gridType,
    gridCellSize,
    gridColor,
    gridOpacity,
    handleSetGridType,
    handleUpdateGridSettings,
    selectedElementId,
    isDmOnly,
    handleToggleDmOnly,
    hiddenPlacementActive,
    handleToggleHiddenPlacement,
    hiddenElementCount,
    handleRevealAll,
    syncing,
    hasUnsyncedChanges,
    lastSyncedAt,
    syncStatus,
    syncError,
    sharedWithPlayers,
    handleToggleShareWithPlayers,
    imageUploading,
    handleReady,
    handlePickImage,
    handleClear,
    handleSyncToPlayers,
    handleImageFileSelect,
    handlePickMapImage,
    handleMapImageFileSelect,
    mode,
    liveSyncConfigured,
    handleOpenTvDisplay,
    handleFitToMap,
    arrangeMapsActive,
    handleToggleArrangeMaps,
    publishLayerUpsert,
    publishLayerRemove,
    measureSharing,
    handleSetMeasureSharing,
    pathSharing,
    handleSetPathSharing,
    movementDash,
    handleSetMovementDash,
    awarenessRoster,
    cursorSharing,
    handleSetCursorSharing,
    showPlayerCursors,
    handleSetShowPlayerCursors,
    handleGoToCameraView,
    handleSendCameraView,
    getViewport,
    getDmOnlyElements,
    storeUpdateLocation,
    markerControls,
    selectedElementIsMarker,
    markerAudienceNotice,
    markerPanelOpen,
    markerPanelState,
    markerPanelIsDmOnly,
    handleSetMarkerAudience,
    handleCloseMarkerPanel,
    handleSaveMarkerDetail,
    handleDeleteMarker,
    portalState,
    fogControls,
    handleFogAppearanceChange,
  } = useDmLocationEditor(props);
  const { appearance: fogAppearance, fingerprint: fogFingerprint } =
    useAppliedFogAppearance(props.location.fogAppearance);
  const [fogPlugin] = useState(() =>
    createRollKeeperFogPlugin(resolveFogRendererOptions(fogAppearance))
  );
  useFogAppearanceProjection({
    enabled: liveSyncConfigured,
    mapKind: mode === 'battlemap' ? 'battlemap' : 'location',
    campaignCode: props.campaignCode,
    battleMapId: props.location.id,
    dmId: props.dmId,
    appearance: fogAppearance,
    onError: () => {
      addToast({
        type: 'error',
        title: 'Fog appearance not shared',
        message:
          'Your local choice was saved, but connected viewers may still see the previous appearance. Reopen the map or change the setting to retry.',
      });
    },
  });

  useEffect(() => {
    if (viewport) {
      setViewportFogStyle(viewport, resolveFogRendererOptions(fogAppearance));
    }
    // fogFingerprint stands in for fogAppearance: same material, same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, fogFingerprint]);

  const fogPresetControls = useFogPresetControls({
    campaignCode: props.campaignCode,
    viewport,
    applied: fogAppearance,
    onApply: handleFogAppearanceChange,
  });

  return (
    <ViewportContext.Provider value={viewport}>
      <TooltipProvider>
        <div className="flex h-full min-h-0 flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelect}
          />
          <input
            ref={mapImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleMapImageFileSelect}
          />

          {viewport && (
            <DmLocationToolbar
              onPickImage={handlePickImage}
              onPickMapImage={handlePickMapImage}
              onClear={handleClear}
              onFitToMap={handleFitToMap}
              gridEnabled={gridEnabled}
              gridType={gridType}
              gridCellSize={gridCellSize}
              gridColor={gridColor}
              gridOpacity={gridOpacity}
              onSetGridType={handleSetGridType}
              onUpdateGridSettings={handleUpdateGridSettings}
              onSyncToPlayers={handleSyncToPlayers}
              syncing={syncing}
              hasUnsyncedChanges={hasUnsyncedChanges}
              lastSyncedAt={lastSyncedAt}
              selectedElementId={selectedElementId}
              isDmOnly={isDmOnly}
              onToggleDmOnly={handleToggleDmOnly}
              selectedElementIsMarker={selectedElementIsMarker}
              markerAudienceNotice={markerAudienceNotice}
              hiddenPlacementActive={hiddenPlacementActive}
              onToggleHiddenPlacement={handleToggleHiddenPlacement}
              hiddenElementCount={hiddenElementCount}
              onRevealAll={handleRevealAll}
              mode={mode}
              liveSyncConfigured={liveSyncConfigured}
              onOpenTvDisplay={handleOpenTvDisplay}
              syncStatus={syncStatus}
              sharedWithPlayers={sharedWithPlayers}
              onToggleShareWithPlayers={handleToggleShareWithPlayers}
              arrangeMapsActive={arrangeMapsActive}
              onToggleArrangeMaps={handleToggleArrangeMaps}
              fogControls={fogControls}
              exportControl={
                <BattleMapExportControl
                  getViewport={getViewport}
                  name={props.location.name}
                  mapImageSize={props.location.mapImageSize}
                  getDmOnlyElements={getDmOnlyElements}
                  getFogState={() => getViewportFogManager(viewport).getState()}
                  getFogStyle={() => resolvePlayerFogStyle(fogAppearance)}
                  onError={message =>
                    addToast({ type: 'error', title: 'Export failed', message })
                  }
                />
              }
              viewsControl={
                <BattleMapViewsControl
                  getViewport={getViewport}
                  views={props.location.cameraViews ?? []}
                  sharingEnabled={cameraSharing}
                  onSharingChange={setCameraSharing}
                  onSaveView={(view, name) => {
                    const next = [
                      ...(props.location.cameraViews ?? []),
                      { id: crypto.randomUUID(), name, view },
                    ];
                    storeUpdateLocation(props.campaignCode, props.location.id, {
                      cameraViews: next,
                    });
                  }}
                  onGoToView={handleGoToCameraView}
                  onSend={handleSendCameraView}
                  onRenameView={(id, name) => {
                    const next = (props.location.cameraViews ?? []).map(v =>
                      v.id === id ? { ...v, name } : v
                    );
                    storeUpdateLocation(props.campaignCode, props.location.id, {
                      cameraViews: next,
                    });
                  }}
                  onDeleteView={id => {
                    const next = (props.location.cameraViews ?? []).filter(
                      v => v.id !== id
                    );
                    storeUpdateLocation(props.campaignCode, props.location.id, {
                      cameraViews: next,
                    });
                  }}
                />
              }
              presenceControl={
                <PresenceControl
                  campaignCode={props.campaignCode}
                  roster={awarenessRoster}
                  cursorSharing={cursorSharing}
                  onCursorSharingChange={handleSetCursorSharing}
                  showPlayerCursors={showPlayerCursors}
                  onShowPlayerCursorsChange={handleSetShowPlayerCursors}
                />
              }
            />
          )}
          {syncError && (
            // The raw status text stays in the console (the hook logs it).
            <p
              role="alert"
              className="border-divider type-small text-blood-text flex items-center gap-1.5 border-b px-3 py-1.5"
            >
              <AlertCircle size={14} aria-hidden className="shrink-0" />
              {
                "Couldn't sync to players. They still see the map as you last synced it."
              }
            </p>
          )}

          {viewport && (
            <DmLocationToolOptions
              mode={mode}
              liveSyncConfigured={liveSyncConfigured}
              selectionControls
              measureSharing={{
                enabled: measureSharing,
                onChange: handleSetMeasureSharing,
              }}
              markerControls={markerControls}
              movementControls={{
                sharing: {
                  enabled: pathSharing,
                  onChange: handleSetPathSharing,
                },
                dash: {
                  enabled: movementDash,
                  onChange: handleSetMovementDash,
                },
              }}
              fogControls={fogControls}
              fogPresetControls={fogPresetControls}
            />
          )}

          {/* Mounted only while a marker is active. Painting and activation are
            connection-independent, so this panel opens with no relay URL
            configured — see `useMarkerRegistration` in the hook. */}
          {markerPanelOpen && (
            <MarkerDetailPanel
              open
              mode="dm"
              campaignCode={props.campaignCode}
              dmId={props.dmId}
              state={markerPanelState}
              portalState={portalState}
              onClose={handleCloseMarkerPanel}
              onSave={patch => {
                handleSaveMarkerDetail(patch);
                addToast({
                  type: 'success',
                  title: 'Marker saved',
                  message: 'Marker details were updated.',
                });
                handleCloseMarkerPanel();
              }}
              onPersist={handleSaveMarkerDetail}
              onDelete={handleDeleteMarker}
              isDmOnly={markerPanelIsDmOnly}
              onAudienceChange={handleSetMarkerAudience}
              audienceNotice={markerAudienceNotice}
            />
          )}

          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {arrangeMapsActive && (
              <p
                className={`${OVERLAY_SURFACE} type-small text-body absolute top-2 left-1/2 z-20 -translate-x-1/2 px-3 py-1.5 whitespace-nowrap`}
              >
                Arranging maps — other layers are locked
              </p>
            )}
            {/* The movement bar floats inside the canvas column so it never
              paints over the in-flow layers panel on narrow widths. */}
            <div className="relative min-w-0 flex-1 overflow-hidden">
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
                  plugins: [fogPlugin],
                  requiredCapabilities: ['vtt:fog'],
                }}
                onReady={handleReady}
                className="h-full w-full"
                style={{ minHeight: 0 }}
                snapToGrid={mode === 'battlemap'}
              />

              {viewport && mode === 'battlemap' && (
                <div className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-1.5rem)]">
                  <BattleMapMovement
                    viewport={viewport}
                    campaignCode={props.campaignCode}
                    battleMapId={props.location.id}
                    dash={movementDash}
                    onDashChange={handleSetMovementDash}
                  />
                </div>
              )}
            </div>

            {layersPanelOpen && viewport && (
              <DmLocationLayersPanel
                mode={mode}
                campaignCode={props.campaignCode}
                linkedEncounterIds={
                  mode === 'battlemap'
                    ? ((props.location as BattleMap).linkedEncounterIds ?? [])
                    : []
                }
                onLinkEncounter={id =>
                  linkEncounter(props.campaignCode, props.location.id, id)
                }
                onUnlinkEncounter={id =>
                  unlinkEncounter(props.campaignCode, props.location.id, id)
                }
                onClose={() => setLayersPanelOpen(false)}
                publishLayerUpsert={publishLayerUpsert}
                publishLayerRemove={publishLayerRemove}
              />
            )}

            {!layersPanelOpen && viewport && (
              <Tooltip content="Show layers">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-surface-raised absolute top-2 right-2 z-10 w-9 shrink-0 px-0"
                  aria-label="Show layers"
                  onClick={() => setLayersPanelOpen(true)}
                >
                  <Layers size={16} aria-hidden />
                </Button>
              </Tooltip>
            )}

            {imageUploading && (
              <div className="bg-surface/70 absolute inset-0 z-20 flex items-center justify-center">
                <div
                  role="status"
                  className={`${OVERLAY_SURFACE} flex items-center gap-2 px-4 py-3`}
                >
                  <Loader2
                    size={18}
                    aria-hidden
                    className="text-muted animate-spin"
                  />
                  <span className="type-small text-body">Uploading image…</span>
                </div>
              </div>
            )}
          </div>
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      </TooltipProvider>
    </ViewportContext.Provider>
  );
}
