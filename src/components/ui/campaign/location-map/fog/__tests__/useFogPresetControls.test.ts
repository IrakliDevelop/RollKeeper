import 'fake-indexeddb/auto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Viewport } from '@fieldnotes/core';
import { useDmStore } from '@/store/dmStore';
import type { FogAppearance } from '@/types/battlemap';
import {
  FOG_PRESET_ERRORS,
  useFogPresetControls,
} from '../useFogPresetControls';

const CODE = 'PRESETS';
const solidRed = { v: 1, kind: 'solid', color: '#ff0000' } as const;

let rafCallbacks: FrameRequestCallback[] = [];

function setup(applied: FogAppearance = 'solid') {
  const setFogStyle = vi.fn();
  const viewport = { setFogStyle } as unknown as Viewport;
  const onApply = vi.fn();
  const hook = renderHook(
    ({ current }) =>
      useFogPresetControls({
        campaignCode: CODE,
        viewport,
        applied: current,
        onApply,
      }),
    { initialProps: { current: applied } }
  );
  return { ...hook, setFogStyle, onApply };
}

function flushFrames() {
  const pending = rafCallbacks;
  rafCallbacks = [];
  pending.forEach(cb => cb(0));
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafCallbacks = [];
  });
  useDmStore.setState({
    campaigns: [
      { code: CODE, name: 'C', createdAt: '2026-09-05T00:00:00.000Z' },
    ],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selection', () => {
  it('applies built-ins immediately and custom presets as fresh snapshots with a source id', () => {
    const { result, onApply } = setup();
    act(() => {
      useDmStore.getState().upsertFogPreset(CODE, {
        v: 1,
        id: 'fp_red',
        name: 'Red',
        material: solidRed,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      });
    });
    act(() => result.current.select('cloudy'));
    expect(onApply).toHaveBeenLastCalledWith('cloudy');
    act(() => result.current.select('fp_red'));
    expect(onApply).toHaveBeenLastCalledWith({
      v: 2,
      kind: 'custom',
      sourcePresetId: 'fp_red',
      material: solidRed,
    });
    expect(onApply.mock.calls[1][0].material).not.toBe(solidRed);
  });

  it('reports the selected value and labels for applied snapshots', () => {
    const { result, rerender } = setup();
    act(() => {
      useDmStore.getState().upsertFogPreset(CODE, {
        v: 1,
        id: 'fp_red',
        name: 'Red',
        material: solidRed,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      });
    });
    rerender({
      current: {
        v: 2,
        kind: 'custom',
        sourcePresetId: 'fp_red',
        material: solidRed,
      },
    });
    expect(result.current.selectedValue).toBe('fp_red');
    expect(result.current.appliedLabel).toBeNull();

    rerender({
      current: {
        v: 2,
        kind: 'custom',
        sourcePresetId: 'fp_red',
        material: { ...solidRed, color: '#00ff00' },
      },
    });
    expect(result.current.selectedValue).toBe('custom');
    expect(result.current.appliedLabel).toBe('Modified');

    rerender({
      current: {
        v: 2,
        kind: 'custom',
        sourcePresetId: 'fp_gone',
        material: solidRed,
      },
    });
    expect(result.current.appliedLabel).toBe('Custom (preset deleted)');
  });
});

describe('editor drafts and preview', () => {
  it('opens from the applied appearance, previews once per frame, and cancel restores', () => {
    const { result, setFogStyle } = setup('cloudy');
    act(() => result.current.openEditor());
    expect(result.current.editor?.draft.kind).toBe('procedural');
    setFogStyle.mockClear();

    act(() => {
      result.current.updateDraft({ noiseOpacity: 0.1 });
      result.current.updateDraft({ noiseOpacity: 0.2 });
      result.current.updateDraft({ noiseOpacity: 0.3 });
    });
    expect(setFogStyle).not.toHaveBeenCalled();
    act(() => flushFrames());
    expect(setFogStyle).toHaveBeenCalledTimes(1);
    expect(setFogStyle.mock.calls[0][0].playerStyle.opacity).toBe(0.3);

    act(() => result.current.cancelEditor());
    expect(result.current.editor).toBeNull();
    expect(setFogStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        playerStyle: expect.objectContaining({ seed: 42, scale: 200 }),
      })
    );
  });

  it('switches texture mode, randomizes the seed, and resets', () => {
    const { result } = setup('solid');
    act(() => result.current.openEditor());
    expect(result.current.editor?.draft).toEqual({
      v: 1,
      kind: 'solid',
      color: '#0b1020',
    });
    act(() => result.current.setDraftKind('procedural'));
    expect(result.current.editor?.draft.kind).toBe('procedural');
    const before = (result.current.editor!.draft as { seed: number }).seed;
    act(() => result.current.randomizeSeed());
    const after = (result.current.editor!.draft as { seed: number }).seed;
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThanOrEqual(65535);
    expect(Number.isInteger(after)).toBe(true);
    act(() => result.current.resetDraft());
    expect(result.current.editor?.draft).toEqual({
      v: 1,
      kind: 'solid',
      color: '#0b1020',
    });
    expect(before).toBe(0);
  });

  it('applies the draft as an unattributed snapshot and closes', () => {
    const { result, onApply } = setup('solid');
    act(() => result.current.openEditor());
    act(() => result.current.updateDraft({ color: '#123456' }));
    act(() => result.current.applyDraft());
    expect(onApply).toHaveBeenLastCalledWith({
      v: 2,
      kind: 'custom',
      material: { v: 1, kind: 'solid', color: '#123456' },
    });
    expect(result.current.editor).toBeNull();
  });

  it('keeps the source id when applying an unmodified draft of a preset', () => {
    act(() => {
      useDmStore.getState().upsertFogPreset(CODE, {
        v: 1,
        id: 'fp_red',
        name: 'Red',
        material: solidRed,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      });
    });
    const applied = {
      v: 2,
      kind: 'custom',
      sourcePresetId: 'fp_red',
      material: solidRed,
    } as const;
    const { result, onApply } = setup(applied);
    act(() => result.current.openEditor());
    act(() => result.current.applyDraft());
    expect(onApply).toHaveBeenLastCalledWith(applied);
  });

  it('keeps the attribution set by saveDraftAsPreset when applying afterward', () => {
    const { result, onApply } = setup('solid');
    act(() => result.current.openEditor());
    act(() => result.current.updateDraft({ color: '#123456' }));
    act(() => {
      result.current.saveDraftAsPreset('Mine');
    });
    act(() => result.current.applyDraft());
    const savedId = useDmStore
      .getState()
      .getCampaign(CODE)!
      .fogPresets!.find(p => p.name === 'Mine')!.id;
    expect(onApply).toHaveBeenLastCalledWith({
      v: 2,
      kind: 'custom',
      sourcePresetId: savedId,
      material: { v: 1, kind: 'solid', color: '#123456' },
    });
  });

  it('does nothing to the frame loop or applied state when the pending frame is cancelled on unmount', () => {
    const { result, unmount, setFogStyle } = setup('cloudy');
    act(() => result.current.openEditor());
    setFogStyle.mockClear();
    act(() => result.current.updateDraft({ noiseOpacity: 0.4 }));
    expect(rafCallbacks.length).toBe(1);

    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);

    flushFrames();
    expect(setFogStyle).not.toHaveBeenCalled();
  });
});

describe('library CRUD', () => {
  it('saves a new preset, rejects duplicates and reserved names', () => {
    const { result } = setup('solid');
    act(() => result.current.openEditor());
    let error: string | null = null;
    act(() => {
      error = result.current.saveDraftAsPreset('  Mist ');
    });
    expect(error).toBeNull();
    expect(
      useDmStore
        .getState()
        .getCampaign(CODE)!
        .fogPresets!.map(p => p.name)
    ).toEqual(['Mist']);
    act(() => {
      error = result.current.saveDraftAsPreset('mist');
    });
    expect(error).toBe('A preset with that name already exists.');
    act(() => {
      error = result.current.saveDraftAsPreset('Cloudy');
    });
    expect(error).toBe('That name is reserved for a built-in appearance.');
    act(() => {
      error = result.current.saveDraftAsPreset('');
    });
    expect(error).toBe('Enter a name between 1 and 60 characters.');
  });

  it('rejects saving a new preset once the library is at the 50-preset cap', () => {
    act(() => {
      for (let i = 1; i <= 50; i += 1) {
        useDmStore.getState().upsertFogPreset(CODE, {
          v: 1,
          id: `fp_${i}`,
          name: `P${i}`,
          material: solidRed,
          createdAt: '2026-09-05T00:00:00.000Z',
          updatedAt: '2026-09-05T00:00:00.000Z',
        });
      }
    });
    const { result } = setup('solid');
    act(() => result.current.openEditor());
    let error: string | null = null;
    act(() => {
      error = result.current.saveDraftAsPreset('P51');
    });
    expect(error).toBe(FOG_PRESET_ERRORS.full);
    expect(useDmStore.getState().getCampaign(CODE)!.fogPresets!.length).toBe(
      50
    );
    expect(result.current.editor?.error).toBe(FOG_PRESET_ERRORS.full);
  });

  it('updates the source preset from the draft without touching the applied map', () => {
    act(() => {
      useDmStore.getState().upsertFogPreset(CODE, {
        v: 1,
        id: 'fp_red',
        name: 'Red',
        material: solidRed,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      });
    });
    const { result, onApply } = setup({
      v: 2,
      kind: 'custom',
      sourcePresetId: 'fp_red',
      material: solidRed,
    });
    act(() => result.current.openEditor());
    act(() => result.current.updateDraft({ color: '#00ff00' }));
    act(() => {
      result.current.updateSourcePreset();
    });
    expect(
      useDmStore.getState().getCampaign(CODE)!.fogPresets![0].material
    ).toEqual({ ...solidRed, color: '#00ff00' });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('renames, duplicates, and deletes with confirmation', () => {
    act(() => {
      useDmStore.getState().upsertFogPreset(CODE, {
        v: 1,
        id: 'fp_red',
        name: 'Red',
        material: solidRed,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      });
    });
    const { result, onApply } = setup('solid');
    let error: string | null = null;
    act(() => {
      error = result.current.renamePreset('fp_red', 'Crimson');
    });
    expect(error).toBeNull();
    act(() => result.current.duplicatePreset('fp_red'));
    const names = () =>
      useDmStore
        .getState()
        .getCampaign(CODE)!
        .fogPresets!.map(p => p.name);
    expect(names()).toEqual(['Crimson', 'Crimson copy']);
    act(() => result.current.requestDelete('fp_red'));
    expect(result.current.pendingDeleteId).toBe('fp_red');
    act(() => result.current.confirmDelete());
    expect(names()).toEqual(['Crimson copy']);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('fails fast with a name error when duplicating a preset whose name is already at the length limit', () => {
    const longName = 'L'.repeat(60);
    act(() => {
      useDmStore.getState().upsertFogPreset(CODE, {
        v: 1,
        id: 'fp_long',
        name: longName,
        material: solidRed,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      });
    });
    const { result } = setup('solid');
    let error: string | null = null;
    act(() => {
      error = result.current.duplicatePreset('fp_long');
    });
    expect(error).toBe(FOG_PRESET_ERRORS.name);
    expect(
      useDmStore
        .getState()
        .getCampaign(CODE)!
        .fogPresets!.map(p => p.name)
    ).toEqual([longName]);
  });
});
