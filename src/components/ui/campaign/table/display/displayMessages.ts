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
