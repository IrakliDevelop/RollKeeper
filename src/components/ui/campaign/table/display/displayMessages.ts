/**
 * PR05 C5-4: one constant per audience-facing display message, shared by
 * the campaign display shell, the map-pinned display page and their tests.
 * None names a scene.
 */
export const DISPLAY_EXPIRED =
  'This link has expired. Press Open display on your DM screen to start again.';
export const DISPLAY_IN_USE =
  'This link is open on another screen. Press Open display on your DM screen to show it here.';
/** Map-pinned page: valid link, but this map is not what is shown. */
export const DISPLAY_NOTHING_SHOWN =
  'Nothing is being shown on this map right now';
/** Campaign shell: covered (waiting, blank, switching or recovering). */
export const DISPLAY_WAITING = 'Waiting for the DM';
/** No credential at all. */
export const DISPLAY_OPEN_FROM_DM =
  'To use this screen, press Open display on your DM screen.';
export const DISPLAY_NOT_CONFIGURED =
  "The TV view isn't set up on this server.";
export const DISPLAY_STORAGE_BLOCKED =
  "This browser won't remember this link. If you reload, use Open display again.";

// ---- PR07 calibrated minis (P3, P4, P6) -----------------------------------
export const CALIBRATION_REQUIREMENTS =
  "Mini scale works on a second monitor or TV, in full screen, at 100% browser zoom. Check the scale again if you move the window to another screen, change zoom or display settings, or leave full screen. The browser can't spot every change.";
export const CALIBRATION_NEEDS_VERIFY = 'Check the scale';
export const CALIBRATION_VERIFIED = 'Scale checked';
export const CALIBRATION_UNSUPPORTED_GRID =
  'Mini scale needs a square grid on this scene. Showing the normal view.';
export const CALIBRATION_UNSUPPORTED_RANGE =
  "This scene's grid can't be matched to minis.";
export const CALIBRATION_RULER_FIRST =
  'Hold a real ruler against the outlined square on this screen.';
export const CALIBRATION_REPOSITION =
  'The map may move when you confirm. Move your minis back if needed.';
export const CALIBRATION_STORAGE_BLOCKED =
  "This browser can't save your ruler setting, so it lasts until you close this page.";
export const calibrationInstruction = (squareMm: string) =>
  `Hold a ruler against the square. Adjust until each side measures ${squareMm} mm on this screen, then Confirm.`;
export const calibrationSavedNote = (date: string) =>
  `Last ruler setting from ${date}. Check it with your ruler.`;
