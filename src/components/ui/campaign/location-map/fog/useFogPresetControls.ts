'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Viewport } from '@fieldnotes/core';
import { useDmStore } from '@/store/dmStore';
import {
  CLOUDY_AS_CUSTOM_MATERIAL,
  DEFAULT_CUSTOM_PROCEDURAL_MATERIAL,
  DEFAULT_CUSTOM_SOLID_MATERIAL,
  FOG_MATERIAL_BOUNDS,
  fogMaterialsEqual,
  resolveCustomFogRendererOptions,
} from '@/lib/fogMaterial';
import {
  canAddFogPreset,
  findFogPresetNameConflict,
  generateFogPresetId,
  normalizeFogPresetName,
  parseFogPresetLibrary,
  sortFogPresetsForDisplay,
} from '@/lib/fogPreset';
import type { FogAppearance } from '@/types/battlemap';
import type {
  CustomFogMaterialV1,
  CustomProceduralFogMaterialV1,
  FogPresetV1,
} from '@/types/fogMaterial';
import { resolveFogRendererOptions } from './fogAppearance';

export const FOG_PRESET_ERRORS = {
  name: 'Enter a name between 1 and 60 characters.',
  duplicate: 'A preset with that name already exists.',
  reserved: 'That name is reserved for a built-in appearance.',
  full: 'This campaign already has the maximum of 50 fog presets.',
  missing: 'That preset no longer exists.',
} as const;

export interface FogPresetEditorState {
  draft: CustomFogMaterialV1;
  /** Preset the draft was opened from, if it still exists. */
  sourcePresetId: string | null;
  error: string | null;
}

export interface FogPresetControls {
  /** Custom presets sorted for display. */
  library: FogPresetV1[];
  applied: FogAppearance;
  /** `'solid' | 'cloudy' | <preset id> | 'custom'` for the selector. */
  selectedValue: string;
  /** `'Modified'`, `'Custom (preset deleted)'`, `'Custom'`, or null. */
  appliedLabel: string | null;
  select(value: string): void;
  editor: FogPresetEditorState | null;
  openEditor(): void;
  updateDraft(
    patch: Partial<CustomProceduralFogMaterialV1> | { color: string }
  ): void;
  setDraftKind(kind: 'solid' | 'procedural'): void;
  randomizeSeed(): void;
  resetDraft(): void;
  cancelEditor(): void;
  applyDraft(): void;
  saveDraftAsPreset(name: string): string | null;
  updateSourcePreset(): string | null;
  managerOpen: boolean;
  openManager(): void;
  closeManager(): void;
  renamePreset(id: string, name: string): string | null;
  duplicatePreset(id: string): string | null;
  managerError: string | null;
  setManagerError(error: string | null): void;
  pendingDeleteId: string | null;
  requestDelete(id: string): void;
  confirmDelete(): void;
  cancelDelete(): void;
}

export interface UseFogPresetControlsInput {
  campaignCode: string;
  viewport: Viewport | null;
  applied: FogAppearance;
  onApply(appearance: FogAppearance): void;
}

function materialFromApplied(applied: FogAppearance): CustomFogMaterialV1 {
  if (applied === 'solid') return DEFAULT_CUSTOM_SOLID_MATERIAL;
  if (applied === 'cloudy') return CLOUDY_AS_CUSTOM_MATERIAL;
  return applied.material;
}

function randomSeed(): number {
  return Math.floor(Math.random() * (FOG_MATERIAL_BOUNDS.seed.max + 1));
}

export function useFogPresetControls(
  input: UseFogPresetControlsInput
): FogPresetControls {
  const { campaignCode, viewport, applied, onApply } = input;
  const rawLibrary = useDmStore(s => s.getCampaign(campaignCode)?.fogPresets);
  const upsertFogPreset = useDmStore(s => s.upsertFogPreset);
  const removeFogPreset = useDmStore(s => s.removeFogPreset);
  const storageLibrary = useMemo(
    () => parseFogPresetLibrary(rawLibrary),
    [rawLibrary]
  );
  const library = useMemo(
    () => sortFogPresetsForDisplay(storageLibrary),
    [storageLibrary]
  );

  const [editor, setEditor] = useState<FogPresetEditorState | null>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const commitEditor = useCallback((next: FogPresetEditorState | null) => {
    editorRef.current = next;
    setEditor(next);
  }, []);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<CustomFogMaterialV1 | null>(null);

  const cancelPreview = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingRef.current = null;
  }, []);

  /** At most one setFogStyle per frame: each call rebuilds tile caches and invalidates the minimap. */
  const schedulePreview = useCallback(
    (material: CustomFogMaterialV1) => {
      pendingRef.current = material;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const next = pendingRef.current;
        pendingRef.current = null;
        if (next) viewport?.setFogStyle(resolveCustomFogRendererOptions(next));
      });
    },
    [viewport]
  );

  const restoreApplied = useCallback(() => {
    cancelPreview();
    viewport?.setFogStyle(resolveFogRendererOptions(applied));
  }, [cancelPreview, viewport, applied]);

  useEffect(() => () => cancelPreview(), [cancelPreview]);

  const sourcePreset = useMemo(() => {
    if (typeof applied === 'string' || !applied.sourcePresetId) return null;
    return storageLibrary.find(p => p.id === applied.sourcePresetId) ?? null;
  }, [applied, storageLibrary]);

  const selectedValue = useMemo(() => {
    if (typeof applied === 'string') return applied;
    if (
      sourcePreset &&
      fogMaterialsEqual(sourcePreset.material, applied.material)
    )
      return sourcePreset.id;
    return 'custom';
  }, [applied, sourcePreset]);

  const appliedLabel = useMemo(() => {
    if (typeof applied === 'string') return null;
    if (!applied.sourcePresetId) return 'Custom';
    if (!sourcePreset) return 'Custom (preset deleted)';
    return fogMaterialsEqual(sourcePreset.material, applied.material)
      ? null
      : 'Modified';
  }, [applied, sourcePreset]);

  const select = useCallback(
    (value: string) => {
      if (value === 'solid' || value === 'cloudy') {
        onApply(value);
        return;
      }
      const preset = storageLibrary.find(p => p.id === value);
      if (!preset) return;
      onApply({
        v: 2,
        kind: 'custom',
        sourcePresetId: preset.id,
        material: structuredClone(preset.material),
      });
    },
    [onApply, storageLibrary]
  );

  const openEditor = useCallback(() => {
    commitEditor({
      draft: structuredClone(materialFromApplied(applied)),
      sourcePresetId: sourcePreset?.id ?? null,
      error: null,
    });
  }, [applied, sourcePreset, commitEditor]);

  const setDraft = useCallback(
    (next: CustomFogMaterialV1) => {
      const current = editorRef.current;
      if (!current) return;
      commitEditor({ ...current, draft: next, error: null });
      schedulePreview(next);
    },
    [schedulePreview, commitEditor]
  );

  const updateDraft = useCallback<FogPresetControls['updateDraft']>(
    patch => {
      const current = editorRef.current;
      if (!current) return;
      const next = { ...current.draft, ...patch } as CustomFogMaterialV1;
      commitEditor({ ...current, draft: next, error: null });
      schedulePreview(next);
    },
    [schedulePreview, commitEditor]
  );

  const setDraftKind = useCallback(
    (kind: 'solid' | 'procedural') => {
      const current = editorRef.current;
      if (!current || current.draft.kind === kind) return;
      const next: CustomFogMaterialV1 =
        kind === 'solid'
          ? {
              v: 1,
              kind: 'solid',
              color: (current.draft as CustomProceduralFogMaterialV1).baseColor,
            }
          : {
              ...DEFAULT_CUSTOM_PROCEDURAL_MATERIAL,
              baseColor:
                current.draft.kind === 'solid'
                  ? current.draft.color
                  : DEFAULT_CUSTOM_PROCEDURAL_MATERIAL.baseColor,
            };
      commitEditor({ ...current, draft: next, error: null });
      schedulePreview(next);
    },
    [schedulePreview, commitEditor]
  );

  const randomizeSeed = useCallback(() => {
    const current = editorRef.current;
    if (!current || current.draft.kind !== 'procedural') return;
    const next = { ...current.draft, seed: randomSeed() };
    commitEditor({ ...current, draft: next, error: null });
    schedulePreview(next);
  }, [schedulePreview, commitEditor]);

  const resetDraft = useCallback(() => {
    setDraft(structuredClone(materialFromApplied(applied)));
  }, [applied, setDraft]);

  const cancelEditor = useCallback(() => {
    commitEditor(null);
    restoreApplied();
  }, [restoreApplied, commitEditor]);

  const applyDraft = useCallback(() => {
    const current = editorRef.current;
    if (!current) return;
    cancelPreview();
    const material = structuredClone(current.draft);
    const source = current.sourcePresetId
      ? storageLibrary.find(p => p.id === current.sourcePresetId)
      : undefined;
    const keepSource =
      source !== undefined && fogMaterialsEqual(source.material, current.draft);
    onApply({
      v: 2,
      kind: 'custom',
      ...(keepSource ? { sourcePresetId: source.id } : {}),
      material,
    });
    commitEditor(null);
  }, [cancelPreview, onApply, storageLibrary, commitEditor]);

  const validateName = useCallback(
    (
      name: string,
      excludeId?: string
    ): { ok: true; name: string } | { ok: false; error: string } => {
      const normalized = normalizeFogPresetName(name);
      if (normalized === null)
        return { ok: false, error: FOG_PRESET_ERRORS.name };
      const conflict = findFogPresetNameConflict(
        storageLibrary,
        normalized,
        excludeId
      );
      if (conflict === 'reserved')
        return { ok: false, error: FOG_PRESET_ERRORS.reserved };
      if (conflict === 'duplicate')
        return { ok: false, error: FOG_PRESET_ERRORS.duplicate };
      return { ok: true, name: normalized };
    },
    [storageLibrary]
  );

  const saveDraftAsPreset = useCallback(
    (name: string): string | null => {
      const current = editorRef.current;
      if (!current) return FOG_PRESET_ERRORS.missing;
      if (!canAddFogPreset(storageLibrary)) {
        commitEditor({ ...current, error: FOG_PRESET_ERRORS.full });
        return FOG_PRESET_ERRORS.full;
      }
      const checked = validateName(name);
      if (!checked.ok) {
        commitEditor({ ...current, error: checked.error });
        return checked.error;
      }
      const now = new Date().toISOString();
      const id = generateFogPresetId();
      upsertFogPreset(campaignCode, {
        v: 1,
        id,
        name: checked.name,
        material: structuredClone(current.draft),
        createdAt: now,
        updatedAt: now,
      });
      commitEditor({ ...current, sourcePresetId: id, error: null });
      return null;
    },
    [storageLibrary, validateName, upsertFogPreset, campaignCode, commitEditor]
  );

  const updateSourcePreset = useCallback((): string | null => {
    const current = editorRef.current;
    if (!current || !current.sourcePresetId) return FOG_PRESET_ERRORS.missing;
    const preset = storageLibrary.find(p => p.id === current.sourcePresetId);
    if (!preset) return FOG_PRESET_ERRORS.missing;
    upsertFogPreset(campaignCode, {
      ...preset,
      material: structuredClone(current.draft),
      updatedAt: new Date().toISOString(),
    });
    return null;
  }, [storageLibrary, upsertFogPreset, campaignCode]);

  const renamePreset = useCallback(
    (id: string, name: string): string | null => {
      const preset = storageLibrary.find(p => p.id === id);
      if (!preset) return FOG_PRESET_ERRORS.missing;
      const checked = validateName(name, id);
      if (!checked.ok) return checked.error;
      upsertFogPreset(campaignCode, {
        ...preset,
        name: checked.name,
        updatedAt: new Date().toISOString(),
      });
      return null;
    },
    [storageLibrary, validateName, upsertFogPreset, campaignCode]
  );

  const duplicatePreset = useCallback(
    (id: string): string | null => {
      const preset = storageLibrary.find(p => p.id === id);
      if (!preset) return FOG_PRESET_ERRORS.missing;
      if (!canAddFogPreset(storageLibrary)) return FOG_PRESET_ERRORS.full;
      let candidate = `${preset.name} copy`;
      let n = 2;
      for (;;) {
        if (normalizeFogPresetName(candidate) === null)
          return FOG_PRESET_ERRORS.name;
        if (findFogPresetNameConflict(storageLibrary, candidate) === null)
          break;
        candidate = `${preset.name} copy ${n}`;
        n += 1;
        if (n > 50) return FOG_PRESET_ERRORS.duplicate;
      }
      const now = new Date().toISOString();
      upsertFogPreset(campaignCode, {
        v: 1,
        id: generateFogPresetId(),
        name: normalizeFogPresetName(candidate) ?? candidate,
        material: structuredClone(preset.material),
        createdAt: now,
        updatedAt: now,
      });
      return null;
    },
    [storageLibrary, upsertFogPreset, campaignCode]
  );

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) removeFogPreset(campaignCode, pendingDeleteId);
    setPendingDeleteId(null);
    setManagerError(null);
  }, [pendingDeleteId, removeFogPreset, campaignCode]);

  const openManager = useCallback(() => {
    setManagerOpen(true);
  }, []);

  const closeManager = useCallback(() => {
    setManagerOpen(false);
    setPendingDeleteId(null);
    setManagerError(null);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  return {
    library,
    applied,
    selectedValue,
    appliedLabel,
    select,
    editor,
    openEditor,
    updateDraft,
    setDraftKind,
    randomizeSeed,
    resetDraft,
    cancelEditor,
    applyDraft,
    saveDraftAsPreset,
    updateSourcePreset,
    managerOpen,
    openManager,
    closeManager,
    renamePreset,
    duplicatePreset,
    managerError,
    setManagerError,
    pendingDeleteId,
    requestDelete: setPendingDeleteId,
    confirmDelete,
    cancelDelete,
  };
}
