import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { BattleMapExportControl } from '../BattleMapExportControl';
import type { FogStateV1, FogStyle } from '@fieldnotes/vtt';

const vp = { exportImage: vi.fn(), getVisibleRect: vi.fn() };

const getTrigger = () => screen.getByRole('button', { name: 'Export map' });

async function openPopover() {
  fireEvent.click(getTrigger());
  return screen.findByRole('dialog', { name: 'Export map' });
}

async function renderControl(
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
  await openPopover();
  return exporter;
}

describe('BattleMapExportControl', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens a named popover from an icon trigger', async () => {
    render(
      <BattleMapExportControl
        getViewport={() => vp}
        name="Cave"
        onError={vi.fn()}
      />
    );
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-selected');

    const popover = await openPopover();
    expect(popover).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-selected', 'true');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
  });

  it('groups choices as named radio groups', async () => {
    const dmOnly = { secret: true };
    const exporter = await renderControl({ getDmOnlyElements: () => dmOnly });
    const audience = screen.getByRole('radiogroup', { name: 'Audience' });
    const bounds = screen.getByRole('radiogroup', { name: 'Bounds' });
    const format = screen.getByRole('radiogroup', { name: 'Format' });
    expect(
      within(audience).getByRole('radio', { name: 'Full map' })
    ).toBeInTheDocument();
    expect(
      within(bounds).getByRole('radio', { name: 'Whole map' })
    ).toBeInTheDocument();
    expect(
      within(format).getByRole('radio', { name: 'PNG' })
    ).toBeInTheDocument();

    fireEvent.click(
      within(audience).getByRole('radio', { name: 'Player view' })
    );
    fireEvent.click(
      within(bounds).getByRole('radio', { name: 'Current view' })
    );
    fireEvent.click(within(format).getByRole('radio', { name: 'JPEG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
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

  it('player mount has no Audience group', async () => {
    const exporter = await renderControl();
    expect(
      screen.queryByRole('radiogroup', { name: 'Audience' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/player view/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(exporter).toHaveBeenCalledOnce());
    expect(exporter).toHaveBeenCalledWith(
      vp,
      expect.objectContaining({ audience: 'player' })
    );
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
    const exporter = await renderControl({ getFogState: () => fogState });
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));

    await waitFor(() => expect(exporter).toHaveBeenCalledOnce());
    expect(exporter).toHaveBeenCalledWith(
      vp,
      expect.objectContaining({ audience: 'player', fogState })
    );
  });

  it('reads both live fog state and live fog style from their own getters', async () => {
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
    const fogStyle: FogStyle = { kind: 'solid', color: '#123456' };
    const exporter = await renderControl({
      getFogState: () => fogState,
      getFogStyle: () => fogStyle,
    });
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));

    await waitFor(() => expect(exporter).toHaveBeenCalledOnce());
    expect(exporter).toHaveBeenCalledWith(
      vp,
      expect.objectContaining({ fogState, fogStyle })
    );
  });

  it('exports with the selected options and live dm-only map', async () => {
    const dmOnly = { secret: true };
    const exporter = await renderControl({ getDmOnlyElements: () => dmOnly });
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

  it('shows progress while exporting', async () => {
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
        getDmOnlyElements={() => ({})}
      />
    );
    await openPopover();
    const exportButton = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportButton);
    await waitFor(() => expect(exportButton).toBeDisabled());
    // The spinner is decorative; the name stays "Export".
    expect(exportButton).toHaveAccessibleName('Export');
    expect(getTrigger()).toBeDisabled();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(6);
    for (const radio of radios) expect(radio).toBeDisabled();
    // A second click while pending must not start another export.
    fireEvent.click(exportButton);
    expect(exporter).toHaveBeenCalledTimes(1);
    resolveExport({ blob: new Blob(['x']), filename: 'cave-full.png' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Export map' })
      ).not.toBeInTheDocument()
    );
    expect(exporter).toHaveBeenCalledTimes(1);
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
    await openPopover();
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
  });

  it('keeps focus in the popover when a failed export re-enables the button', async () => {
    const onError = vi.fn();
    let rejectExport: (e: Error) => void = () => {};
    const exporter = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectExport = reject;
        })
    );
    render(
      <BattleMapExportControl
        getViewport={() => vp}
        name="Cave"
        onError={onError}
        exporter={exporter}
      />
    );
    await openPopover();
    const exportButton = screen.getByRole('button', { name: 'Export' });
    // Browsers that blur a disabled button drop focus to <body>; jsdom
    // ignores blur() on a disabled element, so start from <body> instead.
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.click(exportButton);
    await waitFor(() => expect(exportButton).toBeDisabled());
    expect(document.activeElement).toBe(document.body);
    rejectExport(new Error('boom'));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
    expect(
      screen.getByRole('dialog', { name: 'Export map' })
    ).toBeInTheDocument();
    await waitFor(() => expect(exportButton).toHaveFocus());
  });
});
