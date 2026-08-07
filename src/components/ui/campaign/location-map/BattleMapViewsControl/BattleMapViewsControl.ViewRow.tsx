'use client';

import { Check, MapPin, Pencil, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { SavedCameraView } from '@/types/battlemap';

export const ICON_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center p-0';

export interface ViewRowProps {
  view: SavedCameraView;
  sharingEnabled: boolean;
  renaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  deleteArmed: boolean;
  onDeleteClick: () => void;
  onCancelDelete: () => void;
  onGoToView: () => void;
  onSend: () => void;
}

export function ViewRow({
  view,
  sharingEnabled,
  renaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  deleteArmed,
  onDeleteClick,
  onCancelDelete,
  onGoToView,
  onSend,
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
      {deleteArmed ? (
        <>
          <Button
            variant="danger"
            aria-label="Confirm delete"
            onClick={onDeleteClick}
            className={ICON_BUTTON}
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="ghost"
            aria-label="Cancel delete"
            onClick={onCancelDelete}
            className={ICON_BUTTON}
          >
            <X size={16} />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          aria-label="Delete view"
          onClick={onDeleteClick}
          className={ICON_BUTTON}
        >
          <Trash2 size={16} />
        </Button>
      )}
    </li>
  );
}
