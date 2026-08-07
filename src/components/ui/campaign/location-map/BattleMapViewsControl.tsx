'use client';

import { useEffect, useRef, useState } from 'react';
import {
  captureCameraView,
  type CameraView,
  type FocusAudience,
} from '@fieldnotes/core';
import {
  Check,
  ChevronDown,
  MapPin,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import type { SavedCameraView } from '@/types/battlemap';

/** The minimum viewport surface `captureCameraView` needs. */
interface CameraCaptureViewport {
  getVisibleRect(): CameraView;
}

export interface BattleMapViewsControlProps {
  getViewport: () => CameraCaptureViewport | null;
  views: SavedCameraView[];
  onSaveView: (view: CameraView) => void;
  onRenameView: (id: string, name: string) => void;
  onDeleteView: (id: string) => void;
  onGoToView: (view: CameraView) => void;
  /** Only ever invoked while `sharingEnabled` is true — enforced here, not downstream. */
  onSend: (view: CameraView, audience: FocusAudience) => void;
  sharingEnabled: boolean;
  onSharingChange: (enabled: boolean) => void;
}

const ICON_BUTTON = 'flex h-11 w-11 shrink-0 items-center justify-center p-0';

interface ViewRowProps {
  view: SavedCameraView;
  sharingEnabled: boolean;
  renaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onGoToView: () => void;
  onSend: () => void;
  onDelete: () => void;
}

function ViewRow({
  view,
  sharingEnabled,
  renaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onGoToView,
  onSend,
  onDelete,
}: ViewRowProps) {
  if (renaming) {
    return (
      <li
        role="group"
        aria-label={`${view.name} view`}
        className="flex items-center gap-1"
      >
        <Input
          aria-label="Rename view"
          value={renameValue}
          onChange={e => onRenameValueChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommitRename();
            if (e.key === 'Escape') onCancelRename();
          }}
          className="h-11 flex-1"
          autoFocus
        />
        <Button
          variant="ghost"
          aria-label="Confirm rename"
          onClick={onCommitRename}
          className={ICON_BUTTON}
        >
          <Check size={16} />
        </Button>
        <Button
          variant="ghost"
          aria-label="Cancel rename"
          onClick={onCancelRename}
          className={ICON_BUTTON}
        >
          <X size={16} />
        </Button>
      </li>
    );
  }

  return (
    <li
      role="group"
      aria-label={`${view.name} view`}
      className="flex items-center gap-1"
    >
      <Button
        variant="ghost"
        onClick={onGoToView}
        className="flex h-11 min-w-0 flex-1 items-center justify-start gap-2 px-2 text-left text-sm"
      >
        <MapPin size={14} className="shrink-0" />
        <span className="truncate">{view.name}</span>
      </Button>
      <Button
        variant="ghost"
        aria-label="Send view"
        onClick={onSend}
        disabled={!sharingEnabled}
        className={ICON_BUTTON}
      >
        <Send size={16} />
      </Button>
      <Button
        variant="ghost"
        aria-label="Rename view"
        onClick={onStartRename}
        className={ICON_BUTTON}
      >
        <Pencil size={16} />
      </Button>
      <Button
        variant="ghost"
        aria-label="Delete view"
        onClick={onDelete}
        className={ICON_BUTTON}
      >
        <Trash2 size={16} />
      </Button>
    </li>
  );
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
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<FocusAudience>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const captureCurrentView = (): CameraView | null => {
    const vp = getViewport();
    return vp ? captureCameraView(vp) : null;
  };

  const handleSave = () => {
    const view = captureCurrentView();
    if (view) onSaveView(view);
  };

  const handleBringToMyView = () => {
    if (!sharingEnabled) return;
    const view = captureCurrentView();
    if (view) onSend(view, audience);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (renamingId && trimmed) onRenameView(renamingId, trimmed);
    setRenamingId(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant={open ? 'primary' : 'ghost'}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 px-3 text-xs"
      >
        Views
        <ChevronDown size={14} />
      </Button>

      {open && (
        <div className="bg-surface-raised border-divider absolute top-full right-0 z-30 mt-2 w-72 rounded-xl border p-3 shadow-xl">
          <Button
            variant="ghost"
            onClick={handleSave}
            className="flex h-11 w-full items-center justify-start gap-2 text-sm"
          >
            <Plus size={16} />
            Save current view
          </Button>

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
                    onStartRename={() => {
                      setRenamingId(v.id);
                      setRenameValue(v.name);
                    }}
                    onCommitRename={commitRename}
                    onCancelRename={() => setRenamingId(null)}
                    onGoToView={() => onGoToView(v.view)}
                    onSend={() => sharingEnabled && onSend(v.view, audience)}
                    onDelete={() => onDeleteView(v.id)}
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
