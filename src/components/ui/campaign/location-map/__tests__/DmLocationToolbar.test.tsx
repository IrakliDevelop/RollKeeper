import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DmLocationToolbar, {
  DM_LOCATION_BATTLEMAP_ONLY_TOOL_NAMES,
  DM_LOCATION_PRESENCE_TOOL_NAMES,
  DM_LOCATION_TOOL_NAMES,
} from '@/components/ui/campaign/location-map/DmLocationToolbar';
import {
  MAP_TOOL_META,
  mapToolDefs,
} from '@/components/ui/campaign/location-map/mapToolDefs';
import {
  MARKER_MIXED_AUDIENCE_MESSAGE,
  MARKER_SHARE_REVEALS_CLASSIFICATION,
} from '@/components/ui/campaign/location-map/markerAudienceCopy';

import type { DmLocationToolbarProps } from '@/components/ui/campaign/location-map/DmLocationToolbar.types';

let mockActiveTool = 'select';

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => [mockActiveTool, vi.fn()] as const,
  useHistory: () => ({
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  }),
}));

const baseProps: DmLocationToolbarProps = {
  onPickImage: vi.fn(),
  onClear: vi.fn(),
  onFitToMap: vi.fn(),
  gridEnabled: false,
  gridType: 'hex',
  gridCellSize: 50,
  gridColor: '#94a3b8',
  gridOpacity: 0.5,
  onSetGridType: vi.fn(),
  onUpdateGridSettings: vi.fn(),
  onSyncToPlayers: vi.fn(),
  syncing: false,
  hasUnsyncedChanges: false,
  lastSyncedAt: null,
  selectedElementId: null,
  isDmOnly: false,
  onToggleDmOnly: vi.fn(),
  hiddenPlacementActive: false,
  onToggleHiddenPlacement: vi.fn(),
  hiddenElementCount: 0,
  onRevealAll: vi.fn(),
  mode: 'battlemap',
  syncStatus: 'disabled',
};

beforeEach(() => {
  mockActiveTool = 'select';
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

describe('DmLocationToolbar', () => {
  it('offers the shared fog action only when enabled and respects mutation gating', () => {
    const requestActivate = vi.fn();
    const fogControls = {
      initialized: true,
      disabled: true,
      disabledReason: 'Finish arranging map images before editing fog.',
      operation: 'reveal' as const,
      shape: 'brush' as const,
      radius: 40,
      preview: false,
      diagnostic: null,
      pendingAction: null,
      requestActivate,
      setOperation: vi.fn(),
      setShape: vi.fn(),
      setRadius: vi.fn(),
      setPreview: vi.fn(),
      requestAction: vi.fn(),
      confirmAction: vi.fn(),
      cancelAction: vi.fn(),
      reconcileBounds: vi.fn(),
      reportError: vi.fn(),
    };
    const { rerender } = render(
      <DmLocationToolbar {...baseProps} fogControls={fogControls} />
    );
    const button = screen.getByRole('button', { name: 'Fog of war' });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('title');

    rerender(
      <DmLocationToolbar
        {...baseProps}
        fogControls={{ ...fogControls, disabled: false }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fog of war' }));
    expect(requestActivate).toHaveBeenCalledOnce();
  });

  it('no longer mounts the selection ops (delete/rotate/align) — consolidated into DmSelectionOptions', () => {
    render(<DmLocationToolbar {...baseProps} />);
    for (const name of [
      'Delete selected',
      'Rotate 90° clockwise',
      'Rotate 90° counter-clockwise',
      'Align',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('collapses grid controls into the popover (no inline sliders)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DmLocationToolbar {...baseProps} gridEnabled={true} />
    );
    // Trigger present, inline strip gone even with grid enabled.
    expect(screen.getByRole('button', { name: /^Grid:/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: 'Grid cell size' })
    ).not.toBeInTheDocument();
    // Opening the popover reveals the controls.
    await user.click(screen.getByRole('button', { name: /^Grid:/ }));
    expect(
      screen.getByRole('slider', { name: 'Grid cell size' })
    ).toBeInTheDocument();
    // No title attribute is left anywhere in the toolbar.
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('wraps instead of clipping (flex-wrap on the container)', () => {
    const { container } = render(<DmLocationToolbar {...baseProps} />);
    expect(container.firstElementChild?.className).toContain('flex-wrap');
  });

  it('offers an eraser tool separately from clearing the canvas', () => {
    render(<DmLocationToolbar {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear canvas' })
    ).toBeInTheDocument();
  });

  it('renders viewsControl next to exportControl in battlemap mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="battlemap"
        exportControl={<div data-testid="export-control-marker" />}
        viewsControl={<div data-testid="views-control-marker" />}
      />
    );
    expect(screen.getByTestId('export-control-marker')).toBeInTheDocument();
    expect(screen.getByTestId('views-control-marker')).toBeInTheDocument();
  });

  it('does not render viewsControl in location mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        exportControl={<div data-testid="export-control-marker" />}
        viewsControl={<div data-testid="views-control-marker" />}
      />
    );
    expect(
      screen.queryByTestId('views-control-marker')
    ).not.toBeInTheDocument();
  });

  it('renders presenceControl next to viewsControl in battlemap mode', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="battlemap"
        viewsControl={<div data-testid="views-control-marker" />}
        presenceControl={<div data-testid="presence-slot" />}
      />
    );
    expect(screen.getByTestId('views-control-marker')).toBeInTheDocument();
    expect(screen.getByTestId('presence-slot')).toBeInTheDocument();
  });

  it('does not render presenceControl or a live chip in location mode without live sync', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        presenceControl={<div data-testid="presence-slot" />}
      />
    );
    expect(screen.queryByTestId('presence-slot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('live-sync-chip')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Place hidden' })
    ).not.toBeInTheDocument();
  });

  it('location mode with live sync: presence control, live chip and hidden placement join the snapshot button', () => {
    const onToggle = vi.fn();
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        liveSyncConfigured
        syncStatus="live"
        hiddenElementCount={2}
        onToggleHiddenPlacement={onToggle}
        presenceControl={<div data-testid="presence-slot" />}
        viewsControl={<div data-testid="views-control-marker" />}
      />
    );
    expect(screen.getByTestId('presence-slot')).toBeInTheDocument();
    expect(screen.getByTestId('live-sync-chip')).toHaveTextContent('Live');
    expect(
      screen.getByRole('button', { name: 'Sync to players' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Place hidden' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Reveal all (2)' })
    ).toBeInTheDocument();
    // Still battlemap-only:
    expect(
      screen.queryByTestId('views-control-marker')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open TV display' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Share with players' })
    ).not.toBeInTheDocument();
  });

  it('shows hidden-placement state and reveals all hidden elements', () => {
    const onToggle = vi.fn();
    const onRevealAll = vi.fn();
    render(
      <DmLocationToolbar
        {...baseProps}
        hiddenPlacementActive
        onToggleHiddenPlacement={onToggle}
        hiddenElementCount={3}
        onRevealAll={onRevealAll}
      />
    );

    const placement = screen.getByRole('button', { name: 'Placing hidden' });
    expect(placement).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(placement);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal all (3)' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onRevealAll).toHaveBeenCalledOnce();
  });

  it('exports the presence / battlemap-only split and keeps every name in DM_LOCATION_TOOL_NAMES', () => {
    expect(DM_LOCATION_PRESENCE_TOOL_NAMES).toEqual(['laser', 'ping']);
    expect(DM_LOCATION_BATTLEMAP_ONLY_TOOL_NAMES).toEqual([
      'measure',
      'path',
      'template',
      'eraser',
    ]);
    for (const name of [
      ...DM_LOCATION_PRESENCE_TOOL_NAMES,
      ...DM_LOCATION_BATTLEMAP_ONLY_TOOL_NAMES,
    ]) {
      expect(DM_LOCATION_TOOL_NAMES).toContain(name);
    }
  });

  it('offers laser and ping in location mode only when live sync is configured', () => {
    const { unmount } = render(
      <DmLocationToolbar {...baseProps} mode="location" />
    );
    expect(
      screen.queryByRole('button', { name: 'Laser pointer' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ping' })
    ).not.toBeInTheDocument();
    unmount();

    render(
      <DmLocationToolbar {...baseProps} mode="location" liveSyncConfigured />
    );
    expect(
      screen.getByRole('button', { name: 'Laser pointer' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ping' })).toBeInTheDocument();
  });

  it('never offers the battlemap-only tools in location mode, even with live sync', () => {
    render(
      <DmLocationToolbar {...baseProps} mode="location" liveSyncConfigured />
    );
    for (const name of ['Measure', 'Move', 'Template', 'Eraser']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps laser and ping in battlemap mode with no relay configured (shipped behaviour)', () => {
    render(<DmLocationToolbar {...baseProps} mode="battlemap" />);
    expect(
      screen.getByRole('button', { name: 'Laser pointer' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ping' })).toBeInTheDocument();
  });
});

describe('DmLocationToolbar marker chrome', () => {
  it('offers a Marker tool in both battlemap and location mode', () => {
    const { unmount } = render(<DmLocationToolbar {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Marker' })).toBeInTheDocument();
    unmount();

    render(<DmLocationToolbar {...baseProps} mode="location" />);
    expect(screen.getByRole('button', { name: 'Marker' })).toBeInTheDocument();
  });

  it('surfaces the mixed-audience refusal next to the DM-only toggle', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="pin-1"
        selectedElementIsMarker
        markerAudienceNotice={MARKER_MIXED_AUDIENCE_MESSAGE}
      />
    );

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(/pins don't currently agree/i);
    expect(notice).toHaveTextContent(/Set them to match/i);
  });

  it('renders no notice when there is nothing to explain (same fixture, notice null)', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="pin-1"
        selectedElementIsMarker
        markerAudienceNotice={null}
      />
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the DM-only toggle warns that a shared marker publishes its kind, label and colour', async () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="pin-1"
        selectedElementIsMarker
      />
    );

    const toggle = screen.getByTestId('dm-only-toggle');
    expect(toggle).not.toHaveAttribute('title');
    expect(toggle.getAttribute('aria-label')).toContain(
      MARKER_SHARE_REVEALS_CLASSIFICATION
    );

    // The one allowed class assertion: jsdom computes no widths, and the
    // Radix popper sets `min-width: max-content`, so without a max width the
    // ~260-character marker copy renders as one unwrapped line.
    await userEvent.setup().hover(toggle);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(MARKER_SHARE_REVEALS_CLASSIFICATION);
    expect((tooltip.closest('[data-side]') as HTMLElement).className).toContain(
      'max-w-xs'
    );
  });

  it('a non-marker selection keeps the plain visibility copy', () => {
    render(<DmLocationToolbar {...baseProps} selectedElementId="shape-1" />);

    const toggle = screen.getByTestId('dm-only-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Visible to players');
    expect(toggle.getAttribute('aria-label')).not.toContain(
      MARKER_SHARE_REVEALS_CLASSIFICATION
    );
  });
});

describe('DmLocationToolbar tool chrome', () => {
  const BATTLEMAP_TOOLS = DM_LOCATION_TOOL_NAMES;

  it('marks the active tool with aria-pressed and the selected outline, not a primary fill', () => {
    mockActiveTool = 'shape';
    render(<DmLocationToolbar {...baseProps} />);

    const active = screen.getByRole('button', { name: 'Shape' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toHaveAttribute('data-selected');
    expect(active).toHaveAttribute('data-variant', 'ghost');

    const other = screen.getByRole('button', { name: 'Text' });
    expect(other).toHaveAttribute('aria-pressed', 'false');
    expect(other).not.toHaveAttribute('data-selected');
    expect(other).toHaveAttribute('data-variant', 'ghost');
  });

  it('does not mark the image action as a pressed mode', () => {
    mockActiveTool = 'image';
    render(<DmLocationToolbar {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Image' })).not.toHaveAttribute(
      'aria-pressed'
    );
  });

  it('names every tool with an aria-label from MAP_TOOL_META and gives no tool a title', () => {
    render(<DmLocationToolbar {...baseProps} mode="battlemap" />);
    for (const name of BATTLEMAP_TOOLS) {
      const meta = MAP_TOOL_META[name];
      expect(meta).toBeDefined();
      const button = screen.getByRole('button', { name: meta!.label });
      expect(button).toHaveAttribute('aria-label', meta!.label);
      expect(button).not.toHaveAttribute('title');
    }
    expect(
      screen.getByRole('button', { name: 'Sticky note' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ping' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Template' })
    ).toBeInTheDocument();
  });

  it('keeps title off the fog button, history, fit, clear, the chip, the sync status and the DM-only toggle', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        liveSyncConfigured
        syncStatus="live"
        lastSyncedAt={new Date().toISOString()}
        selectedElementId="shape-1"
        fogControls={{
          initialized: true,
          disabled: false,
          disabledReason: undefined,
          operation: 'reveal',
          shape: 'brush',
          radius: 40,
          preview: false,
          diagnostic: null,
          pendingAction: null,
          requestActivate: vi.fn(),
          setOperation: vi.fn(),
          setShape: vi.fn(),
          setRadius: vi.fn(),
          setPreview: vi.fn(),
          requestAction: vi.fn(),
          confirmAction: vi.fn(),
          cancelAction: vi.fn(),
          reconcileBounds: vi.fn(),
          reportError: vi.fn(),
        }}
      />
    );
    for (const name of [
      'Fog of war',
      'Undo',
      'Redo',
      'Fit map to screen',
      'Clear canvas',
    ]) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('title');
    }
    expect(screen.getByTestId('live-sync-chip')).not.toHaveAttribute('title');
    expect(screen.getByText(/^Synced /)).not.toHaveAttribute('title');
    expect(screen.getByTestId('dm-only-toggle')).not.toHaveAttribute('title');
  });

  it.each([
    ['live', 'Live'],
    ['connecting', 'Connecting…'],
    ['offline', 'Offline'],
    ['denied', 'Denied'],
    ['unsupported', 'Sync unavailable'],
    ['disabled', 'Sync off'],
  ] as const)(
    'renders the live chip as a word with no pill: %s',
    (status, text) => {
      render(
        <DmLocationToolbar
          {...baseProps}
          mode="battlemap"
          syncStatus={status}
        />
      );
      const chip = screen.getByTestId('live-sync-chip');
      expect(chip).toHaveTextContent(text);
      expect(chip.className).not.toContain('rounded-full px-2');
    }
  );

  it('always shows the location sync status text', () => {
    const { rerender } = render(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        lastSyncedAt={new Date().toISOString()}
      />
    );
    expect(screen.getByText('Synced just now')).toBeVisible();
    expect(screen.getByText('Synced just now').className).not.toContain(
      'hidden'
    );

    rerender(
      <DmLocationToolbar
        {...baseProps}
        mode="location"
        hasUnsyncedChanges
        lastSyncedAt={new Date().toISOString()}
      />
    );
    expect(screen.getByText('Unsynced · just now')).toBeInTheDocument();
    expect(screen.getByText('Unsynced · just now').className).not.toContain(
      'hidden'
    );

    rerender(<DmLocationToolbar {...baseProps} mode="location" />);
    const notYet = screen.getByText('Not synced yet');
    expect(notYet).toBeInTheDocument();
    expect(notYet.className).not.toContain('hidden');
  });

  it('uses sentence-case action labels with the right variants', () => {
    const { rerender } = render(
      <DmLocationToolbar
        {...baseProps}
        mode="battlemap"
        onOpenTvDisplay={vi.fn()}
        onToggleShareWithPlayers={vi.fn()}
        sharedWithPlayers={false}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Open TV display' })
    ).toHaveAttribute('data-variant', 'secondary');
    const share = screen.getByRole('button', { name: 'Share with players' });
    expect(share).toHaveAttribute('data-variant', 'secondary');
    expect(share).not.toHaveAttribute('data-selected');

    rerender(
      <DmLocationToolbar
        {...baseProps}
        mode="battlemap"
        onOpenTvDisplay={vi.fn()}
        onToggleShareWithPlayers={vi.fn()}
        sharedWithPlayers
      />
    );
    const live = screen.getByRole('button', { name: 'Live for players' });
    expect(live).toHaveAttribute('data-variant', 'secondary');
    expect(live).toHaveAttribute('data-selected');

    rerender(<DmLocationToolbar {...baseProps} mode="location" />);
    expect(
      screen.getByRole('button', { name: 'Sync to players' })
    ).toHaveAttribute('data-variant', 'primary');
  });

  it('disables Sync to players while syncing', () => {
    render(<DmLocationToolbar {...baseProps} mode="location" syncing />);
    expect(
      screen.getByRole('button', { name: 'Sync to players' })
    ).toBeDisabled();
  });

  it('renders destructive Clear canvas as a danger icon button', () => {
    render(<DmLocationToolbar {...baseProps} />);
    expect(
      screen.getByRole('button', { name: 'Clear canvas' })
    ).toHaveAttribute('data-variant', 'danger');
  });

  it('the DM-only toggle shows its text and names the state', () => {
    const { rerender } = render(
      <DmLocationToolbar {...baseProps} selectedElementId="shape-1" isDmOnly />
    );
    let toggle = screen.getByTestId('dm-only-toggle');
    expect(toggle).toHaveTextContent('DM only');
    expect(toggle).toHaveAttribute(
      'aria-label',
      'DM only, hidden from players'
    );
    expect(toggle).toHaveAttribute('data-selected');

    rerender(
      <DmLocationToolbar
        {...baseProps}
        selectedElementId="shape-1"
        isDmOnly={false}
      />
    );
    toggle = screen.getByTestId('dm-only-toggle');
    expect(toggle).toHaveTextContent('Visible');
    expect(toggle).toHaveAttribute('aria-label', 'Visible to players');
  });
});

describe('DmLocationToolbar disabled-button tooltips', () => {
  it('shows the fog disabledReason when the disabled fog button is hovered', async () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        fogControls={{
          initialized: true,
          disabled: true,
          disabledReason: 'Finish arranging map images before editing fog.',
          operation: 'reveal',
          shape: 'brush',
          radius: 40,
          preview: false,
          diagnostic: null,
          pendingAction: null,
          requestActivate: vi.fn(),
          setOperation: vi.fn(),
          setShape: vi.fn(),
          setRadius: vi.fn(),
          setPreview: vi.fn(),
          requestAction: vi.fn(),
          confirmAction: vi.fn(),
          cancelAction: vi.fn(),
          reconcileBounds: vi.fn(),
          reportError: vi.fn(),
        }}
      />
    );
    const wrapper = screen.getByRole('button', { name: 'Fog of war' })
      .parentElement as HTMLElement;
    expect(wrapper).toHaveAttribute('tabindex', '0');
    await userEvent.setup().hover(wrapper);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Finish arranging map images before editing fog.'
    );
  });

  it('shows why Reveal all is unavailable when no elements are hidden', async () => {
    render(<DmLocationToolbar {...baseProps} hiddenElementCount={0} />);
    const button = screen.getByRole('button', { name: 'Reveal all (0)' });
    await userEvent.setup().hover(button.parentElement as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'No hidden elements to reveal'
    );
  });

  it('adds no extra tab stop while the button is enabled', () => {
    render(<DmLocationToolbar {...baseProps} hiddenElementCount={2} />);
    const wrapper = screen.getByRole('button', { name: 'Reveal all (2)' })
      .parentElement as HTMLElement;
    expect(wrapper).not.toHaveAttribute('tabindex');
  });

  it('gives disabled Undo and Redo no tab stop — their hint only repeats the name', () => {
    render(<DmLocationToolbar {...baseProps} />);
    for (const name of ['Undo', 'Redo']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button.parentElement).not.toHaveAttribute('tabindex');
    }
  });

  it('keeps a tab stop on disabled Add map, whose hint explains the state', () => {
    render(
      <DmLocationToolbar
        {...baseProps}
        onPickMapImage={vi.fn()}
        arrangeMapsActive
      />
    );
    const button = screen.getByRole('button', { name: 'Add map' });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute('tabindex', '0');
  });
});

describe('mapToolDefs', () => {
  it('returns defs in the given order with the shared labels', () => {
    expect(mapToolDefs(['ping', 'hand']).map(d => d.label)).toEqual([
      'Ping',
      'Pan',
    ]);
  });

  it('throws on a tool name with no MAP_TOOL_META entry', () => {
    expect(() => mapToolDefs(['token'])).toThrow(/token/);
  });
});
