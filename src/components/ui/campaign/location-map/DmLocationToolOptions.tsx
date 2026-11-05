'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
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
import DmSelectionOptions from './DmSelectionOptions';
import { MARKER_TOOL_NAME } from './DmMarkerTool';
import { MARKER_COLOR_KEYS, MARKER_KINDS } from './markerData';
import { MARKER_KIND_ICONS } from './markerIcons';
import type { MarkerColorKey, MarkerKind } from './markerData';
import { MARKER_COLOR_CSS } from './markerPainter';
import type { EditorMode } from './DmLocationEditor.types';
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

const NOTE_TEXT_COLORS = [
  '#334155',
  '#1e293b',
  '#ef4444',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#ffffff',
];

const TEMPLATE_RENDER_STYLES: {
  value: TemplateRenderStyle;
  label: string;
  title: string;
}[] = [
  {
    value: 'cells',
    label: 'Cells',
    title: 'Fill snapped grid cells (square or hex)',
  },
  {
    value: 'geometric',
    label: 'Smooth',
    title: 'Smooth geometric shape that rotates and moves freely on hex grids',
  },
];

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
  /** The VTT dock/dialog wraps controls to the available width. */
  presentation?: 'inline' | 'dock';
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

export default function DmLocationToolOptions({
  mode = 'location',
  presentation = 'inline',
  measureSharing,
  selectionControls,
  markerControls,
  movementControls,
  fogControls,
  fogPresetControls,
  liveSyncConfigured = false,
}: DmLocationToolOptionsProps) {
  const [selectedTool] = useActiveTool();
  const activeTool = fogControls?.pendingAction ? 'fog' : selectedTool;
  const dock = presentation === 'dock';
  const [fogSettingsOpen, setFogSettingsOpen] = useState(false);
  // Read unconditionally (both DM surfaces render this component inside
  // ViewportContext.Provider) so the select branch's `showOptionsBar` gate
  // below can require a non-empty selection — otherwise activating the
  // select tool with nothing selected would render an empty bordered strip.
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

  // Single source of truth for whether the select-tool branch renders — used
  // both to decide if the bar shows at all and, below, to gate the branch
  // itself, so the two conditions can't drift apart.
  const showSelectionOptions =
    selectionControls === true && activeTool === 'select' && selectedCount > 0;

  // Requiring the prop is what makes an empty strip impossible: without it a
  // surface that activates the marker tool but wires no controls would render
  // a bordered bar with nothing in it. Same defensive shape as
  // `pencilOpts !== undefined` and `selectedCount > 0` above.
  const showMarkerOptions =
    activeTool === MARKER_TOOL_NAME && markerControls !== undefined;
  const showFogOptions =
    fogControls !== undefined &&
    (activeTool === 'fog' || fogControls.pendingAction !== null);

  // Mirrors DmLocationToolbar's PRESENCE_TOOL_DEFS gate.
  const presenceToolsEnabled = mode === 'battlemap' || liveSyncConfigured;

  const showOptionsBar =
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

  if (!showOptionsBar) return null;

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
                    : '#334155';

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
    <div
      className={cn(
        'border-divider bg-surface-secondary flex min-w-0 flex-wrap items-center gap-3 border-b px-4 py-1.5',
        dock &&
          'border-b-0 p-2 [&_button]:pointer-coarse:min-h-11 [&_button]:pointer-coarse:min-w-11 [&_input]:pointer-coarse:text-base [&_select]:pointer-coarse:min-h-11 [&_select]:pointer-coarse:text-base'
      )}
    >
      {showSelectionOptions && <DmSelectionOptions wrap={dock} />}
      {activeTool === 'shape' && shapeOpts && (
        <>
          <span className="text-muted text-xs font-medium">Shape</span>
          <div
            className={cn(
              'border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {(['rectangle', 'ellipse'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setShapeOpts({ shape: value })}
                className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                  shapeKind === value
                    ? dock
                      ? 'bg-brass-bg text-brass-text font-semibold'
                      : 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                    : 'text-muted hover:bg-surface-raised hover:text-body'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="bg-divider h-6 w-px" />
        </>
      )}

      {showMarkerOptions && markerControls && (
        <div
          data-testid="marker-tool-options"
          role="group"
          aria-label="Marker options"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-muted text-xs font-medium">Marker</span>
          <div className="border-divider bg-surface flex flex-wrap items-center gap-0.5 rounded-md border p-0.5">
            {MARKER_KINDS.map(kind => {
              const KindIcon = MARKER_KIND_ICONS[kind];
              return (
                <Button
                  key={kind}
                  variant={markerControls.kind === kind ? 'primary' : 'ghost'}
                  onClick={() => markerControls.onKindChange(kind)}
                  title={`Marker kind: ${kind}`}
                  aria-label={`Marker kind: ${kind}`}
                  aria-pressed={markerControls.kind === kind}
                  className="min-h-[44px] min-w-[44px] gap-1.5 px-2 text-xs capitalize"
                >
                  <KindIcon aria-hidden="true" size={16} />
                  {kind}
                </Button>
              );
            })}
          </div>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Pin colour</span>
          <div
            className={cn(
              'flex items-center gap-1',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {MARKER_COLOR_KEYS.map(colorKey => (
              <Button
                key={colorKey}
                variant="ghost"
                onClick={() => markerControls.onColorChange(colorKey)}
                title={`Marker colour: ${colorKey}`}
                aria-label={`Marker colour: ${colorKey}`}
                aria-pressed={markerControls.color === colorKey}
                className="min-h-[44px] min-w-[44px] p-0"
              >
                <span
                  data-testid="marker-swatch-fill"
                  aria-hidden="true"
                  className={`block h-5 w-5 rounded-full border-2 ${
                    markerControls.color === colorKey
                      ? dock
                        ? 'border-brass-border'
                        : 'border-accent-blue-border'
                      : 'border-divider'
                  }`}
                  // A literal hex from the painter's palette, deliberately not
                  // a semantic token: this is the colour the CANVAS paints,
                  // where `var(--…)` does not resolve. Data, not theming.
                  style={{ backgroundColor: MARKER_COLOR_CSS[colorKey] }}
                />
              </Button>
            ))}
          </div>
        </div>
      )}

      {showFogOptions && fogControls && (
        <div
          data-testid="fog-tool-options"
          role="group"
          aria-label="Fog of war options"
          className="flex w-full flex-wrap items-center gap-2"
        >
          {fogControls.pendingAction ? (
            <div
              role="alertdialog"
              aria-label={
                fogControls.pendingAction === 'enable'
                  ? FOG_ENABLE_TITLE
                  : fogControls.pendingAction === 'cover-all'
                    ? FOG_COVER_ALL_TITLE
                    : fogControls.pendingAction === 'reveal-all'
                      ? FOG_REVEAL_ALL_TITLE
                      : FOG_DISABLE_TITLE
              }
              className="flex w-full flex-wrap items-center gap-2"
            >
              <div className="min-w-0 flex-1 basis-56 text-xs">
                <div className="text-body font-semibold">
                  {fogControls.pendingAction === 'enable'
                    ? FOG_ENABLE_TITLE
                    : fogControls.pendingAction === 'cover-all'
                      ? FOG_COVER_ALL_TITLE
                      : fogControls.pendingAction === 'reveal-all'
                        ? FOG_REVEAL_ALL_TITLE
                        : FOG_DISABLE_TITLE}
                </div>
                <div className="text-muted">
                  {fogControls.pendingAction === 'enable'
                    ? FOG_ENABLE_DESCRIPTION
                    : fogControls.pendingAction === 'cover-all'
                      ? FOG_COVER_ALL_DESCRIPTION
                      : fogControls.pendingAction === 'reveal-all'
                        ? FOG_REVEAL_ALL_DESCRIPTION
                        : FOG_DISABLE_DESCRIPTION}
                </div>
              </div>
              <Button
                variant={
                  fogControls.pendingAction === 'enable'
                    ? 'primary'
                    : 'danger-solid'
                }
                onClick={fogControls.confirmAction}
                className="min-h-[44px] px-3 text-xs"
              >
                {fogControls.pendingAction === 'enable'
                  ? FOG_ENABLE_CONFIRM
                  : 'Confirm'}
              </Button>
              <Button
                variant="ghost"
                onClick={fogControls.cancelAction}
                className="min-h-[44px] px-3 text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <span className="text-muted text-xs font-semibold">Fog</span>
              <div
                className={cn(
                  'border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5',
                  dock && 'min-w-0 flex-wrap'
                )}
              >
                {(['reveal', 'conceal'] as const).map(value => (
                  <Button
                    key={value}
                    variant={
                      dock
                        ? 'ghost'
                        : fogControls.operation === value
                          ? 'primary'
                          : 'ghost'
                    }
                    selected={dock && fogControls.operation === value}
                    onClick={() => fogControls.setOperation(value)}
                    aria-pressed={fogControls.operation === value}
                    className="min-h-[44px] px-3 text-xs capitalize"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <div
                className={cn(
                  'border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5',
                  dock && 'min-w-0 flex-wrap'
                )}
              >
                {(['brush', 'rectangle', 'polygon'] as const).map(value => (
                  <Button
                    key={value}
                    variant={
                      dock
                        ? 'ghost'
                        : fogControls.shape === value
                          ? 'primary'
                          : 'ghost'
                    }
                    selected={dock && fogControls.shape === value}
                    onClick={() => fogControls.setShape(value)}
                    aria-pressed={fogControls.shape === value}
                    className="min-h-[44px] px-3 text-xs capitalize"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              {fogControls.shape === 'brush' && (
                <label className="text-muted flex min-h-[44px] items-center gap-2 text-xs">
                  Brush size
                  <input
                    aria-label="Fog brush size"
                    type="range"
                    min={8}
                    max={160}
                    step={4}
                    value={fogControls.radius}
                    onChange={event =>
                      fogControls.setRadius(Number(event.target.value))
                    }
                    className="w-24"
                  />
                  {fogControls.radius}px
                </label>
              )}
              <Switch
                checked={fogControls.preview}
                onCheckedChange={fogControls.setPreview}
                label="Preview as player"
                wrapperClassName="min-h-[44px] items-center"
              />
              {dock && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={fogSettingsOpen}
                  onClick={() => setFogSettingsOpen(value => !value)}
                >
                  Fog settings
                </Button>
              )}
              <div
                hidden={dock && !fogSettingsOpen}
                className={dock ? 'w-full' : 'contents'}
              >
                <div
                  className={
                    dock
                      ? 'flex min-w-0 flex-wrap items-center gap-2'
                      : 'contents'
                  }
                >
                  {fogPresetControls && (
                    <FogPresetPanel controls={fogPresetControls} />
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => fogControls.requestAction('cover-all')}
                    className="min-h-[44px] px-3 text-xs"
                  >
                    Cover all
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => fogControls.requestAction('reveal-all')}
                    className="min-h-[44px] px-3 text-xs"
                  >
                    Reveal all
                  </Button>
                  <Button
                    variant={dock ? 'danger' : 'ghost'}
                    onClick={() => fogControls.requestAction('disable')}
                    className={cn(
                      'min-h-[44px] px-3 text-xs',
                      dock ? 'text-blood-text' : 'text-accent-red-text'
                    )}
                  >
                    Disable fog
                  </Button>
                </div>
              </div>
              <span className="text-muted min-w-0 flex-1 basis-64 text-xs">
                {FOG_SECURITY_EXPLANATION}
              </span>
            </>
          )}
          {fogControls.diagnostic && (
            <span
              role="alert"
              className={
                dock
                  ? 'text-blood-text text-xs'
                  : 'text-accent-red-text text-xs'
              }
            >
              {fogControls.diagnostic}
            </span>
          )}
        </div>
      )}

      {/* The shared strip carries CSS colour STRINGS for the SDK tools. The
          marker carries a palette KEY, so its picker above owns colour
          entirely — rendering both would put a dead control (handleColorChange
          has no 'marker' branch) next to the live one. */}
      {!showMarkerOptions && !showFogOptions && (
        <>
          <span className="text-muted text-xs font-medium">
            {activeTool === 'shape'
              ? 'Stroke'
              : activeTool === 'note'
                ? 'Background'
                : activeTool === 'template'
                  ? 'Outline'
                  : 'Color'}
          </span>
          <div
            className={cn(
              'flex items-center gap-1',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {COLOR_SWATCHES.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(color)}
                title={color}
                aria-label={color}
                className={`h-5 w-5 rounded-full border-2 ${dock ? 'transition-colors' : 'transition-transform'} ${
                  activeColor === color
                    ? dock
                      ? 'border-brass-border'
                      : 'border-accent-blue-border scale-110'
                    : dock
                      ? 'border-divider hover:border-input-border'
                      : 'border-divider hover:scale-105'
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow:
                    color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
                }}
              />
            ))}
            <label
              className={
                dock
                  ? 'relative h-11 w-11 cursor-pointer'
                  : 'relative h-5 w-5 cursor-pointer'
              }
            >
              <input
                type="color"
                aria-label="Custom tool color"
                value={activeColor ?? '#334155'}
                onChange={e => handleColorChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div
                className={cn(
                  'border-divider text-muted hover:border-body flex items-center justify-center rounded-full border-2 border-dashed text-xs',
                  dock ? 'h-11 w-11' : 'h-5 w-5'
                )}
              >
                +
              </div>
            </label>
          </div>
        </>
      )}

      {activeTool === 'pencil' && pencilOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Width</span>
          <input
            type="range"
            min={1}
            max={12}
            step={0.5}
            aria-label="Drawing width"
            value={pencilOpts.width ?? 2}
            onChange={e => setPencilOpts({ width: Number(e.target.value) })}
            className="w-20"
          />
          <span className="text-muted text-xs">{pencilOpts.width ?? 2}px</span>
        </>
      )}

      {activeTool === 'note' && noteOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Text</span>
          <div
            className={cn(
              'flex items-center gap-1',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {NOTE_TEXT_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setNoteOpts({ textColor: color })}
                title={color}
                aria-label={color}
                className={`h-5 w-5 rounded-full border-2 ${dock ? 'transition-colors' : 'transition-transform'} ${
                  noteOpts.textColor === color
                    ? dock
                      ? 'border-brass-border'
                      : 'border-accent-blue-border scale-110'
                    : dock
                      ? 'border-divider hover:border-input-border'
                      : 'border-divider hover:scale-105'
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow:
                    color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
                }}
              />
            ))}
          </div>
        </>
      )}

      {activeTool === 'shape' && shapeOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Fill</span>
          <div
            className={cn(
              'flex items-center gap-1',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            <button
              type="button"
              onClick={() => setShapeOpts({ fillColor: 'transparent' })}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                shapeOpts.fillColor === 'transparent'
                  ? dock
                    ? 'bg-brass-bg text-brass-text'
                    : 'bg-accent-blue-bg text-accent-blue-text'
                  : 'text-muted hover:text-body'
              }`}
            >
              None
            </button>
            {COLOR_SWATCHES.slice(0, 8).map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setShapeOpts({ fillColor: color })}
                title={color}
                aria-label={color}
                className={`h-5 w-5 rounded-full border-2 ${dock ? 'transition-colors' : 'transition-transform'} ${
                  shapeOpts.fillColor === color
                    ? dock
                      ? 'border-brass-border'
                      : 'border-accent-blue-border scale-110'
                    : dock
                      ? 'border-divider hover:border-input-border'
                      : 'border-divider hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Width</span>
          <input
            type="range"
            min={1}
            max={10}
            aria-label="Shape stroke width"
            value={shapeOpts.strokeWidth ?? 2}
            onChange={e =>
              setShapeOpts({ strokeWidth: Number(e.target.value) })
            }
            className="w-20"
          />
          <span className="text-muted text-xs">
            {shapeOpts.strokeWidth ?? 2}px
          </span>
        </>
      )}

      {activeTool === 'text' && textOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Size</span>
          <input
            type="range"
            min={10}
            max={72}
            aria-label="Text size"
            value={textOpts.fontSize ?? 16}
            onChange={e => setTextOpts({ fontSize: Number(e.target.value) })}
            className="w-20"
          />
          <span className="text-muted text-xs">
            {textOpts.fontSize ?? 16}px
          </span>
          <div className="bg-divider h-6 w-px" />
          <div
            className={cn(
              'border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {(['left', 'center', 'right'] as const).map(align => (
              <button
                key={align}
                type="button"
                onClick={() => setTextOpts({ textAlign: align })}
                className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                  textOpts.textAlign === align
                    ? dock
                      ? 'bg-brass-bg text-brass-text font-semibold'
                      : 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                    : 'text-muted hover:bg-surface-raised hover:text-body'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'battlemap' && activeTool === 'measure' && measureOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Feet / Cell</span>
          <input
            type="range"
            min={1}
            max={20}
            aria-label="Measure feet per cell"
            value={measureOpts.feetPerCell ?? 5}
            onChange={e =>
              setMeasureOpts({ feetPerCell: Number(e.target.value) })
            }
            className="w-20"
          />
          <span className="text-muted w-8 text-xs">
            {measureOpts.feetPerCell ?? 5}
          </span>
          {measureSharing && (
            <>
              <div className="bg-divider h-6 w-px" />
              <label className="text-muted flex items-center gap-2 text-xs font-medium">
                Share with players
                <Switch
                  checked={measureSharing.enabled}
                  onCheckedChange={measureSharing.onChange}
                  aria-label="Share with players"
                />
              </label>
            </>
          )}
        </>
      )}

      {mode === 'battlemap' && activeTool === 'path' && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Diagonals</span>
          <select
            value={(pathOpts?.diagonalRule as string) ?? 'chebyshev'}
            onChange={e =>
              setPathOpts({ diagonalRule: e.target.value as DiagonalRule })
            }
            className="border-divider bg-surface text-body rounded border px-1 py-0.5 text-xs"
            aria-label="Diagonal rule"
          >
            <option value="chebyshev">5-5-5</option>
            <option value="alternate">5-10-5</option>
          </select>
          {movementControls && (
            <label className="text-muted flex items-center gap-2 text-xs font-medium">
              Dash
              <Switch
                checked={movementControls.dash.enabled}
                onCheckedChange={movementControls.dash.onChange}
                aria-label="Dash"
              />
            </label>
          )}
          {movementControls?.sharing && (
            <>
              <div className="bg-divider h-6 w-px" />
              <label className="text-muted flex items-center gap-2 text-xs font-medium">
                Share with players
                <Switch
                  checked={movementControls.sharing.enabled}
                  onCheckedChange={movementControls.sharing.onChange}
                  aria-label="Share movement with players"
                />
              </label>
            </>
          )}
        </>
      )}

      {mode === 'battlemap' && activeTool === 'template' && templateOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Template</span>
          <div
            className={cn(
              'border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {(
              [
                'circle',
                'cone',
                'line',
                'square',
                'rectangle',
              ] as TemplateShape[]
            ).map(shape => (
              <button
                key={shape}
                type="button"
                onClick={() => setTemplateOpts({ templateShape: shape })}
                className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                  (templateOpts.templateShape ?? 'circle') === shape
                    ? dock
                      ? 'bg-brass-bg text-brass-text font-semibold'
                      : 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                    : 'text-muted hover:bg-surface-raised hover:text-body'
                }`}
              >
                {shape}
              </button>
            ))}
          </div>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Render</span>
          <div
            className={cn(
              'border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {TEMPLATE_RENDER_STYLES.map(({ value, label, title }) => (
              <button
                key={value}
                type="button"
                title={title}
                onClick={() => setTemplateOpts({ renderStyle: value })}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  (templateOpts.renderStyle ?? 'cells') === value
                    ? dock
                      ? 'bg-brass-bg text-brass-text font-semibold'
                      : 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                    : 'text-muted hover:bg-surface-raised hover:text-body'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Fill</span>
          <div
            className={cn(
              'flex items-center gap-1',
              dock && 'min-w-0 flex-wrap'
            )}
          >
            {COLOR_SWATCHES.slice(0, 8).map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setTemplateOpts({ fillColor: `${color}80` })}
                title={color}
                aria-label={color}
                className={`h-5 w-5 rounded-full border-2 ${dock ? 'transition-colors' : 'transition-transform'} ${
                  (templateOpts.fillColor ?? '#ef444480') === `${color}80`
                    ? dock
                      ? 'border-brass-border'
                      : 'border-accent-blue-border scale-110'
                    : dock
                      ? 'border-divider hover:border-input-border'
                      : 'border-divider hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Feet / Cell</span>
          <input
            type="range"
            min={1}
            max={20}
            aria-label="Template feet per cell"
            value={templateOpts.feetPerCell ?? 5}
            onChange={e =>
              setTemplateOpts({ feetPerCell: Number(e.target.value) })
            }
            className="w-20"
          />
          <span className="text-muted w-8 text-xs">
            {templateOpts.feetPerCell ?? 5}
          </span>
        </>
      )}
    </div>
  );
}
