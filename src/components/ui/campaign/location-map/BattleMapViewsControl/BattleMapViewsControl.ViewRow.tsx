'use client';

import { Check, MapPin, Pencil, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import type { SavedCameraView } from '@/types/battlemap';
import { DisableableTooltip } from '../ToolOptionControls';

/** Icon-only row button, used with `size="sm"` (36px; 44px on touch). */
export const ICON_BUTTON = 'w-9 shrink-0 px-0';

/**
 * The popover is `z-[60]` and the shared Tooltip is `z-50`, so tooltips
 * inside it need a higher layer or they open underneath.
 */
export const POPOVER_TOOLTIP_CLASS = 'z-[70]';

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
          }}
          className="flex-1"
          autoFocus
        />
        <Tooltip content="Confirm rename" className={POPOVER_TOOLTIP_CLASS}>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Confirm rename"
            onClick={onCommitRename}
            className={ICON_BUTTON}
          >
            <Check size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Cancel rename" className={POPOVER_TOOLTIP_CLASS}>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cancel rename"
            onClick={onCancelRename}
            className={ICON_BUTTON}
          >
            <X size={16} />
          </Button>
        </Tooltip>
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
        size="sm"
        onClick={onGoToView}
        leftIcon={<MapPin size={14} />}
        className="min-w-0 flex-1 justify-start px-2 text-left"
      >
        <span className="truncate">{view.name}</span>
      </Button>
      {deleteArmed ? (
        <>
          <Button variant="danger-solid" size="sm" onClick={onDeleteClick}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelDelete}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <DisableableTooltip
            content="Send view"
            disabled={!sharingEnabled}
            className={POPOVER_TOOLTIP_CLASS}
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label="Send view"
              onClick={onSend}
              disabled={!sharingEnabled}
              className={ICON_BUTTON}
            >
              <Send size={16} />
            </Button>
          </DisableableTooltip>
          <Tooltip content="Rename view" className={POPOVER_TOOLTIP_CLASS}>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Rename view"
              onClick={onStartRename}
              className={ICON_BUTTON}
            >
              <Pencil size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Delete view" className={POPOVER_TOOLTIP_CLASS}>
            <Button
              variant="danger"
              size="sm"
              aria-label="Delete view"
              onClick={onDeleteClick}
              className={ICON_BUTTON}
            >
              <Trash2 size={16} />
            </Button>
          </Tooltip>
        </>
      )}
    </li>
  );
}
