import { describe, it, expect, vi } from 'vitest';
import { FogManager } from '@fieldnotes/core';
import { initializeMapFog } from '../initializeMapFog';
import { reconcileMapFogBounds } from '../reconcileMapFogBounds';
import { configureFogView } from '../configureFogView';
import { attachFogPersistence } from '../attachFogPersistence';
import { FOG_SECURITY_EXPLANATION } from '../fogProductCopy';

describe('initializeMapFog', () => {
  it('always initializes with base covered', () => {
    const fm = new FogManager();
    const state = initializeMapFog(fm, { x: 0, y: 0, w: 1024, h: 1024 });
    expect(state.definition.base).toBe('covered');
  });

  it('uses recommendedFogCellSize for the cellSize', () => {
    const fm = new FogManager();
    const state = initializeMapFog(fm, { x: 0, y: 0, w: 4096, h: 4096 });
    expect(state.definition.cellSize).toBeGreaterThanOrEqual(1);
    expect(state.definition.tileCells).toBe(128);
  });
});

describe('reconcileMapFogBounds', () => {
  it('does not call setBounds when bounds are equal', () => {
    const fm = new FogManager();
    const bounds = { x: 0, y: 0, w: 512, h: 512 };
    initializeMapFog(fm, bounds);
    const spy = vi.spyOn(fm, 'setBounds');
    reconcileMapFogBounds(fm, bounds);
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls setBounds when bounds differ', () => {
    const fm = new FogManager();
    initializeMapFog(fm, { x: 0, y: 0, w: 512, h: 512 });
    const spy = vi.spyOn(fm, 'setBounds');
    reconcileMapFogBounds(fm, { x: 0, y: 0, w: 1024, h: 1024 });
    expect(spy).toHaveBeenCalledWith({ x: 0, y: 0, w: 1024, h: 1024 });
  });

  it('does nothing when fog is not initialized', () => {
    const fm = new FogManager();
    const spy = vi.spyOn(fm, 'setBounds');
    reconcileMapFogBounds(fm, { x: 0, y: 0, w: 512, h: 512 });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('configureFogView', () => {
  it('sets editor for DM without preview', () => {
    const fm = new FogManager();
    configureFogView(fm, 'dm', false);
    expect(fm.getViewMode()).toBe('editor');
  });

  it('sets player for DM with preview', () => {
    const fm = new FogManager();
    configureFogView(fm, 'dm', true);
    expect(fm.getViewMode()).toBe('player');
  });

  it('sets player for player regardless of preview', () => {
    const fm = new FogManager();
    configureFogView(fm, 'player', false);
    expect(fm.getViewMode()).toBe('player');
    configureFogView(fm, 'player', true);
    expect(fm.getViewMode()).toBe('player');
  });

  it('sets player for display regardless of preview', () => {
    const fm = new FogManager();
    configureFogView(fm, 'display', false);
    expect(fm.getViewMode()).toBe('player');
    configureFogView(fm, 'display', true);
    expect(fm.getViewMode()).toBe('player');
  });
});

describe('attachFogPersistence', () => {
  it('calls onSave for local changes', () => {
    const fm = new FogManager();
    initializeMapFog(fm, { x: 0, y: 0, w: 512, h: 512 });
    const onSave = vi.fn();
    const cleanup = attachFogPersistence(fm, onSave);

    fm.reset('covered');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(fm.getState());

    cleanup();
  });

  it('does not call onSave for remote-origin changes', () => {
    const fm = new FogManager();
    initializeMapFog(fm, { x: 0, y: 0, w: 512, h: 512 });
    const onSave = vi.fn();
    const cleanup = attachFogPersistence(fm, onSave);

    fm.loadState(fm.getState(), { origin: 'remote' });
    expect(onSave).not.toHaveBeenCalled();

    cleanup();
  });

  it('calls onSave for changes without origin', () => {
    const fm = new FogManager();
    initializeMapFog(fm, { x: 0, y: 0, w: 512, h: 512 });
    const onSave = vi.fn();
    const cleanup = attachFogPersistence(fm, onSave);

    fm.loadState(fm.getState());
    expect(onSave).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('cleanup is idempotent', () => {
    const fm = new FogManager();
    initializeMapFog(fm, { x: 0, y: 0, w: 512, h: 512 });
    const onSave = vi.fn();
    const cleanup = attachFogPersistence(fm, onSave);
    cleanup();
    cleanup();

    fm.reset('covered');
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('fogProductCopy', () => {
  it('contains required visual-vs-secure explanation terms', () => {
    expect(FOG_SECURITY_EXPLANATION).toContain('visually');
    expect(FOG_SECURITY_EXPLANATION).toContain('does not remove');
    expect(FOG_SECURITY_EXPLANATION.toLowerCase()).not.toContain('secure');
    expect(FOG_SECURITY_EXPLANATION.toLowerCase()).not.toContain('private');
  });
});
