'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/forms/button';

import { CalibrationRulerPanel } from './CalibrationRulerPanel';
import {
  CALIBRATION_NEEDS_VERIFY,
  CALIBRATION_REQUIREMENTS,
  CALIBRATION_UNSUPPORTED_GRID,
  CALIBRATION_UNSUPPORTED_RANGE,
  CALIBRATION_VERIFIED,
} from './displayMessages';
import type { EnvironmentSnapshot } from './calibration/environment';
import type {
  CalibrationPageState,
  CalibrationStore,
} from './calibration/session';
import {
  DEFAULT_CSS_PX_PER_SQUARE,
  DEFAULT_SQUARE_MM,
} from './calibration/settings';
import type { DisplayCalibrationView } from './tableDisplayController';

export interface TableDisplayCalibrationProps {
  store: CalibrationStore | null;
  state: CalibrationPageState | null;
  view: DisplayCalibrationView;
  /** Pointer moved recently (the edge status may show for quiet states). */
  pointerActive: boolean;
  readEnvironment: () => EnvironmentSnapshot;
}

/**
 * PR07 P3/P4/P6: the small edge status ("Calibrate minis" / "Verify scale",
 * "Scale needs verification", unsupported geometry) and the ruler panel.
 * Never a modal over the map: verify-required and unsupported stay visible
 * at the edge, quiet states show only on pointer movement.
 */
export function TableDisplayCalibration({
  store,
  state,
  view,
  pointerActive,
  readEnvironment,
}: TableDisplayCalibrationProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  if (!store || !state) return null;

  const { report, unsupported } = view;
  if (panelOpen)
    return (
      <CalibrationRulerPanel
        initialCssPxPerSquare={
          state.settings?.cssPxPerSquare ?? DEFAULT_CSS_PX_PER_SQUARE
        }
        initialSquareMm={state.settings?.squareMm ?? DEFAULT_SQUARE_MM}
        saved={state.settings}
        storageAvailable={state.storageAvailable}
        onConfirm={(cssPxPerSquare, squareMm) => {
          store.confirm({
            cssPxPerSquare,
            squareMm,
            environment: readEnvironment(),
            now: Date.now(),
          });
          setPanelOpen(false);
        }}
        onUseUncalibrated={() => {
          store.useUncalibrated();
          setPanelOpen(false);
        }}
        onCancel={() => setPanelOpen(false)}
      />
    );

  const attention = report === 'verify-required' || report === 'unsupported';
  if (!attention && !pointerActive && !helpOpen) return null;
  const message =
    unsupported === 'grid'
      ? CALIBRATION_UNSUPPORTED_GRID
      : unsupported === 'range'
        ? CALIBRATION_UNSUPPORTED_RANGE
        : null;
  return (
    <div
      data-testid="table-display-calibration"
      role="status"
      className="bg-surface-raised text-body border-divider fixed top-4 right-4 z-[110] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 rounded-lg border p-3 text-sm shadow-lg"
    >
      {report === 'verify-required' && (
        <p className="text-accent-amber-text font-semibold">
          {CALIBRATION_NEEDS_VERIFY}
        </p>
      )}
      {report === 'verified' && (
        <p className="text-heading font-medium">{CALIBRATION_VERIFIED}</p>
      )}
      {message && <p className="text-muted text-xs">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="xs"
          variant={report === 'verify-required' ? 'primary' : 'secondary'}
          onClick={() => setPanelOpen(true)}
        >
          {report === 'uncalibrated' ? 'Calibrate minis' : 'Verify scale'}
        </Button>
        {attention && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => store.useUncalibrated()}
          >
            Use uncalibrated view
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen(open => !open)}
        >
          Supported setup
        </Button>
      </div>
      {helpOpen && (
        <p className="text-muted text-xs">{CALIBRATION_REQUIREMENTS}</p>
      )}
    </div>
  );
}
