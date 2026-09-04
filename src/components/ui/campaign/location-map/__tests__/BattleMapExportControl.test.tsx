import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { BattleMapExportControl } from '../BattleMapExportControl';
import type { FogStateV1 } from '@fieldnotes/core';

const vp = { exportImage: vi.fn(), getVisibleRect: vi.fn() };

function renderControl(
  props: Partial<Parameters<typeof BattleMapExportControl>[0]> = {}
) {
  const exporter = vi
    .fn()
    .mockResolvedValue({ blob: new Blob(['x']), filename: 'cave.png' });
  render(
    <BattleMapExportControl
      getViewport={() => vp}
      name="Cave"
      mapImageSize={{ w: 100, h: 80 }}
      onError={vi.fn()}
      exporter={exporter}
      {...props}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /export map/i }));
  return exporter;
}

describe('BattleMapExportControl', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => cleanup());

  it('shows the audience radio only when getDmOnlyElements is provided', () => {
    renderControl({ getDmOnlyElements: () => ({}) });
    expect(screen.getByText(/player view/i)).toBeInTheDocument();
  });

  it('hides the audience radio on player surfaces', () => {
    renderControl();
    expect(screen.queryByText(/player view/i)).not.toBeInTheDocument();
  });

  it('treats a player surface as player audience and reads live fog state', async () => {
    const fogState = {
      version: 1,
      definition: {
        bounds: { x: 0, y: 0, w: 100, h: 80 },
        base: 'covered',
        cellSize: 16,
        generation: 'g1',
      },
      tiles: [],
    } as unknown as FogStateV1;
    const exporter = renderControl({ getFogState: () => fogState });
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));

    await waitFor(() => expect(exporter).toHaveBeenCalledOnce());
    expect(exporter).toHaveBeenCalledWith(
      vp,
      expect.objectContaining({ audience: 'player', fogState })
    );
  });

  it('exports with the selected options and live dm-only map', async () => {
    const dmOnly = { secret: true };
    const exporter = renderControl({ getDmOnlyElements: () => dmOnly });
    fireEvent.click(screen.getByLabelText(/player view/i));
    fireEvent.click(screen.getByLabelText(/current view/i));
    fireEvent.click(screen.getByLabelText(/jpeg/i));
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1));
    expect(exporter).toHaveBeenCalledWith(
      vp,
      expect.objectContaining({
        audience: 'player',
        bounds: 'view',
        format: 'jpeg',
        name: 'Cave',
        dmOnlyElements: dmOnly,
      })
    );
  });

  it('disables the export action (and radios) while an export is pending', async () => {
    let resolveExport: (r: { blob: Blob; filename: string }) => void = () => {};
    const exporter = vi.fn().mockImplementation(
      () =>
        new Promise<{ blob: Blob; filename: string }>(resolve => {
          resolveExport = resolve;
        })
    );
    render(
      <BattleMapExportControl
        getViewport={() => vp}
        name="Cave"
        onError={vi.fn()}
        exporter={exporter}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /export map/i }));
    const exportButton = screen.getByRole('button', { name: /^export$/i });
    fireEvent.click(exportButton);
    await waitFor(() => expect(exportButton).toBeDisabled());
    expect(screen.getByLabelText(/jpeg/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /export map/i })).toBeDisabled();
    // A second click while pending must not start another export.
    fireEvent.click(exportButton);
    expect(exporter).toHaveBeenCalledTimes(1);
    resolveExport({ blob: new Blob(['x']), filename: 'cave-full.png' });
    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1));
  });

  it('surfaces export failures through onError', async () => {
    const onError = vi.fn();
    const exporter = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <BattleMapExportControl
        getViewport={() => vp}
        name="Cave"
        onError={onError}
        exporter={exporter}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /export map/i }));
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
  });
});
