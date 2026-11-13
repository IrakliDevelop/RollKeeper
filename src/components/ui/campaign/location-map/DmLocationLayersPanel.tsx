'use client';

import { Plus, Eye, EyeOff, Lock, Unlock, X } from 'lucide-react';
import { useElements, useLayers, useViewport } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import EncounterLinkingPanel from '../battle-map/EncounterLinkingPanel';
import {
  MAP_LAYER_ID,
  ANNOTATIONS_LAYER_ID,
  PLAYER_LAYER_PREFIX,
} from './layerContract';
import type { EditorMode } from './DmLocationEditor.types';
import type { Layer } from '@fieldnotes/core';

/** Row icon buttons: 28px on desktop, 44px on touch from the primitive. */
const ROW_ICON_BUTTON = 'w-7 shrink-0 px-0';

interface DmLocationLayersPanelProps {
  mode: EditorMode;
  campaignCode: string;
  linkedEncounterIds: string[];
  onLinkEncounter: (id: string) => void;
  onUnlinkEncounter: (id: string) => void;
  onClose: () => void;
  /** Battlemap mode: broadcast panel edits over layer sync (custom layers only). */
  publishLayerUpsert?: (definition: Layer) => void;
  publishLayerRemove?: (id: string) => void;
}

export default function DmLocationLayersPanel({
  mode,
  campaignCode,
  linkedEncounterIds,
  onLinkEncounter,
  onUnlinkEncounter,
  onClose,
  publishLayerUpsert,
  publishLayerRemove,
}: DmLocationLayersPanelProps) {
  const viewport = useViewport();
  const {
    layers,
    activeLayerId,
    createLayer,
    removeLayer,
    setVisible,
    setLocked,
    setActiveLayer,
  } = useLayers();
  const allElements = useElements();

  // Canonical bands are locally pinned per role and never broadcast; only
  // custom layer definitions ride layer sync.
  const publishIfCustom = (id: string) => {
    if (id === MAP_LAYER_ID || id === ANNOTATIONS_LAYER_ID) return;
    const layer = viewport.layerManager.getLayer(id);
    if (layer) publishLayerUpsert?.(layer);
  };

  return (
    <TooltipProvider>
      <div className="border-divider bg-surface-secondary flex w-52 flex-col border-l pointer-coarse:w-64">
        <div className="border-divider flex items-center justify-between border-b px-3 py-2">
          <h2 className="type-ui text-heading">Layers</h2>
          <div className="flex items-center gap-1">
            <Tooltip content="Add layer">
              <Button
                variant="ghost"
                size="sm"
                className="w-9 shrink-0 px-0"
                aria-label="Add layer"
                onClick={() => {
                  const layer = createLayer();
                  publishIfCustom(layer.id);
                  viewport.requestRender();
                }}
              >
                <Plus size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Close layers">
              <Button
                variant="ghost"
                size="sm"
                className="w-9 shrink-0 px-0"
                aria-label="Close layers"
                onClick={onClose}
              >
                <X size={16} />
              </Button>
            </Tooltip>
          </div>
        </div>

        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
          {[...layers]
            .filter(l => !l.id.startsWith(PLAYER_LAYER_PREFIX))
            .reverse()
            .map(layer => {
              const isActive = layer.id === activeLayerId;
              const isBgLayer = layer.id === MAP_LAYER_ID;
              // SDK removeLayer reparents a deleted layer's elements to the
              // highest-order fallback layer (a player-* mirror on DM
              // canvases) — deleting layer-annotations would merge DM content
              // into a player-owned layer id. Never offer delete for it.
              const isProtectedLayer =
                isBgLayer || layer.id === ANNOTATIONS_LAYER_ID;
              const visibilityLabel = layer.visible
                ? 'Hide layer'
                : 'Show layer';
              const lockLabel = layer.locked ? 'Unlock layer' : 'Lock layer';

              return (
                <li
                  key={layer.id}
                  role="group"
                  aria-label={layer.name}
                  className="flex items-center gap-0.5 pointer-coarse:min-h-11"
                >
                  <Tooltip content={visibilityLabel}>
                    <Button
                      variant="ghost"
                      size="xs"
                      className={ROW_ICON_BUTTON}
                      aria-label={visibilityLabel}
                      onClick={() => {
                        setVisible(layer.id, !layer.visible);
                        publishIfCustom(layer.id);
                        viewport.requestRender();
                      }}
                    >
                      {layer.visible ? (
                        <Eye size={14} aria-hidden />
                      ) : (
                        <EyeOff size={14} aria-hidden />
                      )}
                    </Button>
                  </Tooltip>

                  {isBgLayer ? (
                    <>
                      <Lock
                        size={14}
                        aria-hidden
                        className="text-muted shrink-0"
                      />
                      <span className="type-small text-muted min-w-0 flex-1 truncate px-2">
                        {layer.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <Tooltip content={lockLabel}>
                        <Button
                          variant="ghost"
                          size="xs"
                          className={ROW_ICON_BUTTON}
                          aria-label={lockLabel}
                          onClick={() => {
                            setLocked(layer.id, !layer.locked);
                            publishIfCustom(layer.id);
                            viewport.requestRender();
                          }}
                        >
                          {layer.locked ? (
                            <Lock size={14} aria-hidden />
                          ) : (
                            <Unlock size={14} aria-hidden />
                          )}
                        </Button>
                      </Tooltip>
                      <Button
                        variant="ghost"
                        size="xs"
                        selected={isActive}
                        aria-pressed={isActive}
                        className="min-w-0 flex-1 justify-start px-2"
                        onClick={() => {
                          setActiveLayer(layer.id);
                          viewport.requestRender();
                        }}
                      >
                        <span className="truncate">{layer.name}</span>
                      </Button>
                    </>
                  )}

                  {!isProtectedLayer && (
                    <Tooltip content="Delete layer">
                      <Button
                        variant="danger"
                        size="xs"
                        className={ROW_ICON_BUTTON}
                        aria-label="Delete layer"
                        onClick={() => {
                          removeLayer(layer.id);
                          if (
                            layer.id !== MAP_LAYER_ID &&
                            layer.id !== ANNOTATIONS_LAYER_ID
                          ) {
                            publishLayerRemove?.(layer.id);
                          }
                          viewport.requestRender();
                        }}
                      >
                        <X size={14} aria-hidden />
                      </Button>
                    </Tooltip>
                  )}
                </li>
              );
            })}
        </ul>

        <p className="border-divider type-small text-muted border-t px-3 py-2">
          {allElements.length} element{allElements.length !== 1 ? 's' : ''}
        </p>

        {mode === 'battlemap' && (
          <EncounterLinkingPanel
            campaignCode={campaignCode}
            linkedEncounterIds={linkedEncounterIds}
            onLink={onLinkEncounter}
            onUnlink={onUnlinkEncounter}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
