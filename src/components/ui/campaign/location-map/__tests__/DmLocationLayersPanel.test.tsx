import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Layer } from '@fieldnotes/core';

import DmLocationLayersPanel from '../DmLocationLayersPanel';

const mocks = vi.hoisted(() => ({
  viewport: {
    layerManager: { getLayer: vi.fn(() => undefined) },
    requestRender: vi.fn(),
  },
  layers: {
    layers: [] as unknown[],
    activeLayerId: 'layer-annotations',
    createLayer: vi.fn(() => ({ id: 'layer-custom-2' })),
    removeLayer: vi.fn(),
    setVisible: vi.fn(),
    setLocked: vi.fn(),
    setActiveLayer: vi.fn(),
  },
}));

vi.mock('@fieldnotes/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/react')>()),
  useLayers: () => mocks.layers,
  useElements: () => [],
  useViewport: () => mocks.viewport,
}));

vi.mock('@/components/ui/campaign/battle-map/EncounterLinkingPanel', () => ({
  default: () => null,
}));

function renderPanel(
  onClose = vi.fn(),
  publish: {
    publishLayerUpsert?: (definition: Layer) => void;
    publishLayerRemove?: (id: string) => void;
  } = {}
) {
  return render(
    <DmLocationLayersPanel
      mode="battlemap"
      campaignCode="TEST01"
      linkedEncounterIds={[]}
      onLinkEncounter={vi.fn()}
      onUnlinkEncounter={vi.fn()}
      onClose={onClose}
      {...publish}
    />
  );
}

describe('DmLocationLayersPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    mocks.layers.layers = [
      { id: 'layer-map', name: 'Map', visible: true, locked: true },
      {
        id: 'layer-annotations',
        name: 'Annotations',
        visible: true,
        locked: false,
      },
      { id: 'layer-custom-1', name: 'Traps', visible: true, locked: false },
      { id: 'player-pc1', name: 'Aria', visible: true, locked: false },
    ] as unknown as Layer[];
    mocks.layers.activeLayerId = 'layer-annotations';
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('names each layer row as a group', () => {
    renderPanel();

    const groups = screen.getAllByRole('group');
    expect(groups.map(g => g.getAttribute('aria-label'))).toEqual([
      'Traps',
      'Annotations',
      'Map',
    ]);
    expect(screen.queryByRole('group', { name: 'Aria' })).toBeNull();
  });

  it('marks the active layer', async () => {
    const user = userEvent.setup();
    renderPanel();

    const active = within(
      screen.getByRole('group', { name: 'Annotations' })
    ).getByRole('button', { name: 'Annotations' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toHaveAttribute('data-selected', 'true');

    const other = within(
      screen.getByRole('group', { name: 'Traps' })
    ).getByRole('button', { name: 'Traps' });
    expect(other).toHaveAttribute('aria-pressed', 'false');
    await user.click(other);
    expect(mocks.layers.setActiveLayer).toHaveBeenCalledWith('layer-custom-1');
    expect(mocks.viewport.requestRender).toHaveBeenCalled();
  });

  it('map layer is not selectable and has no delete', () => {
    renderPanel();

    const mapRow = within(screen.getByRole('group', { name: 'Map' }));
    expect(mapRow.queryByRole('button', { name: 'Map' })).toBeNull();
    expect(mapRow.queryByRole('button', { name: 'Delete layer' })).toBeNull();
    // The map layer is always locked: a static glyph, not a toggle.
    expect(mapRow.queryByRole('button', { name: /lock layer/i })).toBeNull();
    expect(mapRow.getByText('Map')).toBeInTheDocument();

    const annotationsRow = within(
      screen.getByRole('group', { name: 'Annotations' })
    );
    expect(
      annotationsRow.queryByRole('button', { name: 'Delete layer' })
    ).toBeNull();
  });

  it('toggles visibility and lock by name', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    const traps = within(screen.getByRole('group', { name: 'Traps' }));

    await user.click(traps.getByRole('button', { name: 'Hide layer' }));
    expect(mocks.layers.setVisible).toHaveBeenCalledWith(
      'layer-custom-1',
      false
    );

    await user.click(traps.getByRole('button', { name: 'Lock layer' }));
    expect(mocks.layers.setLocked).toHaveBeenCalledWith('layer-custom-1', true);

    const remove = traps.getByRole('button', { name: 'Delete layer' });
    expect(remove).toHaveAttribute('data-variant', 'danger');
    await user.click(remove);
    expect(mocks.layers.removeLayer).toHaveBeenCalledWith('layer-custom-1');

    // Toggling a layer never makes it active.
    expect(mocks.layers.setActiveLayer).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[title]').length).toBe(0);
  });

  it('publishes custom layer edits over layer sync, never canonical ones', async () => {
    const user = userEvent.setup();
    const trapsLayer = {
      id: 'layer-custom-1',
      name: 'Traps',
      visible: true,
      locked: false,
    } as unknown as Layer;
    mocks.viewport.layerManager.getLayer.mockImplementation(((id: string) =>
      id === 'layer-custom-1' ? trapsLayer : undefined) as never);
    const publishLayerUpsert = vi.fn();
    const publishLayerRemove = vi.fn();
    renderPanel(vi.fn(), { publishLayerUpsert, publishLayerRemove });

    const traps = within(screen.getByRole('group', { name: 'Traps' }));
    await user.click(traps.getByRole('button', { name: 'Hide layer' }));
    expect(publishLayerUpsert).toHaveBeenCalledTimes(1);
    expect(publishLayerUpsert).toHaveBeenLastCalledWith(trapsLayer);

    await user.click(traps.getByRole('button', { name: 'Lock layer' }));
    expect(publishLayerUpsert).toHaveBeenCalledTimes(2);
    expect(publishLayerUpsert).toHaveBeenLastCalledWith(trapsLayer);

    await user.click(traps.getByRole('button', { name: 'Delete layer' }));
    expect(publishLayerRemove).toHaveBeenCalledWith('layer-custom-1');

    const annotations = within(
      screen.getByRole('group', { name: 'Annotations' })
    );
    await user.click(annotations.getByRole('button', { name: 'Hide layer' }));
    expect(mocks.layers.setVisible).toHaveBeenLastCalledWith(
      'layer-annotations',
      false
    );
    expect(publishLayerUpsert).toHaveBeenCalledTimes(2);
    expect(publishLayerRemove).toHaveBeenCalledTimes(1);
    expect(mocks.viewport.layerManager.getLayer).not.toHaveBeenCalledWith(
      'layer-annotations'
    );
  });

  it('hides the header glyphs from assistive tech', () => {
    renderPanel();
    for (const name of ['Add layer', 'Close layers']) {
      expect(
        screen.getByRole('button', { name }).querySelector('svg')
      ).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('shows the locked and hidden states by label', () => {
    mocks.layers.layers = [
      { id: 'layer-custom-1', name: 'Traps', visible: false, locked: true },
    ] as unknown as Layer[];
    renderPanel();
    const traps = within(screen.getByRole('group', { name: 'Traps' }));

    expect(traps.getByRole('button', { name: 'Show layer' })).toBeVisible();
    expect(traps.getByRole('button', { name: 'Unlock layer' })).toBeVisible();
  });

  it('header controls', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel(onClose);

    expect(screen.getByRole('heading', { name: 'Layers' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    expect(mocks.layers.createLayer).toHaveBeenCalledOnce();
    expect(mocks.viewport.requestRender).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close layers' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
