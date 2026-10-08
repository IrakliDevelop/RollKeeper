'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

import {
  CALIBRATION_REPOSITION,
  CALIBRATION_REQUIREMENTS,
  CALIBRATION_STORAGE_BLOCKED,
  calibrationInstruction,
  calibrationSavedNote,
} from './displayMessages';
import {
  CSS_PX_RANGE,
  isValidSquareMm,
  type CalibrationSettings,
} from './calibration/settings';

const STEPS = [
  { delta: -1, label: '−1 px', name: 'Decrease by 1 px' },
  { delta: -0.1, label: '−0.1 px', name: 'Decrease by 0.1 px' },
  { delta: 0.1, label: '+0.1 px', name: 'Increase by 0.1 px' },
  { delta: 1, label: '+1 px', name: 'Increase by 1 px' },
] as const;

/** Two-decimal steps keep repeated ±0.1 adjustments exact in display. */
function step(value: number, delta: number): number {
  const next = Math.round((value + delta) * 100) / 100;
  return Math.min(CSS_PX_RANGE.max, Math.max(CSS_PX_RANGE.min, next));
}

export interface CalibrationRulerPanelProps {
  initialCssPxPerSquare: number;
  initialSquareMm: number;
  saved: CalibrationSettings | null;
  storageAvailable: boolean;
  onConfirm: (cssPxPerSquare: number, squareMm: number) => void;
  onUseUncalibrated: () => void;
  onCancel: () => void;
}

/**
 * PR07 P3: the ruler panel. The reference square is exactly C CSS px (the
 * border is inside the box) at the canvas centre, in an overlay — the
 * canvas camera never changes before Confirm. Compact (≤ 360 px) and
 * dismissible; arrows adjust only while the panel has focus.
 */
export function CalibrationRulerPanel({
  initialCssPxPerSquare,
  initialSquareMm,
  saved,
  storageAvailable,
  onConfirm,
  onUseUncalibrated,
  onCancel,
}: CalibrationRulerPanelProps) {
  const [cssPx, setCssPx] = useState(initialCssPxPerSquare);
  const [squareMm, setSquareMm] = useState(String(initialSquareMm));
  const panelRef = useRef<HTMLElement>(null);
  const mm = Number(squareMm);
  const mmValid = squareMm.trim() !== '' && isValidSquareMm(mm);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    const size = event.shiftKey ? 0.1 : 1;
    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? size
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -size
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    setCssPx(value => step(value, delta));
  };

  return (
    <>
      <div
        data-testid="calibration-reference-square"
        aria-hidden="true"
        className="border-accent-amber-border pointer-events-none fixed top-1/2 left-1/2 z-[115] -translate-x-1/2 -translate-y-1/2 border-2"
        style={{
          width: `${cssPx}px`,
          height: `${cssPx}px`,
          boxSizing: 'border-box',
        }}
      />
      <section
        ref={panelRef}
        aria-label="Ruler calibration"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="bg-surface-raised text-body border-divider fixed top-4 right-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3 rounded-lg border p-4 text-sm shadow-lg outline-none"
      >
        <h2 className="text-heading text-base font-semibold">
          Calibrate minis
        </h2>
        {saved && (
          <p className="text-muted text-xs">
            {calibrationSavedNote(new Date(saved.savedAt).toLocaleDateString())}
          </p>
        )}
        <p>{calibrationInstruction(mmValid ? String(mm) : squareMm)}</p>
        <Input
          id="table-calibration-square-mm"
          label="Square size (mm)"
          type="number"
          inputMode="decimal"
          min={5}
          max={100}
          step={0.1}
          size="sm"
          value={squareMm}
          error={mmValid ? undefined : 'Enter a size from 5 to 100 mm'}
          onChange={event => setSquareMm(event.target.value)}
        />
        <div className="flex flex-col gap-2">
          <p className="text-heading font-medium" aria-live="polite">
            {cssPx} CSS px per square
          </p>
          <div className="flex flex-wrap gap-2">
            {STEPS.map(item => (
              <Button
                key={item.name}
                size="xs"
                variant="outline"
                aria-label={item.name}
                onClick={() => setCssPx(value => step(value, item.delta))}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="text-muted text-xs">
            Arrow keys adjust by 1 px, Shift + arrow keys by 0.1 px.
          </p>
        </div>
        <p className="text-muted text-xs">{CALIBRATION_REQUIREMENTS}</p>
        <p className="text-muted text-xs">{CALIBRATION_REPOSITION}</p>
        {!storageAvailable && (
          <p className="text-muted text-xs">{CALIBRATION_STORAGE_BLOCKED}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!mmValid}
            onClick={() => onConfirm(cssPx, mm)}
          >
            Confirm
          </Button>
          <Button size="sm" variant="secondary" onClick={onUseUncalibrated}>
            Use uncalibrated view
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </section>
    </>
  );
}
