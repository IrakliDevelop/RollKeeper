import { expect, it } from 'vitest';
import { parseThemePreference } from '../themePreference';

it.each(['light', 'dark', 'blue', 'system'] as const)(
  'reads saved theme %s',
  theme => expect(parseThemePreference(theme)).toBe(theme)
);
it.each([undefined, null, '', 'parchment', 'unknown', 1, {}, ['blue']])(
  'follows the app for older or invalid value %j',
  value => expect(parseThemePreference(value)).toBeUndefined()
);
