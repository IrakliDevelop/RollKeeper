'use client';

import {
  RotateCcw,
  RotateCw,
  Group,
  Ungroup,
  Lock,
  LockOpen,
  Trash2,
} from 'lucide-react';
import type { ElementStyle } from '@fieldnotes/core';
import {
  useSelectionOps,
  useSelectionStyleDetails,
  useViewport,
} from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import DmLocationAlignMenu from './DmLocationAlignMenu';
import { COLOR_SWATCHES } from './DmLocationToolOptions';

const ARRANGE_BUTTON = 'h-11 w-11 p-0';

interface SwatchRowProps {
  label: string;
  mixedTitle: string;
  active: string | undefined;
  mixed: boolean;
  onSelect: (color: string) => void;
}

/** One row of `COLOR_SWATCHES` as a radiogroup; shared by the stroke/fill controls below. */
function SwatchRow({
  label,
  mixedTitle,
  active,
  mixed,
  onSelect,
}: SwatchRowProps) {
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label={label}
    >
      {COLOR_SWATCHES.map(color => {
        const checked = !mixed && active === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={checked}
            title={mixed ? mixedTitle : color}
            onClick={() => onSelect(color)}
            className={`h-11 w-11 rounded-full border-2 transition-transform ${
              checked
                ? 'border-accent-blue-border scale-110'
                : 'border-divider hover:scale-105'
            }`}
            style={{
              backgroundColor: color,
              boxShadow:
                color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Select-tool branch of the shared tool options bar: style controls (stroke
 * color, fill color, stroke width, font size — each gated on whether the
 * field applies to the current selection) plus arrange actions (align,
 * rotate, group, lock, delete). Must render inside ViewportContext.Provider.
 */
export default function DmSelectionOptions() {
  const viewport = useViewport();
  const {
    selectedIds,
    selectedCount,
    canGroup,
    canUngroup,
    isLocked,
    group,
    ungroup,
    toggleLock,
    rotateCW,
    rotateCCW,
  } = useSelectionOps();
  const [details, applyStyle] = useSelectionStyleDetails();

  if (selectedCount === 0) return null;

  // `details` is null for style-less selections (e.g. images) — arrange
  // actions (align, rotate, group, lock, delete) still apply to those, so
  // only the per-field style controls below gate on it.
  const has = (field: keyof ElementStyle) =>
    details !== null && details.applicable.includes(field);
  const isMixed = (field: keyof ElementStyle) =>
    details !== null && details.mixed.includes(field);

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Selection options"
    >
      <span className="text-muted px-1 text-xs whitespace-nowrap">
        {selectedCount} selected
      </span>
      {has('color') && (
        <SwatchRow
          label="Stroke color"
          mixedTitle="Mixed stroke colors — click to unify"
          active={details?.common.color}
          mixed={isMixed('color')}
          onSelect={color => applyStyle({ color })}
        />
      )}
      {has('fillColor') && (
        <SwatchRow
          label="Fill color"
          mixedTitle="Mixed fill colors — click to unify"
          active={details?.common.fillColor}
          mixed={isMixed('fillColor')}
          onSelect={color => applyStyle({ fillColor: color })}
        />
      )}
      {has('strokeWidth') && (
        <input
          type="range"
          min={1}
          max={12}
          value={
            isMixed('strokeWidth') ? 4 : (details?.common.strokeWidth ?? 4)
          }
          aria-label={
            isMixed('strokeWidth') ? 'Stroke width (mixed)' : 'Stroke width'
          }
          className="h-11"
          onChange={e => applyStyle({ strokeWidth: Number(e.target.value) })}
        />
      )}
      {has('fontSize') && (
        <input
          type="range"
          min={10}
          max={72}
          value={isMixed('fontSize') ? 16 : (details?.common.fontSize ?? 16)}
          aria-label={isMixed('fontSize') ? 'Font size (mixed)' : 'Font size'}
          className="h-11"
          onChange={e => applyStyle({ fontSize: Number(e.target.value) })}
        />
      )}
      <DmLocationAlignMenu />
      <Button
        variant="ghost"
        onClick={rotateCCW}
        title="Rotate 90° counter-clockwise"
        className={ARRANGE_BUTTON}
      >
        <RotateCcw size={15} />
      </Button>
      <Button
        variant="ghost"
        onClick={rotateCW}
        title="Rotate 90° clockwise"
        className={ARRANGE_BUTTON}
      >
        <RotateCw size={15} />
      </Button>
      {canGroup && (
        <Button
          variant="ghost"
          onClick={group}
          title="Group"
          className={ARRANGE_BUTTON}
        >
          <Group size={15} />
        </Button>
      )}
      {canUngroup && (
        <Button
          variant="ghost"
          onClick={ungroup}
          title="Ungroup"
          className={ARRANGE_BUTTON}
        >
          <Ungroup size={15} />
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={toggleLock}
        title={isLocked === true ? 'Unlock' : 'Lock'}
        className={ARRANGE_BUTTON}
      >
        {isLocked === true ? <LockOpen size={15} /> : <Lock size={15} />}
      </Button>
      <Button
        variant="ghost"
        onClick={() => viewport.removeElements(selectedIds)}
        title="Delete selected"
        className={`text-accent-red-text ${ARRANGE_BUTTON}`}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
