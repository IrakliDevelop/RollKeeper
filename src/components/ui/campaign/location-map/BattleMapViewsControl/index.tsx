'use client';

import { useState } from 'react';
import type { CameraView, FocusAudience } from '@fieldnotes/core';
import { Check, ChevronDown, MapPin, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import type { SavedCameraView } from '@/types/battlemap';
import {
  useBattleMapViewsControl,
  type CameraCaptureViewport,
} from './BattleMapViewsControl.hooks';
import { ViewRow, ICON_BUTTON } from './BattleMapViewsControl.ViewRow';

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
    rootRef,
    open,
    toggleOpen,
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

  const handleBringToMyView = () => {
    if (!sharingEnabled) return;
    const view = captureCurrentView();
    if (view) onSend(view, audience);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant={open ? 'primary' : 'ghost'}
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 px-3 text-xs"
      >
        Views
        <ChevronDown size={14} />
      </Button>

      {open && (
        <div className="bg-surface-raised border-divider absolute top-full right-0 z-30 mt-2 w-72 rounded-xl border p-3 shadow-xl">
          {savingView ? (
            <div className="flex items-center gap-1">
              <Input
                aria-label="View name"
                placeholder="Name this view"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitSave();
                  if (e.key === 'Escape') cancelSave();
                }}
                className="h-11 flex-1"
                autoFocus
              />
              <Button
                variant="ghost"
                aria-label="Confirm save"
                onClick={commitSave}
                className={ICON_BUTTON}
              >
                <Check size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Cancel save"
                onClick={cancelSave}
                className={ICON_BUTTON}
              >
                <X size={16} />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={startSave}
              className="flex h-11 w-full items-center justify-start gap-2 text-sm"
            >
              <Plus size={16} />
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
            description="Off by default — turn on to move other people's cameras."
          />

          <RadioGroupField
            label="Send to"
            value={audience}
            onValueChange={value => setAudience(value as FocusAudience)}
            disabled={!sharingEnabled}
            wrapperClassName="mt-2"
          >
            <RadioGroupItem
              value="all"
              label="All"
              wrapperClassName="min-h-[44px] items-center"
            />
            <RadioGroupItem
              value="players"
              label="Players"
              wrapperClassName="min-h-[44px] items-center"
            />
            <RadioGroupItem
              value="display"
              label="Display"
              wrapperClassName="min-h-[44px] items-center"
            />
          </RadioGroupField>

          <Button
            variant="primary"
            onClick={handleBringToMyView}
            disabled={!sharingEnabled}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 text-sm"
          >
            <MapPin size={16} />
            Bring them to my view
          </Button>
        </div>
      )}
    </div>
  );
}

export default BattleMapViewsControl;
