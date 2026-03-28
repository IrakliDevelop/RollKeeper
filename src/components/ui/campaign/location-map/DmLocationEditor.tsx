'use client';

import { Loader2, Layers } from 'lucide-react';
import { FieldNotesCanvas as Canvas, ViewportContext } from '@fieldnotes/react';
import DmLocationToolbar from './DmLocationToolbar';
import DmLocationToolOptions from './DmLocationToolOptions';
import DmLocationLayersPanel from './DmLocationLayersPanel';
import { useDmLocationEditor } from './DmLocationEditor.hooks';
import type { DmLocationEditorProps } from './DmLocationEditor.types';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

export default function DmLocationEditor(props: DmLocationEditorProps) {
  const linkEncounter = useBattleMapStore(s => s.linkEncounter);
  const unlinkEncounter = useBattleMapStore(s => s.unlinkEncounter);

  const {
    canvasRef,
    fileInputRef,
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
    syncing,
    hasUnsyncedChanges,
    lastSyncedAt,
    imageUploading,
    handleReady,
    handlePickImage,
    handleDeleteSelected,
    handleClear,
    handleSyncToPlayers,
    handleDownloadExport,
    handleImageFileSelect,
    mode,
    handleOpenTvDisplay,
    handleFitToMap,
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

        {viewport && (
          <DmLocationToolbar
            onPickImage={handlePickImage}
            onDelete={handleDeleteSelected}
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
            onDownloadExport={handleDownloadExport}
            syncing={syncing}
            hasUnsyncedChanges={hasUnsyncedChanges}
            lastSyncedAt={lastSyncedAt}
            selectedElementId={selectedElementId}
            isDmOnly={isDmOnly}
            onToggleDmOnly={handleToggleDmOnly}
            mode={mode}
            onOpenTvDisplay={handleOpenTvDisplay}
          />
        )}

        {viewport && <DmLocationToolOptions />}

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
      </div>
    </ViewportContext.Provider>
  );
}
