import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

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

let mockActiveTool = 'pencil';
let mockToolOptions: Record<string, Record<string, unknown> | undefined> = {};
const setOptionsSpies: Record<string, ReturnType<typeof vi.fn>> = {};
let mockSelectedCount = 1;

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

    fireEvent.click(screen.getByTitle('#ef4444'));
    expect(setOptionsSpies['pencil']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('shows laser colors in battle-map mode and updates the laser tool', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByTitle('#ef4444'));
    expect(setOptionsSpies['laser']).toHaveBeenCalledWith({
      color: '#ef4444',
    });
  });

  it('does not show laser options outside battle-map mode', () => {
    mockActiveTool = 'laser';
    mockToolOptions = { laser: { color: '#F4C430', width: 3 } };
    const { container } = render(<DmLocationToolOptions mode="location" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no pencil tool is registered (location editor)', () => {
    mockToolOptions = { pencil: undefined };
    const { container } = render(<DmLocationToolOptions mode="location" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows ping colors in battle-map mode and updates the ping tool', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    render(<DmLocationToolOptions mode="battlemap" />);

    fireEvent.click(screen.getByTitle('#3b82f6'));
    expect(setOptionsSpies['ping']).toHaveBeenCalledWith({
      color: '#3b82f6',
    });
  });

  it('does not show ping options outside battle-map mode', () => {
    mockActiveTool = 'ping';
    mockToolOptions = { ping: { color: '#F4C430' } };
    const { container } = render(<DmLocationToolOptions mode="location" />);
    expect(container).toBeEmptyDOMElement();
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

    fireEvent.click(screen.getByTitle('#22c55e'));
    expect(setOptionsSpies['measure']).toHaveBeenCalledWith({
      color: '#22c55e',
    });
  });

  it('reflects measureOpts.color as the active color for the measure tool', () => {
    mockToolOptions = { measure: { color: '#3b82f6', feetPerCell: 5 } };
    render(<DmLocationToolOptions mode="battlemap" />);

    const swatch = screen.getByTitle('#3b82f6');
    expect(swatch.className).toContain('border-accent-blue-border');
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

  it('stays hidden when selectionControls is not passed, even with the select tool active', () => {
    const { container } = render(<DmLocationToolOptions mode="battlemap" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden for a non-select tool even with selectionControls set', () => {
    mockActiveTool = 'pencil';
    mockToolOptions = { pencil: undefined };
    const { container } = render(
      <DmLocationToolOptions mode="battlemap" selectionControls />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('regression: stays hidden with selectionControls + select tool active but zero selection (no empty bar strip)', () => {
    mockSelectedCount = 0;
    const { container } = render(
      <DmLocationToolOptions mode="battlemap" selectionControls />
    );
    expect(container).toBeEmptyDOMElement();
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
        name: `Marker colour: ${color}`,
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
      screen.getByRole('button', { name: 'Marker colour: emerald' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Marker colour: blue' })
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
      screen.getByRole('button', { name: 'Marker colour: purple' })
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
    expect(screen.queryByTitle('#ef4444')).not.toBeInTheDocument();
  });

  it('every marker picker control is at least a 44x44 touch target', () => {
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
      expect(button.className).toContain('min-h-[44px]');
      expect(button.className).toContain('min-w-[44px]');
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

  it('renders nothing at all — not an empty strip — when markerControls is undefined', () => {
    const { container } = render(<DmLocationToolOptions mode="battlemap" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the marker picker in location mode when markerControls is supplied', () => {
    render(
      <DmLocationToolOptions mode="location" markerControls={makeControls()} />
    );
    expect(screen.getByTestId('marker-tool-options')).toBeInTheDocument();
  });
});
