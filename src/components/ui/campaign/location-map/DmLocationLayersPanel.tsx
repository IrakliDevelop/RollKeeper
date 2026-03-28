'use client';

import { Plus, Eye, EyeOff, Lock, Unlock, X } from 'lucide-react';
import { useElements, useLayers, useViewport } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import EncounterLinkingPanel from '../battle-map/EncounterLinkingPanel';
import type { EditorMode } from './DmLocationEditor.types';

interface DmLocationLayersPanelProps {
  mode: EditorMode;
  campaignCode: string;
  linkedEncounterIds: string[];
  onLinkEncounter: (id: string) => void;
  onUnlinkEncounter: (id: string) => void;
  onClose: () => void;
}

export default function DmLocationLayersPanel({
  mode,
  campaignCode,
  linkedEncounterIds,
  onLinkEncounter,
  onUnlinkEncounter,
  onClose,
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

  return (
    <div className="border-divider bg-surface-raised flex w-52 flex-col border-l">
      <div className="border-divider flex items-center justify-between border-b px-3 py-2">
        <span className="text-heading text-xs font-semibold">Layers</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => {
              createLayer();
              viewport.requestRender();
            }}
            title="Add layer"
          >
            <Plus size={12} />
          </Button>
          <Button
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onClose}
            title="Close layers"
          >
            <X size={12} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
        {[...layers].reverse().map(layer => {
          const isActive = layer.id === activeLayerId;
          const isBgLayer = layer.name === 'Map Background';

          return (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isBgLayer) {
                  setActiveLayer(layer.id);
                  viewport.requestRender();
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (!isBgLayer) {
                    setActiveLayer(layer.id);
                    viewport.requestRender();
                  }
                }
              }}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                isBgLayer
                  ? 'text-muted cursor-default opacity-60'
                  : isActive
                    ? 'bg-accent-blue-bg text-accent-blue-text cursor-pointer'
                    : 'text-body hover:bg-surface-secondary cursor-pointer'
              }`}
            >
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setVisible(layer.id, !layer.visible);
                  viewport.requestRender();
                }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                className="shrink-0"
              >
                {layer.visible ? (
                  <Eye size={11} />
                ) : (
                  <EyeOff size={11} className="text-muted" />
                )}
              </button>

              {isBgLayer ? (
                <Lock size={11} className="text-muted shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setLocked(layer.id, !layer.locked);
                    viewport.requestRender();
                  }}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  className="shrink-0"
                >
                  {layer.locked ? (
                    <Lock size={11} className="text-accent-amber-text" />
                  ) : (
                    <Unlock size={11} className="text-muted" />
                  )}
                </button>
              )}

              <span className="min-w-0 flex-1 truncate">{layer.name}</span>

              {!isBgLayer &&
                layers.filter(l => l.name !== 'Map Background').length > 1 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                      viewport.requestRender();
                    }}
                    className="text-muted hover:text-accent-red-text shrink-0"
                    title="Delete layer"
                  >
                    <X size={11} />
                  </button>
                )}
            </div>
          );
        })}
      </div>

      <div className="border-divider text-muted border-t px-3 py-2 text-xs">
        {allElements.length} element{allElements.length !== 1 ? 's' : ''}
      </div>

      {mode === 'battlemap' && (
        <EncounterLinkingPanel
          campaignCode={campaignCode}
          linkedEncounterIds={linkedEncounterIds}
          onLink={onLinkEncounter}
          onUnlink={onUnlinkEncounter}
        />
      )}
    </div>
  );
}
