'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
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

/** True when nothing useful holds focus (the browser fell back to `<body>`). */
export function focusWasLost() {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * The views popover is a non-modal Radix Popover, so its `FocusScope` does
 * not pull focus back when the focused control unmounts. An edit that ends
 * by Escape, Enter or a Cancel click would drop focus to `<body>`, and the
 * next Tab would dismiss the popover. When `editing` flips to false and
 * focus was lost, this puts it on `target` — the control that started the
 * edit — instead.
 */
export function useFocusAfterEdit(
  editing: boolean,
  target: RefObject<HTMLElement | null>
) {
  const wasEditing = useRef(editing);
  useEffect(() => {
    const ended = wasEditing.current && !editing;
    wasEditing.current = editing;
    if (ended && focusWasLost()) target.current?.focus();
  }, [editing, target]);
}

/**
 * State machinery for the views popover: open state, the inline save-name
 * field, per-row rename, and the two-click delete-confirm arm. Radix owns
 * outside-click and Escape; the component calls `resetTransientState` when
 * Escape cancels an edit or the popover closes. Kept separate from rendering
 * so the component file stays presentational.
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

  /** Clears the save field, an open rename and an armed delete. */
  const resetTransientState = () => {
    setRenamingId(null);
    setSavingView(null);
    setSaveName('');
    setArmedDeleteId(null);
  };

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
  };
}
