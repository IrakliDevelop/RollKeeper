/**
 * This receive site's role for `attachFocusReceiver`. Lives in its own
 * module (not exported from `page.tsx`) because Next.js's app-router page
 * type only permits a fixed set of named exports (`default`, `metadata`,
 * `generateStaticParams`, ...) — anything else fails `next`'s generated
 * page-type check.
 *
 * Pulled out to a named, directly-assertable constant — swapping this
 * literal with the player canvas's `PLAYER_FOCUS_OPTIONS` would otherwise
 * pass type-check, lint, and every test while making a DM's "send to the
 * TV" move every player's camera instead. See page.focusOptions.test.ts.
 */
export const DISPLAY_FOCUS_OPTIONS = {
  role: 'display',
  color: '#F4C430',
} as const;
