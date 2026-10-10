'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ImageOff, Layers, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { TableSceneRecordV1 } from '@/lib/table/schema';

export const SCENES_PANEL_ID = 'table-scenes-panel';
/** FU-6: stable id — the toggle remounts with the scene's header. */
export const SCENES_TOGGLE_ID = 'table-scenes-toggle';

/** Header toggle for the private Scenes panel (W5/W12). */
export function TableScenesToggle(props: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={props.open ? 'primary' : 'outline'}
      size="sm"
      id={SCENES_TOGGLE_ID}
      aria-expanded={props.open}
      aria-controls={SCENES_PANEL_ID}
      onClick={props.onToggle}
    >
      <Layers size={14} aria-hidden="true" />
      Scenes
    </Button>
  );
}

const VIDEO = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/iu;

/** R3-F13: `<img>` only; blank, video or broken images show a placeholder. */
function SceneThumbnail(props: { url: string }) {
  const [broken, setBroken] = useState(false);
  if (!props.url || broken || VIDEO.test(props.url)) {
    return (
      <span className="bg-surface-secondary text-muted flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded text-[10px]">
        <ImageOff size={14} aria-hidden="true" />
        No image
      </span>
    );
  }
  return (
    // Local, DM-only thumbnail straight from the scene record (W5): no
    // proxy, no referrer, lazily loaded; never a video element.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.url}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setBroken(true)}
      className="bg-surface-secondary h-12 w-16 shrink-0 rounded object-cover"
    />
  );
}

/**
 * W5 private scene browser. Every name, thumbnail and badge comes from the
 * local workspace on this DM page; selecting a scene is private preparation
 * (it never shows, blanks or unpresents anything).
 */
export function TableSceneBrowser(props: {
  open: boolean;
  onClose: () => void;
  scenes: readonly TableSceneRecordV1[];
  selectedSceneId: string | null;
  presentation: { sceneId: string | null; blanked: boolean } | null;
  onSelect: (sceneId: string) => void;
  onCreate: () => void;
  adoptable: ReadonlyArray<{ id: string; name: string }>;
  onAdopt: (mapId: string) => void;
  busy?: boolean;
  status?: { tone: 'alert' | 'status'; text: string; detail?: string } | null;
  battleMapsHref: string;
}) {
  if (!props.open) return null;
  const presented = props.presentation?.sceneId ?? null;
  // FU-6: focus the toggle that is mounted now, never a stale node.
  const close = () => {
    props.onClose();
    document.getElementById(SCENES_TOGGLE_ID)?.focus();
  };
  return (
    <section
      id={SCENES_PANEL_ID}
      role="region"
      aria-label="Scenes"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
      className="bg-surface-raised border-divider pointer-events-auto fixed top-[var(--dm-vtt-panel-top,4rem)] bottom-2 left-2 z-40 flex w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border shadow-xl"
    >
      <div className="border-divider flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-heading text-sm font-semibold">Scenes</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close scenes"
          onClick={close}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
      <p className="text-muted px-3 pt-2 text-xs">
        Picking a scene here doesn&apos;t change what players see.
      </p>
      <div className="flex flex-wrap gap-2 px-3 py-2">
        <Button size="sm" onClick={props.onCreate} disabled={props.busy}>
          <Plus size={14} aria-hidden="true" />
          New scene
        </Button>
      </div>
      {props.status && (
        <p
          role={props.status.tone}
          title={props.status.detail}
          className={`px-3 text-xs ${props.status.tone === 'alert' ? 'text-accent-red-text' : 'text-muted'}`}
        >
          {props.status.text}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {props.scenes.length === 0 ? (
          <p className="text-muted px-1 py-2 text-xs">
            No scenes yet. Create one or add a battle map.
          </p>
        ) : (
          <ul aria-label="Scenes on this table" className="space-y-1">
            {props.scenes.map(scene => {
              const selected = scene.sceneId === props.selectedSceneId;
              const shown = presented === scene.sceneId;
              return (
                <li key={scene.sceneId}>
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => props.onSelect(scene.sceneId)}
                    className={`hover:bg-surface-secondary focus-visible:ring-accent-blue-border flex w-full items-center gap-2 rounded-lg border p-2 text-left focus-visible:ring-2 focus-visible:outline-none ${
                      selected
                        ? 'border-accent-blue-border bg-accent-blue-bg'
                        : 'border-divider'
                    }`}
                  >
                    <SceneThumbnail url={scene.map.mapImageUrl} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-heading truncate text-sm font-medium">
                        {scene.map.name}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {selected && (
                          <Badge variant="secondary" size="sm">
                            Selected
                          </Badge>
                        )}
                        {shown && !props.presentation?.blanked && (
                          <Badge variant="primary" size="sm">
                            Shown
                          </Badge>
                        )}
                        {shown && props.presentation?.blanked && (
                          <Badge variant="warning" size="sm">
                            Blanked
                          </Badge>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-divider mt-3 border-t pt-2">
          <h3 className="text-heading px-1 text-xs font-semibold">
            Add from battle maps
          </h3>
          {props.adoptable.length === 0 ? (
            <p className="text-muted px-1 py-1 text-xs">
              Every battle map is already on this table.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1 py-1">
              {props.adoptable.map(map => (
                <Button
                  key={map.id}
                  variant="ghost"
                  size="sm"
                  disabled={props.busy}
                  onClick={() => props.onAdopt(map.id)}
                >
                  {`Add ${map.name}`}
                </Button>
              ))}
            </div>
          )}
          <Link
            href={props.battleMapsHref}
            className="text-link px-1 text-xs underline"
          >
            Export or import tables on Battle Maps
          </Link>
        </div>
      </div>
    </section>
  );
}
