import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { themeScript } from './themeScript';

const STORAGE_KEY = 'rollkeeper-theme';

function runThemeScript({ osPrefersDark = false } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: osPrefersDark }),
  });
  new Function(themeScript)();
}

describe('themeScript (pre-hydration)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies a stored dark theme', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    runThemeScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows a dark OS when nothing is stored', () => {
    runThemeScript({ osPrefersDark: true });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('migrates a stored parchment theme to light and writes it back', () => {
    localStorage.setItem(STORAGE_KEY, 'parchment');
    runThemeScript();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('keeps a parchment user on light when the OS prefers dark', () => {
    localStorage.setItem(STORAGE_KEY, 'parchment');
    runThemeScript({ osPrefersDark: true });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('keeps a parchment user on light when the write-back fails', () => {
    localStorage.setItem(STORAGE_KEY, 'parchment');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    runThemeScript({ osPrefersDark: true });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
