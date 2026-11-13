'use client';

import type { ReactNode } from 'react';
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
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import DmLocationAlignMenu from './DmLocationAlignMenu';
import { COLOR_SWATCHES, COLOR_SWATCH_NAMES } from './DmLocationToolOptions';
import { OptionLabel, RangeField, SwatchButton } from './ToolOptionControls';

interface SwatchRowProps {
  label: string;
  active: string | undefined;
  mixed: boolean;
  onSelect: (color: string) => void;
}

/**
 * One row of `COLOR_SWATCHES` as a radiogroup; shared by the stroke/fill
 * controls below. A mixed selection is named in the group, not on a swatch.
 */
function SwatchRow({ label, active, mixed, onSelect }: SwatchRowProps) {
  return (
    <div
      className="flex items-center"
      role="radiogroup"
      aria-label={mixed ? `${label} (mixed)` : label}
    >
      {COLOR_SWATCHES.map(color => (
        <SwatchButton
          key={color}
          semantics="radio"
          color={color}
          name={COLOR_SWATCH_NAMES[color]}
          selected={!mixed && active === color}
          onSelect={() => onSelect(color)}
        />
      ))}
    </div>
  );
}

interface ArrangeButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'danger';
  children: ReactNode;
}

/** A 36px icon button that names itself by aria-label and tooltip. */
function ArrangeButton({
  label,
  onClick,
  variant = 'ghost',
  children,
}: ArrangeButtonProps) {
  return (
    <Tooltip content={label}>
      <Button
        variant={variant}
        size="sm"
        className="w-9 shrink-0 px-0"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
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

  const strokeWidth = isMixed('strokeWidth')
    ? 4
    : (details?.common.strokeWidth ?? 4);
  const fontSize = isMixed('fontSize') ? 16 : (details?.common.fontSize ?? 16);

  return (
    <TooltipProvider>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Selection options"
      >
        <span className="type-small text-muted px-1 whitespace-nowrap">
          {selectedCount} selected
        </span>
        {has('color') && (
          <>
            <OptionLabel>Stroke</OptionLabel>
            <SwatchRow
              label="Stroke color"
              active={details?.common.color}
              mixed={isMixed('color')}
              onSelect={color => applyStyle({ color })}
            />
          </>
        )}
        {has('fillColor') && (
          <>
            <OptionLabel>Fill</OptionLabel>
            <SwatchRow
              label="Fill color"
              active={details?.common.fillColor}
              mixed={isMixed('fillColor')}
              onSelect={color => applyStyle({ fillColor: color })}
            />
          </>
        )}
        {has('strokeWidth') && (
          <>
            <OptionLabel>Width</OptionLabel>
            <RangeField
              ariaLabel={
                isMixed('strokeWidth') ? 'Stroke width (mixed)' : 'Stroke width'
              }
              min={1}
              max={12}
              value={strokeWidth}
              onChange={value => applyStyle({ strokeWidth: value })}
              format={value => `${value}px`}
            />
          </>
        )}
        {has('fontSize') && (
          <>
            <OptionLabel>Size</OptionLabel>
            <RangeField
              ariaLabel={
                isMixed('fontSize') ? 'Font size (mixed)' : 'Font size'
              }
              min={10}
              max={72}
              value={fontSize}
              onChange={value => applyStyle({ fontSize: value })}
              format={value => `${value}px`}
            />
          </>
        )}
        <DmLocationAlignMenu />
        <ArrangeButton label="Rotate 90° counter-clockwise" onClick={rotateCCW}>
          <RotateCcw size={15} />
        </ArrangeButton>
        <ArrangeButton label="Rotate 90° clockwise" onClick={rotateCW}>
          <RotateCw size={15} />
        </ArrangeButton>
        {canGroup && (
          <ArrangeButton label="Group" onClick={group}>
            <Group size={15} />
          </ArrangeButton>
        )}
        {canUngroup && (
          <ArrangeButton label="Ungroup" onClick={ungroup}>
            <Ungroup size={15} />
          </ArrangeButton>
        )}
        <ArrangeButton
          label={isLocked === true ? 'Unlock' : 'Lock'}
          onClick={toggleLock}
        >
          {isLocked === true ? <LockOpen size={15} /> : <Lock size={15} />}
        </ArrangeButton>
        <ArrangeButton
          label="Delete selected"
          variant="danger"
          onClick={() => viewport.removeElements(selectedIds)}
        >
          <Trash2 size={15} />
        </ArrangeButton>
      </div>
    </TooltipProvider>
  );
}
