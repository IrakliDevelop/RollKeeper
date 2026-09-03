'use client';

import { useState } from 'react';
import { Loader2, Layers } from 'lucide-react';
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
import { useBattleMapStore } from '@/store/battleMapStore';
import { useToast, ToastContainer } from '@/components/ui/feedback/Toast';
import type { BattleMap } from '@/types/battlemap';

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
  } = useDmLocationEditor(props);

  return (
    <ViewportContext.Provider value={viewport}>
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
            onOpenTvDisplay={handleOpenTvDisplay}
            syncStatus={syncStatus}
            sharedWithPlayers={sharedWithPlayers}
            onToggleShareWithPlayers={handleToggleShareWithPlayers}
            arrangeMapsActive={arrangeMapsActive}
            onToggleArrangeMaps={handleToggleArrangeMaps}
            exportControl={
              <BattleMapExportControl
                getViewport={getViewport}
                name={props.location.name}
                mapImageSize={props.location.mapImageSize}
                getDmOnlyElements={getDmOnlyElements}
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

        {viewport && (
          <DmLocationToolOptions
            mode={mode}
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
            <div className="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg">
              Arranging maps — other layers are locked
            </div>
          )}
          <div className="flex-1 overflow-hidden">
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
              snapToGrid={mode === 'battlemap'}
            />
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
            <button
              type="button"
              onClick={() => setLayersPanelOpen(true)}
              title="Show layers"
              className="border-divider bg-surface-raised text-muted hover:text-body absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border shadow-sm"
            >
              <Layers size={15} />
            </button>
          )}

          {imageUploading && (
            <div className="bg-surface/70 absolute inset-0 z-20 flex items-center justify-center">
              <div className="border-divider bg-surface flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg">
                <Loader2
                  size={18}
                  className="text-accent-blue-text animate-spin"
                />
                <span className="text-body text-sm">Uploading image…</span>
              </div>
            </div>
          )}
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ViewportContext.Provider>
  );
}
