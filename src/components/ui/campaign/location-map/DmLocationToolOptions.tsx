'use client';

import type { ShapeKind } from '@fieldnotes/core';
import type {
  ArrowToolOptions,
  NoteToolOptions,
  ShapeToolOptions,
  TextToolOptions,
} from '@fieldnotes/core';
import { useActiveTool, useToolOptions } from '@fieldnotes/react';

const COLOR_SWATCHES = [
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

export default function DmLocationToolOptions() {
  const [activeTool] = useActiveTool();
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

  const showOptionsBar =
    activeTool === 'arrow' ||
    activeTool === 'note' ||
    activeTool === 'text' ||
    activeTool === 'shape';

  if (!showOptionsBar) return null;

  const shapeKind = (shapeOpts?.shape ?? 'rectangle') as ShapeKind;

  const activeColor =
    activeTool === 'shape'
      ? shapeOpts?.strokeColor
      : activeTool === 'text'
        ? textOpts?.color
        : activeTool === 'note'
          ? noteOpts?.backgroundColor
          : activeTool === 'arrow'
            ? arrowOpts?.color
            : '#334155';

  const handleColorChange = (color: string) => {
    if (activeTool === 'shape') setShapeOpts({ strokeColor: color });
    else if (activeTool === 'text') setTextOpts({ color });
    else if (activeTool === 'note') setNoteOpts({ backgroundColor: color });
    else if (activeTool === 'arrow') setArrowOpts({ color });
  };

  return (
    <div className="border-divider bg-surface-secondary flex flex-wrap items-center gap-3 border-b px-4 py-1.5">
      {activeTool === 'shape' && shapeOpts && (
        <>
          <span className="text-muted text-xs font-medium">Shape</span>
          <div className="border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5">
            {(['rectangle', 'ellipse'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setShapeOpts({ shape: value })}
                className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                  shapeKind === value
                    ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
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

      <span className="text-muted text-xs font-medium">
        {activeTool === 'shape'
          ? 'Stroke'
          : activeTool === 'note'
            ? 'Background'
            : 'Color'}
      </span>
      <div className="flex items-center gap-1">
        {COLOR_SWATCHES.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorChange(color)}
            title={color}
            className={`h-5 w-5 rounded-full border-2 transition-transform ${
              activeColor === color
                ? 'border-accent-blue-border scale-110'
                : 'border-divider hover:scale-105'
            }`}
            style={{
              backgroundColor: color,
              boxShadow:
                color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
            }}
          />
        ))}
        <label className="relative h-5 w-5 cursor-pointer">
          <input
            type="color"
            value={activeColor ?? '#334155'}
            onChange={e => handleColorChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="border-divider text-muted hover:border-body flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed text-xs">
            +
          </div>
        </label>
      </div>

      {activeTool === 'note' && noteOpts && (
        <>
          <div className="bg-divider h-6 w-px" />
          <span className="text-muted text-xs font-medium">Text</span>
          <div className="flex items-center gap-1">
            {NOTE_TEXT_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setNoteOpts({ textColor: color })}
                title={color}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  noteOpts.textColor === color
                    ? 'border-accent-blue-border scale-110'
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShapeOpts({ fillColor: 'transparent' })}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                shapeOpts.fillColor === 'transparent'
                  ? 'bg-accent-blue-bg text-accent-blue-text'
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
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  shapeOpts.fillColor === color
                    ? 'border-accent-blue-border scale-110'
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
            value={textOpts.fontSize ?? 16}
            onChange={e => setTextOpts({ fontSize: Number(e.target.value) })}
            className="w-20"
          />
          <span className="text-muted text-xs">
            {textOpts.fontSize ?? 16}px
          </span>
          <div className="bg-divider h-6 w-px" />
          <div className="border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5">
            {(['left', 'center', 'right'] as const).map(align => (
              <button
                key={align}
                type="button"
                onClick={() => setTextOpts({ textAlign: align })}
                className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                  textOpts.textAlign === align
                    ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                    : 'text-muted hover:bg-surface-raised hover:text-body'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
