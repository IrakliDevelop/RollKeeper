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
/** PR08 desktop B4: a hidden tab renders nothing, so it cannot show the map. */
export const DISPLAY_KEEP_VISIBLE = 'Keep this screen visible to show the map.';
/** No credential at all. */
export const DISPLAY_OPEN_FROM_DM =
  'To use this screen, press Open display on your DM screen.';
export const DISPLAY_NOT_CONFIGURED =
  "The TV view isn't set up on this server.";
export const DISPLAY_STORAGE_BLOCKED =
  "This browser won't remember this link. If you reload, use Open display again.";
