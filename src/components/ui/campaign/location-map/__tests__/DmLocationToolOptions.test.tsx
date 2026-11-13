import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';

import DmLocationToolOptions from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import type { MarkerToolControls } from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import { DM_LOCATION_TOOL_NAMES } from '@/components/ui/campaign/location-map/DmLocationToolbar';
import { DM_VTT_TOOL_NAMES } from '@/components/ui/campaign/dm-vtt/DmVttToolbar';
import { MARKER_TOOL_NAME } from '@/components/ui/campaign/location-map/DmMarkerTool';
import {
  MARKER_COLOR_KEYS,
  MARKER_KINDS,
} from '@/components/ui/campaign/location-map/markerData';
import { MARKER_COLOR_CSS } from '@/components/ui/campaign/location-map/markerPainter';
import type {
  DmFogControls,
  FogPresetControls,
} from '@/components/ui/campaign/location-map/fog';

let mockActiveTool = 'pencil';
let mockToolOptions: Record<string, Record<string, unknown> | undefined> = {};
const setOptionsSpies: Record<string, ReturnType<typeof vi.fn>> = {};
let mockSelectedCount = 1;

beforeEach(() => {
  // Radix Tooltip/Popover measure their trigger; jsdom has no ResizeObserver.
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
  vi.unstubAllGlobals();
});

/**
 * A name-only row: the tool's name cell and nothing interactive — no colour
 * strip, no separator, no stray control.
 */
function expectNameOnly(container: HTMLElement, name: string) {
  expect(container.textContent).toBe(name);
  expect(
    container.querySelectorAll('button, input, [role="switch"]').length
  ).toBe(0);
}

const COLOR_SWATCH_COUNT = 9;

const MARKER_KIND_TEXT: Record<(typeof MARKER_KINDS)[number], string> = {
  door: 'Door',
  trap: 'Trap',
  loot: 'Loot',
  npc: 'NPC',
  secret: 'Secret',
  note: 'Note',
};

vi.mock('@fieldnotes/react', () => ({
  useActiveTool: () => [mockActiveTool, vi.fn()] as const,
  // The two toolbars are imported here only for their exported tool-name
  // lists (so the marker-picker gating test iterates the real lists rather
  // than a retyped copy); `useHistory` is what DmLocationToolbar itself
  // needs at module scope.
  useHistory: () => ({
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  }),
  useToolOptions: (name: string) => {
    setOptionsSpies[name] ??= vi.fn();
    return [mockToolOptions[name], setOptionsSpies[name]] as const;
  },
  useViewport: () => ({ removeElements: vi.fn() }),
  useSelectionOps: () => ({
    selectedIds: ['el-1'],
    selectedCount: mockSelectedCount,
    canGroup: false,
    canUngroup: false,
    canAlign: false,
    canDistribute: false,
    isLocked: null,
    group: vi.fn(),
    ungroup: vi.fn(),
    toggleLock: vi.fn(),
    align: vi.fn(),
    distribute: vi.fn(),
    rotateCW: vi.fn(),
    rotateCCW: vi.fn(),
  }),
  useSelectionStyleDetails: () =>
    [
      {
        common: { color: '#ef4444' },
        applicable: ['color'],
        mixed: [],
      },
      vi.fn(),
    ] as const,
}));

describe('DmLocationToolOptions pencil options', () => {
  beforeEach(() => {
    mockActiveTool = 'pencil';
    mockToolOptions = { pencil: { color: '#F4C430', width: 2.6 } };
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('shows a width slider bound to the pencil tool', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('2.6');
    fireEvent.change(slider, { target: { value: '6' } });
    expect(setOptionsSpies['pencil']).toHaveBeenCalledWith({ width: 6 });
  });

  it('routes color swatches to the pencil tool', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(setOptionsSpies['pencil']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('shows laser colors in battle-map mode and updates the laser tool', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(setOptionsSpies['laser']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('does not show laser options outside battle-map mode', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    const { container } = render(<DmLocationToolOptions mode="location" />);

    expectNameOnly(container, 'Laser pointer');
  });

  it('shows the name alone when no pencil tool is registered (location editor)', () => {
    mockToolOptions = { pencil: undefined };
    const { container } = render(<DmLocationToolOptions mode="location" />);
    expectNameOnly(container, 'Draw');
  });

  it('shows ping colors in battle-map mode and updates the ping tool', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(setOptionsSpies['ping']).toHaveBeenCalledWith({
      color: '#3b82f6',
    });
  });

  it('does not show ping options outside battle-map mode', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    const { container } = render(<DmLocationToolOptions mode="location" />);
    expectNameOnly(container, 'Ping');
  });

  it('shows laser colors in location mode once live sync is configured', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    render(<DmLocationToolOptions mode="location" liveSyncConfigured />);

    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(setOptionsSpies['laser']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('shows ping colors in location mode once live sync is configured', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    render(<DmLocationToolOptions mode="location" liveSyncConfigured />);

    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(setOptionsSpies['ping']).toHaveBeenCalledWith({
      color: '#3b82f6',
    });
  });

  it('never shows measure options in location mode, even with live sync', () => {
    mockActiveTool = 'measure';
    mockToolOptions = { measure: { color: '#FF5722', feetPerCell: 5 } };
    const { container } = render(
      <DmLocationToolOptions mode="location" liveSyncConfigured />
    );
    expectNameOnly(container, 'Measure');
  });
});

describe('DmLocationToolOptions fog appearance', () => {
  const fogControls: DmFogControls = {
    initialized: true,
    disabled: false,
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
  };

  beforeEach(() => {
    mockActiveTool = 'fog';
  });

  afterEach(() => cleanup());

  function makeFogPresetControls(
    overrides: Partial<FogPresetControls> = {}
  ): FogPresetControls {
    return {
      library: [],
      applied: 'solid',
      selectedValue: 'solid',
      appliedLabel: null,
      select: vi.fn(),
      editor: null,
      openEditor: vi.fn(),
      updateDraft: vi.fn(),
      setDraftKind: vi.fn(),
      randomizeSeed: vi.fn(),
      resetDraft: vi.fn(),
      cancelEditor: vi.fn(),
      applyDraft: vi.fn(),
      saveDraftAsPreset: vi.fn(() => null),
      updateSourcePreset: vi.fn(() => null),
      managerOpen: false,
      openManager: vi.fn(),
      closeManager: vi.fn(),
      renamePreset: vi.fn(() => null),
      duplicatePreset: vi.fn(() => null),
      managerError: null,
      setManagerError: vi.fn(),
      pendingDeleteId: null,
      requestDelete: vi.fn(),
      confirmDelete: vi.fn(),
      cancelDelete: vi.fn(),
      ...overrides,
    };
  }

  it('renders the preset panel whenever fogPresetControls is provided', () => {
    render(
      <DmLocationToolOptions
        mode="battlemap"
        fogControls={fogControls}
        fogPresetControls={makeFogPresetControls()}
      />
    );

    expect(
      screen.getByRole('combobox', { name: 'Fog appearance' })
    ).toBeInTheDocument();
  });

  it('renders the fog bar with no appearance control when fogPresetControls is omitted', () => {
    render(
      <DmLocationToolOptions mode="battlemap" fogControls={fogControls} />
    );

    expect(
      screen.queryByRole('combobox', { name: 'Fog appearance' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cover all' })
    ).toBeInTheDocument();
  });
});

describe('DmLocationToolOptions measure sharing control', () => {
  beforeEach(() => {
    mockActiveTool = 'measure';
    mockToolOptions = { measure: { color: '#FF5722', feetPerCell: 5 } };
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('renders no share control when measureSharing is not provided', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    expect(screen.queryByLabelText(/share with players/i)).toBeNull();
  });

  it('renders the share toggle unchecked by default state and fires onChange', () => {
    const onChange = vi.fn();
    render(
      <DmLocationToolOptions
        mode="battlemap"
        measureSharing={{ enabled: false, onChange }}
      />
    );

    const toggle = screen.getByLabelText(/share with players/i);
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects enabled sharing state', () => {
    const onChange = vi.fn();
    render(
      <DmLocationToolOptions
        mode="battlemap"
        measureSharing={{ enabled: true, onChange }}
      />
    );

    const toggle = screen.getByLabelText(/share with players/i);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('sets measureOpts.color when a swatch is clicked', () => {
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByRole('button', { name: 'Green' }));
    expect(setOptionsSpies['measure']).toHaveBeenCalledWith({
      color: '#22c55e',
    });
  });

  it('reflects measureOpts.color as the active color for the measure tool', () => {
    mockToolOptions = { measure: { color: '#3b82f6', feetPerCell: 5 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    expect(screen.getByRole('button', { name: 'Blue' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

describe('DmLocationToolOptions movement sharing control', () => {
  beforeEach(() => {
    mockActiveTool = 'path';
    mockToolOptions = { path: { diagonalRule: 'chebyshev' } };
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('renders no movement share switch when movementControls has no sharing (the player mount shape)', () => {
    render(
      <DmLocationToolOptions
        mode="battlemap"
        movementControls={{ dash: { enabled: false, onChange: vi.fn() } }}
      />
    );

    expect(
      screen.queryByLabelText('Share movement with players')
    ).not.toBeInTheDocument();
  });

  it('renders the movement share switch when movementControls.sharing is provided (the DM mount shape)', () => {
    const onChange = vi.fn();
    render(
      <DmLocationToolOptions
        mode="battlemap"
        movementControls={{
          dash: { enabled: false, onChange: vi.fn() },
          sharing: { enabled: false, onChange },
        }}
      />
    );

    const toggle = screen.getByLabelText('Share movement with players');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('DmLocationToolOptions selection branch reachability', () => {
  beforeEach(() => {
    mockActiveTool = 'select';
    mockToolOptions = {};
    mockSelectedCount = 1;
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('renders the selection options bar when selectionControls is set and the select tool is active', () => {
    render(<DmLocationToolOptions mode="battlemap" selectionControls />);
    expect(
      screen.getByRole('group', { name: 'Selection options' })
    ).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('shows only the name when selectionControls is not passed, even with the select tool active', () => {
    const { container } = render(<DmLocationToolOptions mode="battlemap" />);
    expectNameOnly(container, 'Select');
  });

  it('shows no selection options for a non-select tool even with selectionControls set', () => {
    mockActiveTool = 'pencil';
    mockToolOptions = { pencil: undefined };
    const { container } = render(
      <DmLocationToolOptions mode="battlemap" selectionControls />
    );
    expectNameOnly(container, 'Draw');
  });

  it('regression: shows only the name with selectionControls + select tool active but zero selection (no empty controls)', () => {
    mockSelectedCount = 0;
    const { container } = render(
      <DmLocationToolOptions mode="battlemap" selectionControls />
    );
    expectNameOnly(container, 'Select');
  });

  it('renders no shared colour strip beside the selection options', () => {
    render(<DmLocationToolOptions mode="battlemap" selectionControls />);
    expect(screen.queryByRole('button', { name: 'Slate' })).toBeNull();
  });
});

describe('DmLocationToolOptions marker kind + colour picker', () => {
  function makeControls(
    overrides: Partial<MarkerToolControls> = {}
  ): MarkerToolControls {
    return {
      kind: 'door',
      color: 'blue',
      onKindChange: vi.fn(),
      onColorChange: vi.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockActiveTool = MARKER_TOOL_NAME;
    mockToolOptions = {};
    mockSelectedCount = 0;
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it('renders a kind button per MARKER_KINDS and a swatch per MARKER_COLOR_KEYS for the marker tool', () => {
    render(
      <DmLocationToolOptions mode="battlemap" markerControls={makeControls()} />
    );

    const picker = screen.getByTestId('marker-tool-options');
    expect(picker).toBeInTheDocument();
    for (const kind of MARKER_KINDS) {
      expect(
        screen.getByRole('button', { name: `Marker kind: ${kind}` })
      ).toBeInTheDocument();
    }
    for (const color of MARKER_COLOR_KEYS) {
      const swatch = screen.getByRole('button', {
        name: `Marker color: ${color}`,
      });
      // The fill is the literal hex the CANVAS paints, not a theme token —
      // asserting it here is what stops the picker and the painter drifting.
      const dot = swatch.querySelector('[data-testid="marker-swatch-fill"]');
      expect(dot).toHaveStyle({ backgroundColor: MARKER_COLOR_CSS[color] });
    }
  });

  it('marks the selected kind and colour with aria-pressed, and only those', () => {
    render(
      <DmLocationToolOptions
        mode="battlemap"
        markerControls={makeControls({ kind: 'trap', color: 'emerald' })}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Marker kind: trap' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Marker kind: door' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: 'Marker color: emerald' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Marker color: blue' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('routes kind and colour clicks to the surface-owned callbacks', () => {
    const onKindChange = vi.fn();
    const onColorChange = vi.fn();
    render(
      <DmLocationToolOptions
        mode="battlemap"
        markerControls={makeControls({ onKindChange, onColorChange })}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Marker kind: secret' })
    );
    expect(onKindChange).toHaveBeenCalledWith('secret');

    fireEvent.click(
      screen.getByRole('button', { name: 'Marker color: purple' })
    );
    // A palette KEY, never a CSS colour string — mixing the two is how an
    // unresolvable fillStyle reaches the painter.
    expect(onColorChange).toHaveBeenCalledWith('purple');
    expect(onColorChange).not.toHaveBeenCalledWith(MARKER_COLOR_CSS.purple);
  });

  it('does not fold the marker colour into the shared CSS-colour swatch strip', () => {
    render(
      <DmLocationToolOptions mode="battlemap" markerControls={makeControls()} />
    );
    // The generic strip carries CSS colour strings for the SDK tools; it must
    // not render alongside the marker picker, or clicking it would silently
    // do nothing (handleColorChange has no 'marker' branch by design).
    expect(screen.queryByRole('button', { name: 'Red' })).toBeNull();
  });

  it('every marker picker control is the Button primitive (which carries the coarse-pointer size)', () => {
    render(
      <DmLocationToolOptions mode="battlemap" markerControls={makeControls()} />
    );

    const buttons = Array.from(
      screen.getByTestId('marker-tool-options').querySelectorAll('button')
    );
    // Guard first: a zero-iteration loop below would otherwise pass vacuously.
    expect(buttons.length).toBe(MARKER_KINDS.length + MARKER_COLOR_KEYS.length);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveAttribute('data-variant');
    }
  });

  it('renders the marker picker for the marker tool, even amid every other tool option', () => {
    mockActiveTool = MARKER_TOOL_NAME;
    mockToolOptions = {
      pencil: { color: '#F4C430', width: 2.6 },
      laser: { color: '#F4C430', width: 3 },
      ping: { color: '#F4C430' },
      measure: { color: '#FF5722', feetPerCell: 5 },
      template: { templateShape: 'circle', feetPerCell: 5 },
    };
    render(
      <DmLocationToolOptions mode="battlemap" markerControls={makeControls()} />
    );

    // Positive control for the loop below: proves the query CAN find the
    // picker at all, so the loop's negative assertions are discriminating
    // rather than vacuously true.
    expect(screen.getByTestId('marker-tool-options')).toBeInTheDocument();
  });

  it.each(
    [...new Set([...DM_LOCATION_TOOL_NAMES, ...DM_VTT_TOOL_NAMES])].filter(
      toolName => toolName !== MARKER_TOOL_NAME
    )
  )(
    'does not render the marker picker for the %s tool, even with markerControls supplied',
    toolName => {
      mockActiveTool = toolName;
      // Give every SDK tool its options so a branch that WOULD render its own
      // strip does render — this test is about the marker picker's absence,
      // not about the bar being empty.
      mockToolOptions = {
        pencil: { color: '#F4C430', width: 2.6 },
        laser: { color: '#F4C430', width: 3 },
        ping: { color: '#F4C430' },
        measure: { color: '#FF5722', feetPerCell: 5 },
        template: { templateShape: 'circle', feetPerCell: 5 },
      };
      render(
        <DmLocationToolOptions
          mode="battlemap"
          markerControls={makeControls()}
        />
      );

      expect(
        screen.queryByTestId('marker-tool-options')
      ).not.toBeInTheDocument();
    }
  );

  it('shows only the name — no controls — when markerControls is undefined', () => {
    const { container } = render(<DmLocationToolOptions mode="battlemap" />);
    expectNameOnly(container, 'Marker');
  });

  it('labels the kind group "Kind" and the colours "Pin color"', () => {
    render(
      <DmLocationToolOptions mode="battlemap" markerControls={makeControls()} />
    );
    const picker = screen.getByTestId('marker-tool-options');
    expect(within(picker).getByText('Kind')).toBeInTheDocument();
    expect(within(picker).getByText('Pin color')).toBeInTheDocument();
    expect(
      within(picker).getByRole('group', { name: 'Marker kind' })
    ).toBeInTheDocument();
    expect(within(picker).getByText('NPC')).toBeInTheDocument();
  });

  it.each(MARKER_KINDS)(
    'the %s kind button keeps its e2e name and shows its sentence-case label',
    kind => {
      render(
        <DmLocationToolOptions
          mode="battlemap"
          markerControls={makeControls()}
        />
      );
      const button = screen.getByRole('button', {
        name: `Marker kind: ${kind}`,
      });
      expect(button).toHaveTextContent(MARKER_KIND_TEXT[kind]);
      expect(button).toHaveAttribute('data-variant', 'secondary');
    }
  );

  it('renders the marker picker in location mode when markerControls is supplied', () => {
    render(
      <DmLocationToolOptions mode="location" markerControls={makeControls()} />
    );
    expect(screen.getByTestId('marker-tool-options')).toBeInTheDocument();
  });
});

describe('DmLocationToolOptions named options row', () => {
  function makeFogControls(
    overrides: Partial<DmFogControls> = {}
  ): DmFogControls {
    return {
      initialized: true,
      disabled: false,
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
      ...overrides,
    };
  }

  beforeEach(() => {
    mockToolOptions = {};
    mockSelectedCount = 0;
    for (const key of Object.keys(setOptionsSpies)) delete setOptionsSpies[key];
  });

  afterEach(() => cleanup());

  it("shows the active tool's name first in the row", () => {
    mockActiveTool = 'pencil';
    mockToolOptions = { pencil: { color: '#ef4444', width: 2 } };
    const pencil = render(<DmLocationToolOptions mode="battlemap" />);
    expect(
      (pencil.container.firstChild as HTMLElement).firstElementChild
    ).toHaveTextContent(/^Draw$/);
    pencil.unmount();

    mockActiveTool = 'shape';
    mockToolOptions = { shape: { shape: 'rectangle', strokeColor: '#ef4444' } };
    const shape = render(<DmLocationToolOptions mode="battlemap" />);
    expect(
      (shape.container.firstChild as HTMLElement).firstElementChild
    ).toHaveTextContent(/^Shape$/);
    shape.unmount();

    mockActiveTool = 'fog';
    const fog = render(
      <DmLocationToolOptions mode="battlemap" fogControls={makeFogControls()} />
    );
    expect(
      (fog.container.firstChild as HTMLElement).firstElementChild
    ).toHaveTextContent(/^Fog of war$/);
  });

  it('shows the name alone for tools without options', () => {
    mockActiveTool = 'hand';
    const hand = render(<DmLocationToolOptions mode="battlemap" />);
    expectNameOnly(hand.container, 'Pan');
    expect(screen.queryByRole('button')).toBeNull();
    hand.unmount();

    mockActiveTool = 'eraser';
    const eraser = render(<DmLocationToolOptions mode="battlemap" />);
    expectNameOnly(eraser.container, 'Eraser');
    eraser.unmount();

    mockActiveTool = 'select';
    mockSelectedCount = 0;
    const select = render(
      <DmLocationToolOptions mode="battlemap" selectionControls />
    );
    expectNameOnly(select.container, 'Select');
    expect(screen.queryByRole('button', { name: 'Slate' })).toBeNull();
    select.unmount();

    mockActiveTool = MARKER_TOOL_NAME;
    const marker = render(<DmLocationToolOptions mode="battlemap" />);
    expectNameOnly(marker.container, 'Marker');
  });

  it('renders nothing for a tool with no MAP_TOOL_META entry and no options', () => {
    mockActiveTool = 'token';
    const { container } = render(<DmLocationToolOptions mode="battlemap" />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps a single fog options group', () => {
    mockActiveTool = 'fog';
    render(
      <DmLocationToolOptions mode="battlemap" fogControls={makeFogControls()} />
    );
    const groups = screen.getAllByRole('group', { name: 'Fog of war options' });
    expect(groups).toHaveLength(1);
    expect(
      within(groups[0]).getAllByRole('button', { name: 'Rectangle' })
    ).toHaveLength(1);
    expect(
      within(groups[0]).getByRole('button', { name: 'Disable fog' })
    ).toHaveAttribute('data-variant', 'danger');
    expect(
      within(groups[0]).getByRole('slider', { name: 'Fog brush size' })
    ).toHaveValue('40');
    expect(within(groups[0]).getByText('Brush size')).toBeInTheDocument();
    expect(within(groups[0]).getByText('40px')).toBeInTheDocument();
    expect(
      within(groups[0]).getByRole('switch', { name: 'Preview as player' })
    ).toBeInTheDocument();
  });

  it('names colour swatches and marks the active one', () => {
    mockActiveTool = 'measure';
    mockToolOptions = { measure: { color: '#3b82f6', feetPerCell: 5 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    for (const name of [
      'Slate',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Violet',
      'Pink',
      'White',
    ]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    }
    expect(screen.getByRole('button', { name: 'Blue' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      within(screen.getByRole('group', { name: 'Color' })).getAllByRole(
        'button'
      )
    ).toHaveLength(COLOR_SWATCH_COUNT);
    const custom = screen.getByLabelText('Custom color');
    expect(custom).toHaveAttribute('type', 'color');
    expect(custom).toHaveValue('#3b82f6');
    fireEvent.change(custom, { target: { value: '#123456' } });
    expect(setOptionsSpies['measure']).toHaveBeenCalledWith({
      color: '#123456',
    });
  });

  it('names the sticky note text colours, including Ink', () => {
    mockActiveTool = 'note';
    mockToolOptions = {
      note: { backgroundColor: '#eab308', textColor: '#1e293b' },
    };
    render(<DmLocationToolOptions mode="battlemap" />);

    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    const ink = screen.getByRole('button', { name: 'Ink' });
    expect(ink).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(screen.getByRole('group', { name: 'Background' })).getByRole(
        'button',
        { name: 'Yellow' }
      )
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Text' })).getByRole('button', {
        name: 'Violet',
      })
    );
    expect(setOptionsSpies['note']).toHaveBeenCalledWith({
      textColor: '#7c3aed',
    });
  });

  it('segmented choices are sentence-case outline buttons with aria-pressed', () => {
    mockActiveTool = 'shape';
    mockToolOptions = {
      shape: {
        shape: 'ellipse',
        strokeColor: '#ef4444',
        fillColor: 'transparent',
        strokeWidth: 4,
      },
    };
    const shape = render(<DmLocationToolOptions mode="battlemap" />);
    const shapeGroup = screen.getByRole('group', { name: 'Shape' });
    const rectangle = within(shapeGroup).getByRole('button', {
      name: 'Rectangle',
    });
    const ellipse = within(shapeGroup).getByRole('button', { name: 'Ellipse' });
    expect(rectangle).toHaveAttribute('data-variant', 'secondary');
    expect(rectangle).toHaveAttribute('aria-pressed', 'false');
    expect(ellipse).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(rectangle);
    expect(setOptionsSpies['shape']).toHaveBeenCalledWith({
      shape: 'rectangle',
    });
    expect(screen.getByText('Stroke')).toBeInTheDocument();
    expect(screen.getByText('Fill')).toBeInTheDocument();
    const none = screen.getByRole('button', { name: 'None' });
    expect(none).toHaveAttribute('aria-pressed', 'true');
    expect(none).toHaveAttribute('data-variant', 'secondary');
    expect(
      screen.getByRole('slider', { name: 'Shape stroke width' })
    ).toHaveValue('4');
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByText('4px')).toBeInTheDocument();
    shape.unmount();

    mockActiveTool = 'text';
    mockToolOptions = {
      text: { color: '#334155', fontSize: 16, textAlign: 'center' },
    };
    const text = render(<DmLocationToolOptions mode="battlemap" />);
    const align = screen.getByRole('group', { name: 'Text align' });
    expect(
      within(align)
        .getAllByRole('button')
        .map(b => b.textContent)
    ).toEqual(['Left', 'Center', 'Right']);
    expect(
      within(align).getByRole('button', { name: 'Center' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Align')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Text size' })).toHaveValue('16');
    expect(screen.getByText('16px')).toBeInTheDocument();
    text.unmount();

    mockActiveTool = 'template';
    mockToolOptions = {
      template: { templateShape: 'cone', renderStyle: 'geometric' },
    };
    const template = render(<DmLocationToolOptions mode="battlemap" />);
    const templateShape = screen.getByRole('group', { name: 'Template shape' });
    expect(
      within(templateShape)
        .getAllByRole('button')
        .map(b => b.textContent)
    ).toEqual(['Circle', 'Cone', 'Line', 'Square', 'Rectangle']);
    expect(
      within(templateShape).getByRole('button', { name: 'Cone' })
    ).toHaveAttribute('aria-pressed', 'true');
    const render_ = screen.getByRole('group', { name: 'Render style' });
    expect(
      within(render_).getByRole('button', { name: 'Smooth' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(render_).getByRole('button', { name: 'Cells' })
    ).not.toHaveAttribute('title');
    expect(screen.getByText('Render')).toBeInTheDocument();
    expect(screen.getByText('Shape')).toBeInTheDocument();
    template.unmount();

    mockActiveTool = 'fog';
    render(
      <DmLocationToolOptions
        mode="battlemap"
        fogControls={makeFogControls({
          operation: 'conceal',
          shape: 'polygon',
        })}
      />
    );
    const operation = screen.getByRole('group', { name: 'Fog operation' });
    expect(
      within(operation)
        .getAllByRole('button')
        .map(b => b.textContent)
    ).toEqual(['Reveal', 'Conceal']);
    expect(
      within(operation).getByRole('button', { name: 'Conceal' })
    ).toHaveAttribute('aria-pressed', 'true');
    const fogShape = screen.getByRole('group', { name: 'Fog shape' });
    expect(
      within(fogShape)
        .getAllByRole('button')
        .map(b => b.textContent)
    ).toEqual(['Brush', 'Rectangle', 'Polygon']);
    expect(
      within(fogShape).getByRole('button', { name: 'Polygon' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('template fill swatches keep the translucent value', () => {
    mockActiveTool = 'template';
    mockToolOptions = {
      template: { templateShape: 'circle', fillColor: '#3b82f680' },
    };
    render(<DmLocationToolOptions mode="battlemap" />);
    const fill = screen.getByRole('group', { name: 'Fill' });
    expect(within(fill).getByRole('button', { name: 'Blue' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(within(fill).getByRole('button', { name: 'Green' }));
    expect(setOptionsSpies['template']).toHaveBeenCalledWith({
      fillColor: '#22c55e80',
    });
    expect(screen.getByRole('slider', { name: 'Feet per cell' })).toHaveValue(
      '5'
    );
  });

  it('groups each colour strip under its visible label', () => {
    mockActiveTool = 'shape';
    mockToolOptions = {
      shape: {
        shape: 'rectangle',
        strokeColor: '#ef4444',
        fillColor: 'transparent',
      },
    };
    render(<DmLocationToolOptions mode="battlemap" />);

    const stroke = screen.getByRole('group', { name: 'Stroke' });
    const fill = screen.getByRole('group', { name: 'Fill' });
    expect(within(stroke).getAllByRole('button', { name: 'Red' })).toHaveLength(
      1
    );
    expect(within(fill).getAllByRole('button', { name: 'Red' })).toHaveLength(
      1
    );
    expect(within(stroke).getByLabelText('Custom color')).toBeInTheDocument();
    expect(within(fill).getByRole('button', { name: 'None' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('highlights the template outline colour', () => {
    mockActiveTool = 'template';
    mockToolOptions = {
      template: { templateShape: 'circle', strokeColor: '#ef4444' },
    };
    render(<DmLocationToolOptions mode="battlemap" />);

    const outline = screen.getByRole('group', { name: 'Outline' });
    expect(
      within(outline).getByRole('button', { name: 'Red' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(outline).getByRole('button', { name: 'Slate' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the fog tool while a fog confirm is pending under another tool', () => {
    mockActiveTool = 'hand';
    const { container } = render(
      <DmLocationToolOptions
        mode="battlemap"
        fogControls={makeFogControls({ pendingAction: 'enable' })}
      />
    );

    const nameCell = (container.firstChild as HTMLElement).firstElementChild;
    expect(nameCell).toHaveTextContent(/^Fog of war$/);
    expect(screen.queryByText('Pan')).toBeNull();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('diagonals are a segmented pair', () => {
    mockActiveTool = 'path';
    mockToolOptions = { path: { diagonalRule: 'chebyshev' } };
    render(<DmLocationToolOptions mode="battlemap" />);

    expect(screen.getByText('Diagonals')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Diagonal rule' });
    expect(
      within(group).getByRole('button', { name: '5-5-5' })
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: '5-10-5' }));
    expect(setOptionsSpies['path']).toHaveBeenCalledWith({
      diagonalRule: 'alternate',
    });
    expect(screen.queryByRole('combobox')).toBeNull();
    // A4: the Move tool has no colour, so no dead colour strip.
    expect(screen.queryByRole('button', { name: 'Slate' })).toBeNull();
  });

  it('feet per cell shows a labelled range with a unit', () => {
    mockActiveTool = 'measure';
    mockToolOptions = { measure: { color: '#FF5722', feetPerCell: 5 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    const slider = screen.getByRole('slider', { name: 'Feet per cell' });
    expect(slider).toHaveValue('5');
    expect(screen.getByText('5 ft')).toBeInTheDocument();
    expect(screen.getByText('Feet per cell')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '10' } });
    expect(setOptionsSpies['measure']).toHaveBeenCalledWith({
      feetPerCell: 10,
    });
  });

  it('pencil width is a labelled range', () => {
    mockActiveTool = 'pencil';
    mockToolOptions = { pencil: { color: '#ef4444', width: 3 } };
    render(<DmLocationToolOptions mode="battlemap" />);
    expect(screen.getByRole('slider', { name: 'Pencil width' })).toHaveValue(
      '3'
    );
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByText('3px')).toBeInTheDocument();
  });

  it('movement sharing switch is labelled by its visible text', () => {
    mockActiveTool = 'path';
    mockToolOptions = { path: { diagonalRule: 'chebyshev' } };
    render(
      <DmLocationToolOptions
        mode="battlemap"
        movementControls={{
          dash: { enabled: true, onChange: vi.fn() },
          sharing: { enabled: false, onChange: vi.fn() },
        }}
      />
    );

    expect(
      screen.getByRole('switch', { name: 'Share movement with players' })
    ).toBeInTheDocument();
    expect(screen.getByText('Share movement with players')).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Dash' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText('Dash')).toBeVisible();
  });
});
