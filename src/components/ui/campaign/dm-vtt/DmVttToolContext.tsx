'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, SlidersHorizontal, Undo2, Redo2 } from 'lucide-react';
import {
  useActiveTool,
  useSelectionOps,
  useToolOptions,
  useHistory,
} from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import DmLocationToolOptions from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import { markerAudienceToggleTitle } from '@/components/ui/campaign/location-map/markerAudienceCopy';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { dmVttToolLabel } from './DmVttToolStrip';
import type { DmVttToolbarProps } from './DmVttToolbar';

export type DmVttToolContextProps = Pick<
  DmVttToolbarProps,
  | 'selectedElementId'
  | 'selectedElementIsDmOnly'
  | 'onToggleSelectedDmOnly'
  | 'selectedElementIsMarker'
  | 'markerAudienceNotice'
  | 'markerControls'
  | 'measureSharing'
  | 'movementControls'
  | 'fogControls'
  | 'fogPresetControls'
>;

export function DmVttToolContext(props: DmVttToolContextProps) {
  const [activeTool] = useActiveTool();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const { selectedCount } = useSelectionOps();
  const [options] = useToolOptions(activeTool ?? '');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pending = props.fogControls?.pendingAction;
  useEffect(() => {
    if (pending) setOpen(true);
  }, [pending, desktop]);
  const hasOptions =
    !!pending ||
    (activeTool === 'select' && selectedCount > 0) ||
    (activeTool === 'marker' && !!props.markerControls) ||
    (activeTool === 'fog' && !!props.fogControls) ||
    ['arrow', 'note', 'text', 'shape', 'measure', 'path', 'template'].includes(
      activeTool ?? ''
    ) ||
    (['pencil', 'laser', 'ping'].includes(activeTool ?? '') &&
      options !== undefined);
  const showHistory =
    ['pencil', 'arrow', 'shape', 'text', 'note', 'marker', 'eraser'].includes(
      activeTool ?? ''
    ) ||
    (activeTool === 'select' && selectedCount > 0);
  const label = `${pending ? 'Fog' : dmVttToolLabel(activeTool)} options`;
  const toolOptions = (
    <DmLocationToolOptions
      mode="battlemap"
      presentation="dock"
      selectionControls
      measureSharing={props.measureSharing}
      markerControls={props.markerControls}
      movementControls={props.movementControls}
      fogControls={props.fogControls}
      fogPresetControls={props.fogPresetControls}
    />
  );
  return (
    <>
      {(showHistory ||
        props.selectedElementId ||
        props.markerAudienceNotice ||
        props.fogControls?.diagnostic ||
        props.fogControls?.disabledReason ||
        (!desktop && hasOptions)) && (
        <div className="border-divider flex min-w-0 flex-wrap items-center gap-2 border-t px-2 py-1">
          {showHistory && (
            <div className="flex gap-1" role="group" aria-label="Edit history">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={undo}
                className="min-h-11 min-w-11 p-0"
              >
                <Undo2 size={16} aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={redo}
                className="min-h-11 min-w-11 p-0"
              >
                <Redo2 size={16} aria-hidden />
              </Button>
            </div>
          )}
          {props.selectedElementId && (
            <Button
              data-testid="dm-vtt-dm-only-toggle"
              variant="ghost"
              size="sm"
              selected={props.selectedElementIsDmOnly}
              onClick={props.onToggleSelectedDmOnly}
              className="min-h-11 px-2"
              aria-label={
                props.selectedElementIsMarker
                  ? markerAudienceToggleTitle(props.selectedElementIsDmOnly)
                  : props.selectedElementIsDmOnly
                    ? 'Reveal selected element'
                    : 'Hide selected element'
              }
              title={
                props.selectedElementIsMarker
                  ? markerAudienceToggleTitle(props.selectedElementIsDmOnly)
                  : props.selectedElementIsDmOnly
                    ? 'Reveal selected element to players'
                    : 'Hide selected element from players'
              }
            >
              {props.selectedElementIsDmOnly ? (
                <Eye size={16} aria-hidden />
              ) : (
                <EyeOff size={16} aria-hidden />
              )}
              {props.selectedElementIsDmOnly
                ? 'Reveal selected'
                : 'Hide selected'}
            </Button>
          )}
          {props.selectedElementIsMarker && props.selectedElementId && (
            <p className="type-small text-muted min-w-0 basis-full">
              {markerAudienceToggleTitle(props.selectedElementIsDmOnly)}
            </p>
          )}
          {props.markerAudienceNotice && (
            <p role="status" className="type-small text-ember-text basis-full">
              {props.markerAudienceNotice}
            </p>
          )}
          {props.fogControls?.disabledReason && (
            <p
              id="dm-fog-disabled-reason"
              className="type-small text-muted basis-full"
            >
              {props.fogControls.disabledReason}
            </p>
          )}
          {props.fogControls?.diagnostic && (
            <p role="alert" className="type-small text-blood-text basis-full">
              {props.fogControls.diagnostic}
            </p>
          )}
          {!desktop && hasOptions && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  ref={triggerRef}
                  variant="outline"
                  size="sm"
                  className="min-h-11 px-2"
                >
                  <SlidersHorizontal size={16} aria-hidden />
                  {label}
                </Button>
              </DialogTrigger>
              <DialogContent
                size="md"
                className="max-w-[calc(100vw-1rem)] p-4"
                aria-describedby={undefined}
                onCloseAutoFocus={event => {
                  event.preventDefault();
                  const trigger = triggerRef.current;
                  if (trigger?.isConnected) trigger.focus();
                  else
                    document
                      .querySelector<HTMLButtonElement>(
                        '[aria-label="Fog of war"]'
                      )
                      ?.focus();
                }}
              >
                <DialogTitle className="type-subheading pr-12">
                  {label}
                </DialogTitle>
                <DialogBody>{toolOptions}</DialogBody>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
      {desktop && hasOptions && (
        <div
          className="border-divider max-h-[min(18rem,40dvh)] min-w-0 overflow-y-auto border-t"
          role="region"
          aria-label={label}
        >
          {toolOptions}
        </div>
      )}
    </>
  );
}
