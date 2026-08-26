'use client';

import { useEffect, useRef, useState } from 'react';
import { captureCameraView, type CameraView } from '@fieldnotes/core';

/** The minimum viewport surface `captureCameraView` needs. */
export interface CameraCaptureViewport {
  getVisibleRect(): CameraView;
}

export interface UseBattleMapViewsControlArgs {
  getViewport: () => CameraCaptureViewport | null;
  /** Used to name a saved view when the DM leaves the inline field blank. */
  viewCount: number;
  onSaveView: (view: CameraView, name: string) => void;
  onRenameView: (id: string, name: string) => void;
  onDeleteView: (id: string) => void;
}

/**
 * State machinery for the views popover: open/close plus outside-click and
 * Escape handling, the inline save-name field, per-row rename, and the
 * two-click delete-confirm arm. Kept separate from rendering so the
 * component file stays presentational.
 */
export function useBattleMapViewsControl({
  getViewport,
  viewCount,
  onSaveView,
  onRenameView,
  onDeleteView,
}: UseBattleMapViewsControlArgs) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Captured the moment the DM opens the inline field, not when they
  // confirm — otherwise a pan mid-typing saves the wrong rect.
  const [savingView, setSavingView] = useState<CameraView | null>(null);
  const [saveName, setSaveName] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const resetTransientState = () => {
    setRenamingId(null);
    setSavingView(null);
    setSaveName('');
    setArmedDeleteId(null);
  };

  const closePopover = () => {
    setOpen(false);
    resetTransientState();
  };

  const toggleOpen = () => {
    setOpen(o => {
      const next = !o;
      if (!next) resetTransientState();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        closePopover();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const captureCurrentView = (): CameraView | null => {
    const vp = getViewport();
    return vp ? captureCameraView(vp) : null;
  };

  const startSave = () => {
    const view = captureCurrentView();
    if (view) {
      setSavingView(view);
      setSaveName('');
    }
  };

  const cancelSave = () => {
    setSavingView(null);
    setSaveName('');
  };

  const commitSave = () => {
    if (!savingView) return;
    const trimmed = saveName.trim();
    const name = trimmed || `View ${viewCount + 1}`;
    onSaveView(savingView, name);
    setSavingView(null);
    setSaveName('');
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const cancelRename = () => setRenamingId(null);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (renamingId && trimmed) onRenameView(renamingId, trimmed);
    setRenamingId(null);
  };

  const handleDeleteClick = (id: string) => {
    if (armedDeleteId === id) {
      onDeleteView(id);
      setArmedDeleteId(null);
    } else {
      setArmedDeleteId(id);
    }
  };

  const cancelDelete = () => setArmedDeleteId(null);

  return {
    rootRef,
    popoverRef,
    open,
    toggleOpen,
    closePopover,
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
  };
}
