/**
 * PR05 C5-4: one constant per audience-facing display message, shared by
 * the campaign display shell, the map-pinned display page and their tests.
 * None names a scene.
 */
export const DISPLAY_EXPIRED =
  'Display link expired — open the display again from the DM screen';
export const DISPLAY_IN_USE =
  'This display link is in use on another screen — open the display again from the DM screen';
/** Map-pinned page: valid link, but this map is not what is shown. */
export const DISPLAY_NOTHING_SHOWN =
  'Nothing is being shown on this map right now';
/** Campaign shell: covered (waiting, blank, switching or recovering). */
export const DISPLAY_WAITING = 'Waiting for the table';
/** No credential at all. */
export const DISPLAY_OPEN_FROM_DM =
  'Open the display from the DM screen (Open display)';
export const DISPLAY_NOT_CONFIGURED = 'Live display is not configured';
export const DISPLAY_STORAGE_BLOCKED =
  'This browser blocks session storage — reloading will need Open display again';

// ---- PR07 calibrated minis (P3, P4, P6) -----------------------------------
export const CALIBRATION_REQUIREMENTS =
  'Calibrated minis support: extended monitor, browser fullscreen, browser zoom 100%. Verify scale again after moving the window to another display, changing browser zoom, OS scaling or resolution, or leaving fullscreen — the browser cannot detect every change.';
export const CALIBRATION_NEEDS_VERIFY = 'Scale needs verification';
export const CALIBRATION_VERIFIED = 'Scale verified';
export const CALIBRATION_UNSUPPORTED_GRID =
  'Calibrated minis need a square grid on this scene — showing the uncalibrated view';
export const CALIBRATION_UNSUPPORTED_RANGE =
  "This scene's grid scale is outside the supported range";
export const CALIBRATION_REPOSITION =
  'After Confirm the map may shift — reposition minis if needed.';
export const CALIBRATION_STORAGE_BLOCKED =
  'This browser blocks local storage — the ruler setting lasts for this page only';
export const calibrationInstruction = (squareMm: string) =>
  `Hold a ruler against the square. Adjust until each side measures ${squareMm} mm on this screen, then Confirm.`;
export const calibrationSavedNote = (date: string) =>
  `Saved ruler setting from ${date} — confirm it with your ruler`;
