'use client';

import type { ReactNode } from 'react';
import type { ShapeKind } from '@fieldnotes/core';
import type {
  ArrowToolOptions,
  LaserToolOptions,
  NoteToolOptions,
  PencilToolOptions,
  PingToolOptions,
  ShapeToolOptions,
  TextToolOptions,
} from '@fieldnotes/core';
import type {
  DiagonalRule,
  MeasureToolOptions,
  PathToolOptions,
  TemplateRenderStyle,
  TemplateShape,
  TemplateToolOptions,
} from '@fieldnotes/vtt';
import {
  useActiveTool,
  useSelectionOps,
  useToolOptions,
} from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import DmSelectionOptions from './DmSelectionOptions';
import { MARKER_TOOL_NAME } from './DmMarkerTool';
import { MAP_TOOL_META } from './mapToolDefs';
import {
  MARKER_COLOR_KEYS,
  MARKER_KIND_LABELS,
  MARKER_KINDS,
} from './markerData';
import { MARKER_KIND_ICONS } from './markerIcons';
import type { MarkerColorKey, MarkerKind } from './markerData';
import { MARKER_COLOR_CSS } from './markerPainter';
import type { EditorMode } from './DmLocationEditor.types';
import {
  CustomColorButton,
  OptionLabel,
  OptionSeparator,
  RangeField,
  SegmentedGroup,
  SwatchButton,
} from './ToolOptionControls';
import {
  FogPresetPanel,
  type DmFogControls,
  type FogPresetControls,
} from './fog';
import {
  FOG_COVER_ALL_DESCRIPTION,
  FOG_COVER_ALL_TITLE,
  FOG_DISABLE_DESCRIPTION,
  FOG_DISABLE_TITLE,
  FOG_ENABLE_CONFIRM,
  FOG_ENABLE_DESCRIPTION,
  FOG_ENABLE_TITLE,
  FOG_REVEAL_ALL_DESCRIPTION,
  FOG_REVEAL_ALL_TITLE,
  FOG_SECURITY_EXPLANATION,
} from './fog';

export const COLOR_SWATCHES = [
  '#334155',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
];

/** The name each `COLOR_SWATCHES` colour is read and hovered as. */
export const COLOR_SWATCH_NAMES: Readonly<Record<string, string>> = {
  '#334155': 'Slate',
  '#ef4444': 'Red',
  '#f97316': 'Orange',
  '#eab308': 'Yellow',
  '#22c55e': 'Green',
  '#3b82f6': 'Blue',
  '#8b5cf6': 'Violet',
  '#ec4899': 'Pink',
  '#ffffff': 'White',
};

/** Fills skip white. */
const FILL_SWATCHES = COLOR_SWATCHES.slice(0, 8);

const NOTE_TEXT_COLORS = [
  '#334155',
  '#1e293b',
  '#ef4444',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#ffffff',
];

const NOTE_TEXT_COLOR_NAMES: Readonly<Record<string, string>> = {
  '#334155': 'Slate',
  '#1e293b': 'Ink',
  '#ef4444': 'Red',
  '#16a34a': 'Green',
  '#2563eb': 'Blue',
  '#7c3aed': 'Violet',
  '#ffffff': 'White',
};

// The accessible names stay "Marker kind: {kind}" — the e2e clicks them.
const MARKER_KIND_OPTIONS = MARKER_KINDS.map(kind => ({
  value: kind,
  label: MARKER_KIND_LABELS[kind],
  icon: MARKER_KIND_ICONS[kind],
  ariaLabel: `Marker kind: ${kind}`,
}));

const SHAPE_OPTIONS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
] as const;

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const;

const TEMPLATE_SHAPE_OPTIONS: readonly {
  value: TemplateShape;
  label: string;
}[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'cone', label: 'Cone' },
  { value: 'line', label: 'Line' },
  { value: 'square', label: 'Square' },
  { value: 'rectangle', label: 'Rectangle' },
];

const TEMPLATE_RENDER_STYLES: readonly {
  value: TemplateRenderStyle;
  label: string;
}[] = [
  { value: 'cells', label: 'Cells' },
  { value: 'geometric', label: 'Smooth' },
];

const DIAGONAL_OPTIONS: readonly { value: DiagonalRule; label: string }[] = [
  { value: 'chebyshev', label: '5-5-5' },
  { value: 'alternate', label: '5-10-5' },
];

const FOG_OPERATION_OPTIONS = [
  { value: 'reveal', label: 'Reveal' },
  { value: 'conceal', label: 'Conceal' },
] as const;

const FOG_SHAPE_OPTIONS = [
  { value: 'brush', label: 'Brush' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'polygon', label: 'Polygon' },
] as const;

/** Exactly the tools `handleColorChange` routes a colour to. */
const COLOR_STRIP_TOOLS: ReadonlySet<string> = new Set([
  'shape',
  'text',
  'note',
  'arrow',
  'pencil',
  'template',
  'laser',
  'ping',
  'measure',
]);

const formatPx = (value: number) => `${value}px`;
const formatFeet = (value: number) => `${value} ft`;

export interface MeasureSharingControl {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export interface MovementControls {
  sharing?: MeasureSharingControl; // DM surfaces only
  dash: { enabled: boolean; onChange: (enabled: boolean) => void };
}

/**
 * Marker kind + colour, owned by each DM surface's hook and mirrored into the
 * refs `DmMarkerTool` reads at placement time. `DmMarkerTool` is not an SDK
 * tool, so `useToolOptions('marker')` cannot reach it — see its class comment.
 */
export interface MarkerToolControls {
  kind: MarkerKind;
  color: MarkerColorKey;
  onKindChange(kind: MarkerKind): void;
  onColorChange(color: MarkerColorKey): void;
}

interface DmLocationToolOptionsProps {
  mode?: EditorMode;
  measureSharing?: MeasureSharingControl;
  /** Enables the select-tool editing branch (style + arrange controls for the current selection). */
  selectionControls?: boolean;
  /** Enables the marker kind + colour branch (both modes). */
  markerControls?: MarkerToolControls;
  /** Enables the movement (path) tool's diagonal rule / dash / sharing branch. */
  movementControls?: MovementControls;
  /** Shared DM fog controller. Omitted on player and non-battle-map surfaces. */
  fogControls?: DmFogControls;
  /** Fog preset selector/editor/manager. Omitted on surfaces without a viewport. */
  fogPresetControls?: FogPresetControls;
  /** Location mode only: the relay is configured, so the laser/ping tools
   *  exist and their colour rows must render. */
  liveSyncConfigured?: boolean;
}

/**
 * The options row under a map toolbar: the active tool's icon and name, then
 * that tool's options. A tool with a name but no options shows the name alone;
 * a tool with neither (the player's `token`) renders nothing.
 */
export default function DmLocationToolOptions({
  mode = 'location',
  measureSharing,
  selectionControls,
  markerControls,
  movementControls,
  fogControls,
  fogPresetControls,
  liveSyncConfigured = false,
}: DmLocationToolOptionsProps) {
  const [activeTool] = useActiveTool();
  // Read unconditionally (both DM surfaces render this component inside
  // ViewportContext.Provider) so the select branch's `hasOptions` gate
  // below can require a non-empty selection — otherwise activating the
  // select tool with nothing selected would show controls for nothing.
  const { selectedCount } = useSelectionOps();
  const [pencilOpts, setPencilOpts] = useToolOptions<
    PencilToolOptions & Record<string, unknown>
  >('pencil');
  const [arrowOpts, setArrowOpts] = useToolOptions<
    ArrowToolOptions & Record<string, unknown>
  >('arrow');
  const [noteOpts, setNoteOpts] = useToolOptions<
    NoteToolOptions & Record<string, unknown>
  >('note');
  const [textOpts, setTextOpts] = useToolOptions<
    TextToolOptions & Record<string, unknown>
  >('text');
  const [shapeOpts, setShapeOpts] = useToolOptions<
    ShapeToolOptions & Record<string, unknown>
  >('shape');
  const [measureOpts, setMeasureOpts] = useToolOptions<
    MeasureToolOptions & Record<string, unknown>
  >('measure');
  const [pathOpts, setPathOpts] = useToolOptions<
    PathToolOptions & Record<string, unknown>
  >('path');
  const [templateOpts, setTemplateOpts] = useToolOptions<
    TemplateToolOptions & Record<string, unknown>
  >('template');
  const [laserOpts, setLaserOpts] = useToolOptions<
    LaserToolOptions & Record<string, unknown>
  >('laser');
  const [pingOpts, setPingOpts] = useToolOptions<
    PingToolOptions & Record<string, unknown>
  >('ping');

  // A pending fog confirm takes the whole row under whichever tool is active:
  // the row is named for the fog tool and shows only the confirm, so every
  // other branch below is gated on `!showFogOptions`.
  const showFogOptions =
    fogControls !== undefined &&
    (activeTool === 'fog' || fogControls.pendingAction !== null);

  // Single source of truth for whether the select-tool branch renders — used
  // both to decide if the row has options at all and, below, to gate the
  // branch itself, so the two conditions can't drift apart.
  const showSelectionOptions =
    !showFogOptions &&
    selectionControls === true &&
    activeTool === 'select' &&
    selectedCount > 0;

  // Requiring the prop is what keeps the row honest: without it a surface
  // that activates the marker tool but wires no controls would show a picker
  // that does nothing. Same defensive shape as `pencilOpts !== undefined` and
  // `selectedCount > 0` above.
  const showMarkerOptions =
    !showFogOptions &&
    activeTool === MARKER_TOOL_NAME &&
    markerControls !== undefined;

  // Mirrors DmLocationToolbar's PRESENCE_TOOL_DEFS gate.
  const presenceToolsEnabled = mode === 'battlemap' || liveSyncConfigured;

  const hasOptions =
    showSelectionOptions ||
    showMarkerOptions ||
    showFogOptions ||
    (activeTool === 'pencil' && pencilOpts !== undefined) ||
    activeTool === 'arrow' ||
    activeTool === 'note' ||
    activeTool === 'text' ||
    activeTool === 'shape' ||
    (presenceToolsEnabled &&
      ((activeTool === 'laser' && laserOpts !== undefined) ||
        (activeTool === 'ping' && pingOpts !== undefined))) ||
    (mode === 'battlemap' &&
      (activeTool === 'measure' ||
        activeTool === 'path' ||
        activeTool === 'template'));

  const meta = showFogOptions ? MAP_TOOL_META.fog : MAP_TOOL_META[activeTool];
  if (!hasOptions && !meta) return null;

  // The shared strip carries CSS colour STRINGS for the SDK tools listed in
  // COLOR_STRIP_TOOLS. The marker carries a palette KEY, so its picker owns
  // colour entirely; Select and Move have no colour to set at all.
  const showColorStrip =
    hasOptions && !showFogOptions && COLOR_STRIP_TOOLS.has(activeTool);

  const shapeKind = (shapeOpts?.shape ?? 'rectangle') as ShapeKind;

  const activeColor =
    activeTool === 'shape'
      ? shapeOpts?.strokeColor
      : activeTool === 'text'
        ? textOpts?.color
        : activeTool === 'note'
          ? noteOpts?.backgroundColor
          : activeTool === 'laser'
            ? laserOpts?.color
            : activeTool === 'ping'
              ? pingOpts?.color
              : activeTool === 'arrow'
                ? arrowOpts?.color
                : activeTool === 'pencil'
                  ? pencilOpts?.color
                  : activeTool === 'measure'
                    ? measureOpts?.color
                    : activeTool === 'template'
                      ? templateOpts?.strokeColor
                      : '#334155';

  const colorStripLabel =
    activeTool === 'shape'
      ? 'Stroke'
      : activeTool === 'note'
        ? 'Background'
        : activeTool === 'template'
          ? 'Outline'
          : 'Color';

  const handleColorChange = (color: string) => {
    if (activeTool === 'shape') setShapeOpts({ strokeColor: color });
    else if (activeTool === 'text') setTextOpts({ color });
    else if (activeTool === 'note') setNoteOpts({ backgroundColor: color });
    else if (activeTool === 'arrow') setArrowOpts({ color });
    else if (activeTool === 'pencil') setPencilOpts({ color });
    else if (activeTool === 'template') setTemplateOpts({ strokeColor: color });
    else if (activeTool === 'laser') setLaserOpts({ color });
    else if (activeTool === 'ping') setPingOpts({ color });
    else if (activeTool === 'measure') setMeasureOpts({ color });
  };

  return (
    <TooltipProvider>
      <div className="bg-surface-secondary border-divider flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-1.5">
        {meta && (
          <>
            <span className="type-ui text-heading flex min-h-9 items-center gap-1.5 pointer-coarse:min-h-11">
              <meta.Icon size={16} aria-hidden="true" />
              {meta.label}
            </span>
            {hasOptions && <OptionSeparator />}
          </>
        )}

        {hasOptions && (
          <>
            {showSelectionOptions && <DmSelectionOptions />}

            {!showFogOptions && activeTool === 'shape' && shapeOpts && (
              <SegmentedGroup
                label="Shape"
                options={SHAPE_OPTIONS}
                value={shapeKind}
                onChange={value => setShapeOpts({ shape: value })}
              />
            )}

            {showMarkerOptions && markerControls && (
              <MarkerOptions controls={markerControls} />
            )}

            {showFogOptions && fogControls && (
              <FogOptions
                controls={fogControls}
                presetControls={fogPresetControls}
              />
            )}

            {showColorStrip && (
              <>
                <OptionLabel>{colorStripLabel}</OptionLabel>
                <SwatchStrip
                  label={colorStripLabel}
                  colors={COLOR_SWATCHES}
                  names={COLOR_SWATCH_NAMES}
                  isSelected={color => activeColor === color}
                  onSelect={handleColorChange}
                >
                  <CustomColorButton
                    value={activeColor ?? '#334155'}
                    onChange={handleColorChange}
                  />
                </SwatchStrip>
              </>
            )}

            {!showFogOptions && activeTool === 'pencil' && pencilOpts && (
              <>
                <OptionLabel>Width</OptionLabel>
                <RangeField
                  ariaLabel="Pencil width"
                  min={1}
                  max={12}
                  step={0.5}
                  value={pencilOpts.width ?? 2}
                  onChange={width => setPencilOpts({ width })}
                  format={formatPx}
                />
              </>
            )}

            {!showFogOptions && activeTool === 'note' && noteOpts && (
              <>
                <OptionLabel>Text</OptionLabel>
                <SwatchStrip
                  label="Text"
                  colors={NOTE_TEXT_COLORS}
                  names={NOTE_TEXT_COLOR_NAMES}
                  isSelected={color => noteOpts.textColor === color}
                  onSelect={color => setNoteOpts({ textColor: color })}
                />
              </>
            )}

            {!showFogOptions && activeTool === 'shape' && shapeOpts && (
              <>
                <OptionLabel>Fill</OptionLabel>
                <SwatchStrip
                  label="Fill"
                  colors={FILL_SWATCHES}
                  names={COLOR_SWATCH_NAMES}
                  isSelected={color => shapeOpts.fillColor === color}
                  onSelect={color => setShapeOpts({ fillColor: color })}
                  leading={
                    <Button
                      variant="secondary"
                      size="xs"
                      selected={shapeOpts.fillColor === 'transparent'}
                      aria-pressed={shapeOpts.fillColor === 'transparent'}
                      onClick={() => setShapeOpts({ fillColor: 'transparent' })}
                    >
                      None
                    </Button>
                  }
                />
                <OptionLabel>Width</OptionLabel>
                <RangeField
                  ariaLabel="Shape stroke width"
                  min={1}
                  max={10}
                  value={shapeOpts.strokeWidth ?? 2}
                  onChange={strokeWidth => setShapeOpts({ strokeWidth })}
                  format={formatPx}
                />
              </>
            )}

            {!showFogOptions && activeTool === 'text' && textOpts && (
              <>
                <OptionLabel>Size</OptionLabel>
                <RangeField
                  ariaLabel="Text size"
                  min={10}
                  max={72}
                  value={textOpts.fontSize ?? 16}
                  onChange={fontSize => setTextOpts({ fontSize })}
                  format={formatPx}
                />
                <OptionLabel>Align</OptionLabel>
                <SegmentedGroup
                  label="Text align"
                  options={TEXT_ALIGN_OPTIONS}
                  value={textOpts.textAlign}
                  onChange={textAlign => setTextOpts({ textAlign })}
                />
              </>
            )}

            {!showFogOptions &&
              mode === 'battlemap' &&
              activeTool === 'measure' &&
              measureOpts && (
                <>
                  <OptionLabel>Feet per cell</OptionLabel>
                  <RangeField
                    ariaLabel="Feet per cell"
                    min={1}
                    max={20}
                    value={measureOpts.feetPerCell ?? 5}
                    onChange={feetPerCell => setMeasureOpts({ feetPerCell })}
                    format={formatFeet}
                  />
                  {measureSharing && (
                    <Switch
                      checked={measureSharing.enabled}
                      onCheckedChange={measureSharing.onChange}
                      label="Share with players"
                      wrapperClassName="items-center"
                    />
                  )}
                </>
              )}

            {!showFogOptions &&
              mode === 'battlemap' &&
              activeTool === 'path' && (
                <>
                  <OptionLabel>Diagonals</OptionLabel>
                  <SegmentedGroup
                    label="Diagonal rule"
                    options={DIAGONAL_OPTIONS}
                    value={pathOpts?.diagonalRule ?? 'chebyshev'}
                    onChange={diagonalRule => setPathOpts({ diagonalRule })}
                  />
                  {movementControls && (
                    <Switch
                      checked={movementControls.dash.enabled}
                      onCheckedChange={movementControls.dash.onChange}
                      label="Dash"
                      wrapperClassName="items-center"
                    />
                  )}
                  {movementControls?.sharing && (
                    <Switch
                      checked={movementControls.sharing.enabled}
                      onCheckedChange={movementControls.sharing.onChange}
                      label="Share movement with players"
                      wrapperClassName="items-center"
                    />
                  )}
                </>
              )}

            {!showFogOptions &&
              mode === 'battlemap' &&
              activeTool === 'template' &&
              templateOpts && (
                <TemplateOptions
                  options={templateOpts}
                  setOptions={setTemplateOpts}
                />
              )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

interface SwatchStripProps {
  /** The group's accessible name: the same word as the visible label. */
  label: string;
  colors: readonly string[];
  names: Readonly<Record<string, string>>;
  isSelected: (color: string) => boolean;
  onSelect: (color: string) => void;
  /** A control before the swatches (the shape fill's "None"). */
  leading?: ReactNode;
  /** Trailing controls in the strip (the custom colour picker). */
  children?: ReactNode;
}

function SwatchStrip({
  label,
  colors,
  names,
  isSelected,
  onSelect,
  leading,
  children,
}: SwatchStripProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center"
    >
      {leading}
      {colors.map(color => (
        <SwatchButton
          key={color}
          color={color}
          name={names[color] ?? color}
          selected={isSelected(color)}
          onSelect={() => onSelect(color)}
        />
      ))}
      {children}
    </div>
  );
}

function MarkerOptions({ controls }: { controls: MarkerToolControls }) {
  return (
    <div
      data-testid="marker-tool-options"
      role="group"
      aria-label="Marker options"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
    >
      <OptionLabel>Kind</OptionLabel>
      <SegmentedGroup
        label="Marker kind"
        options={MARKER_KIND_OPTIONS}
        value={controls.kind}
        onChange={controls.onKindChange}
      />
      <OptionLabel>Pin color</OptionLabel>
      <div className="flex flex-wrap items-center">
        {MARKER_COLOR_KEYS.map(colorKey => (
          <SwatchButton
            key={colorKey}
            // A literal hex from the painter's palette, deliberately not a
            // semantic token: this is the colour the CANVAS paints, where
            // `var(--…)` does not resolve. Data, not theming.
            color={MARKER_COLOR_CSS[colorKey]}
            name={`Marker color: ${colorKey}`}
            selected={controls.color === colorKey}
            onSelect={() => controls.onColorChange(colorKey)}
            dotTestId="marker-swatch-fill"
          />
        ))}
      </div>
    </div>
  );
}

function fogPendingTitle(action: NonNullable<DmFogControls['pendingAction']>) {
  return action === 'enable'
    ? FOG_ENABLE_TITLE
    : action === 'cover-all'
      ? FOG_COVER_ALL_TITLE
      : action === 'reveal-all'
        ? FOG_REVEAL_ALL_TITLE
        : FOG_DISABLE_TITLE;
}

function fogPendingDescription(
  action: NonNullable<DmFogControls['pendingAction']>
) {
  return action === 'enable'
    ? FOG_ENABLE_DESCRIPTION
    : action === 'cover-all'
      ? FOG_COVER_ALL_DESCRIPTION
      : action === 'reveal-all'
        ? FOG_REVEAL_ALL_DESCRIPTION
        : FOG_DISABLE_DESCRIPTION;
}

function FogOptions({
  controls,
  presetControls,
}: {
  controls: DmFogControls;
  presetControls?: FogPresetControls;
}) {
  const pending = controls.pendingAction;
  return (
    <div
      data-testid="fog-tool-options"
      role="group"
      aria-label="Fog of war options"
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5"
    >
      {pending ? (
        <div
          role="alertdialog"
          aria-label={fogPendingTitle(pending)}
          className="flex w-full flex-wrap items-center gap-2"
        >
          <div className="min-w-56 flex-1">
            <div className="type-ui text-heading">
              {fogPendingTitle(pending)}
            </div>
            <div className="type-small text-muted">
              {fogPendingDescription(pending)}
            </div>
          </div>
          <Button
            variant={pending === 'enable' ? 'primary' : 'danger-solid'}
            size="sm"
            onClick={controls.confirmAction}
          >
            {pending === 'enable' ? FOG_ENABLE_CONFIRM : 'Confirm'}
          </Button>
          <Button variant="ghost" size="sm" onClick={controls.cancelAction}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <SegmentedGroup
            label="Fog operation"
            options={FOG_OPERATION_OPTIONS}
            value={controls.operation}
            onChange={controls.setOperation}
          />
          <SegmentedGroup
            label="Fog shape"
            options={FOG_SHAPE_OPTIONS}
            value={controls.shape}
            onChange={controls.setShape}
          />
          {controls.shape === 'brush' && (
            <>
              <OptionLabel>Brush size</OptionLabel>
              <RangeField
                ariaLabel="Fog brush size"
                min={8}
                max={160}
                step={4}
                value={controls.radius}
                onChange={controls.setRadius}
                format={formatPx}
              />
            </>
          )}
          <Switch
            checked={controls.preview}
            onCheckedChange={controls.setPreview}
            label="Preview as player"
            wrapperClassName="items-center"
          />
          {presetControls && <FogPresetPanel controls={presetControls} />}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => controls.requestAction('cover-all')}
          >
            Cover all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => controls.requestAction('reveal-all')}
          >
            Reveal all
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => controls.requestAction('disable')}
          >
            Disable fog
          </Button>
          <span className="type-small text-muted min-w-64 flex-1">
            {FOG_SECURITY_EXPLANATION}
          </span>
        </>
      )}
      {controls.diagnostic && (
        <span role="alert" className="type-small text-blood-text">
          {controls.diagnostic}
        </span>
      )}
    </div>
  );
}

function TemplateOptions({
  options,
  setOptions,
}: {
  options: TemplateToolOptions;
  setOptions: (partial: Partial<TemplateToolOptions>) => void;
}) {
  const fill = options.fillColor ?? '#ef444480';
  return (
    <>
      <OptionLabel>Shape</OptionLabel>
      <SegmentedGroup
        label="Template shape"
        options={TEMPLATE_SHAPE_OPTIONS}
        value={options.templateShape ?? 'circle'}
        onChange={templateShape => setOptions({ templateShape })}
      />
      <OptionLabel>Render</OptionLabel>
      <SegmentedGroup
        label="Render style"
        options={TEMPLATE_RENDER_STYLES}
        value={options.renderStyle ?? 'cells'}
        onChange={renderStyle => setOptions({ renderStyle })}
      />
      <OptionLabel>Fill</OptionLabel>
      <SwatchStrip
        label="Fill"
        colors={FILL_SWATCHES}
        names={COLOR_SWATCH_NAMES}
        // Template fills are the swatch at 50% alpha (`80`).
        isSelected={color => fill === `${color}80`}
        onSelect={color => setOptions({ fillColor: `${color}80` })}
      />
      <OptionLabel>Feet per cell</OptionLabel>
      <RangeField
        ariaLabel="Feet per cell"
        min={1}
        max={20}
        value={options.feetPerCell ?? 5}
        onChange={feetPerCell => setOptions({ feetPerCell })}
        format={formatFeet}
      />
    </>
  );
}
