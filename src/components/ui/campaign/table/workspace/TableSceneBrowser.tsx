'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ImageOff, Layers, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';
import type { TableSceneRecordV1 } from '@/lib/table/schema';

export const SCENES_PANEL_ID = 'table-scenes-panel';
/** FU-6: stable id; the toggle remounts with the scene's header. */
export const SCENES_TOGGLE_ID = 'table-scenes-toggle';

/** Header toggle for the private Scenes panel (W5/W12). */
export function TableScenesToggle(props: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="outline"
      selected={props.open}
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
      <span className="bg-surface-secondary text-muted flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-sm text-xs">
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
      className="bg-surface-secondary h-12 w-16 shrink-0 rounded-sm object-cover"
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
      style={{
        maxHeight: 'calc(100dvh - var(--dm-vtt-panel-top, 4rem) - 1rem)',
      }}
      className={cn(
        OVERLAY_SURFACE,
        'pointer-events-auto fixed top-[var(--dm-vtt-panel-top,4rem)] left-2 z-40 flex w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden'
      )}
    >
      <div className="border-divider flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <h2 className="type-subheading text-heading min-w-0 flex-1">Scenes</h2>
        <Button size="sm" onClick={props.onCreate} disabled={props.busy}>
          <Plus size={14} aria-hidden="true" />
          New scene
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close scenes"
          onClick={close}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
      <p className="type-small text-muted shrink-0 px-3 py-2">
        Picking a scene here doesn&apos;t change what players see.
      </p>
      {props.status && (
        <p
          role={props.status.tone}
          title={props.status.detail}
          className={`type-small shrink-0 px-3 pb-2 ${props.status.tone === 'alert' ? 'text-blood-text' : 'text-muted'}`}
        >
          {props.status.text}
        </p>
      )}
      <div className="min-h-0 overflow-y-auto px-2 pb-2">
        {props.scenes.length === 0 ? (
          <p className="type-small text-muted px-1 py-2">
            No scenes yet. Create one or add a battle map.
          </p>
        ) : (
          <ul
            aria-label="Scenes on this Table"
            className="divide-divider divide-y"
          >
            {props.scenes.map(scene => {
              const selected = scene.sceneId === props.selectedSceneId;
              const shown = presented === scene.sceneId;
              return (
                <li key={scene.sceneId}>
                  <Button
                    variant="ghost"
                    selected={selected}
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => props.onSelect(scene.sceneId)}
                    className={cn(
                      'h-auto w-full items-center justify-start border p-2 text-left',
                      selected ? 'bg-brass-bg' : 'border-transparent'
                    )}
                  >
                    <SceneThumbnail url={scene.map.mapImageUrl} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="type-ui text-heading line-clamp-2 break-words">
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
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-divider mt-3 border-t pt-2">
          <h3 className="type-label-heading text-heading px-1">
            Add from battle maps
          </h3>
          {props.adoptable.length === 0 ? (
            <p className="type-small text-muted px-1 py-1">
              Every battle map is already on this Table.
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
        </div>
      </div>
      <div className="border-divider shrink-0 border-t px-3 py-2">
        <Button
          asChild
          variant="link"
          size="sm"
          className="h-auto px-0 text-left whitespace-normal"
        >
          <Link href={props.battleMapsHref}>
            Export or import a Table on Battle Maps
          </Link>
        </Button>
      </div>
    </section>
  );
}
