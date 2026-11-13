'use client';

import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { CameraView, FocusAudience } from '@fieldnotes/core';
import { Check, ChevronDown, MapPin, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import type { SavedCameraView } from '@/types/battlemap';
import {
  focusWasLost,
  useBattleMapViewsControl,
  useFocusAfterEdit,
  type CameraCaptureViewport,
} from './BattleMapViewsControl.hooks';
import {
  ViewRow,
  ICON_BUTTON,
  POPOVER_TOOLTIP_CLASS,
} from './BattleMapViewsControl.ViewRow';

export interface BattleMapViewsControlProps {
  getViewport: () => CameraCaptureViewport | null;
  views: SavedCameraView[];
  onSaveView: (view: CameraView, name: string) => void;
  onRenameView: (id: string, name: string) => void;
  onDeleteView: (id: string) => void;
  onGoToView: (view: CameraView) => void;
  /** Only ever invoked while `sharingEnabled` is true — enforced here, not downstream. */
  onSend: (view: CameraView, audience: FocusAudience) => void;
  sharingEnabled: boolean;
  onSharingChange: (enabled: boolean) => void;
}

/**
 * DM popover: saved camera bookmarks plus the session opt-in gate for moving
 * other people's cameras. Save/go/rename/delete touch only local state and
 * stay live regardless of the gate; sending a view to anyone else — per-row
 * or "Bring them to my view" — is disabled outright while `sharingEnabled`
 * is false, and its handlers re-check the flag before ever calling `onSend`.
 */
export function BattleMapViewsControl({
  getViewport,
  views,
  onSaveView,
  onRenameView,
  onDeleteView,
  onGoToView,
  onSend,
  sharingEnabled,
  onSharingChange,
}: BattleMapViewsControlProps) {
  const [audience, setAudience] = useState<FocusAudience>('all');
  const {
    open,
    setOpen,
    resetTransientState,
    renamingId,
    renameValue,
    setRenameValue,
    startRename,
    commitRename,
    cancelRename,
    savingView,
    saveName,
    setSaveName,
    startSave,
    commitSave,
    cancelSave,
    armedDeleteId,
    handleDeleteClick,
    cancelDelete,
    captureCurrentView,
  } = useBattleMapViewsControl({
    getViewport,
    viewCount: views.length,
    onSaveView,
    onRenameView,
    onDeleteView,
  });

  // Non-modal popover: when the focused control unmounts, Radix leaves focus
  // on <body> and the next Tab would dismiss the popover. A save that ends
  // goes back to "Save current view"; the rows handle rename and delete.
  const contentRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  useFocusAfterEdit(savingView !== null, saveButtonRef);

  // Floor for the one case with no control to return to: a confirmed delete
  // unmounts the whole row. Runs after the row effects above have had their
  // turn, so it only fires when focus is still lost.
  useEffect(() => {
    if (open && focusWasLost()) contentRef.current?.focus();
  }, [open, views, savingView, renamingId, armedDeleteId]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetTransientState();
  };

  // The one Escape gate: an open edit (save field, rename, armed delete)
  // cancels first and keeps the popover open; the next Escape closes it.
  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (savingView !== null || renamingId !== null || armedDeleteId !== null) {
      event.preventDefault();
      resetTransientState();
    }
  };

  const handleBringToMyView = () => {
    if (!sharingEnabled) return;
    const view = captureCurrentView();
    if (view) onSend(view, audience);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          selected={open}
          rightIcon={<ChevronDown size={14} aria-hidden />}
        >
          Views
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          ref={contentRef}
          aria-label="Views"
          data-testid="battle-map-views-popover"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          onEscapeKeyDown={handleEscapeKeyDown}
          className={`${OVERLAY_SURFACE} z-[60] w-72 max-w-[calc(100vw-1rem)] p-3`}
        >
          <TooltipProvider>
            {savingView ? (
              <div className="flex items-center gap-1">
                <Input
                  aria-label="View name"
                  placeholder="Name this view"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      // Also stops the keypress reaching the button focus
                      // moves to, which would reopen the field.
                      e.preventDefault();
                      commitSave();
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Tooltip
                  content="Confirm save"
                  className={POPOVER_TOOLTIP_CLASS}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Confirm save"
                    onClick={commitSave}
                    className={ICON_BUTTON}
                  >
                    <Check size={16} />
                  </Button>
                </Tooltip>
                <Tooltip
                  content="Cancel save"
                  className={POPOVER_TOOLTIP_CLASS}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Cancel save"
                    onClick={cancelSave}
                    className={ICON_BUTTON}
                  >
                    <X size={16} />
                  </Button>
                </Tooltip>
              </div>
            ) : (
              <Button
                ref={saveButtonRef}
                variant="ghost"
                size="sm"
                fullWidth
                onClick={startSave}
                className="justify-start"
                leftIcon={<Plus size={16} />}
              >
                Save current view
              </Button>
            )}

            {views.length > 0 && (
              <>
                <div className="border-divider my-2 border-t" />
                <ul className="flex flex-col gap-1">
                  {views.map(v => (
                    <ViewRow
                      key={v.id}
                      view={v}
                      sharingEnabled={sharingEnabled}
                      renaming={renamingId === v.id}
                      renameValue={renameValue}
                      onRenameValueChange={setRenameValue}
                      onStartRename={() => startRename(v.id, v.name)}
                      onCommitRename={commitRename}
                      onCancelRename={cancelRename}
                      deleteArmed={armedDeleteId === v.id}
                      onDeleteClick={() => handleDeleteClick(v.id)}
                      onCancelDelete={cancelDelete}
                      onGoToView={() => onGoToView(v.view)}
                      onSend={() => sharingEnabled && onSend(v.view, audience)}
                    />
                  ))}
                </ul>
              </>
            )}

            <div className="border-divider my-2 border-t" />

            <Switch
              checked={sharingEnabled}
              onCheckedChange={onSharingChange}
              aria-label="Move players' cameras"
              label="Move players' cameras"
              description="Turn this on when you want to move other players' cameras. It's off by default."
            />

            <RadioGroupField
              label="Send to"
              value={audience}
              onValueChange={value => setAudience(value as FocusAudience)}
              disabled={!sharingEnabled}
              wrapperClassName="mt-2"
            >
              <RadioGroupItem value="all" label="All" />
              <RadioGroupItem value="players" label="Players" />
              <RadioGroupItem value="display" label="Display" />
            </RadioGroupField>

            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={handleBringToMyView}
              disabled={!sharingEnabled}
              className="mt-2"
              leftIcon={<MapPin size={16} />}
            >
              Bring them to my view
            </Button>
          </TooltipProvider>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default BattleMapViewsControl;
