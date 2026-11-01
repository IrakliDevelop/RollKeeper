/**
 * Inline script that runs BEFORE React hydrates to prevent
 * a flash of wrong theme (FOUC). It reads localStorage or
 * the system preference and sets data-theme on <html>.
 *
 * The retired parchment theme migrates to light and is written back.
 * Keep this in step with getStoredTheme in src/hooks/useTheme.ts.
 */
export const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('rollkeeper-theme');
    if (stored === 'parchment') {
      stored = 'light';
      try {
        localStorage.setItem('rollkeeper-theme', stored);
      } catch (e) {}
    }
    var theme = stored === 'dark' || stored === 'blue' || stored === 'light' ? stored : null;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme !== 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {}
})();
`;
