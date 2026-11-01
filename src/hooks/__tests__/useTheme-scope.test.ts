import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function systemPreference() {
  const listeners: Array<() => void> = [];
  const mql = {
    matches: false,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  };
  vi.stubGlobal('matchMedia', () => mql);
  return (dark: boolean) => {
    mql.matches = dark;
    act(() => listeners.forEach(listener => listener()));
  };
}

it('keeps the app choice separate, restores the latest choice, and ignores stale cleanup', async () => {
  systemPreference();
  localStorage.setItem('rollkeeper-theme', 'dark');
  const api = await import('../useTheme');
  const { result } = renderHook(() => api.useThemeInit());
  const first = {},
    second = {};
  act(() => api.registerCharacterThemeScope(first, 'one', 'blue'));
  expect(result.current.resolvedTheme).toBe('blue');
  expect(result.current.theme).toBe('dark');
  act(() => result.current.setTheme('light'));
  expect(localStorage.getItem('rollkeeper-theme')).toBe('light');
  expect(result.current.resolvedTheme).toBe('blue');
  act(() => api.registerCharacterThemeScope(second, 'two', 'dark'));
  act(() => api.clearCharacterThemeScope(first));
  expect(result.current.characterScope?.characterId).toBe('two');
  expect(result.current.resolvedTheme).toBe('dark');
  act(() => api.clearCharacterThemeScope(second));
  expect(result.current.characterScope).toBeNull();
  expect(result.current.resolvedTheme).toBe('light');
});

it('resolves a character system choice independently of a fixed app theme', async () => {
  const setDark = systemPreference();
  localStorage.setItem('rollkeeper-theme', 'blue');
  const api = await import('../useTheme');
  const { result } = renderHook(() => api.useThemeInit());
  const owner = {};
  act(() => api.registerCharacterThemeScope(owner, 'one', 'system'));
  expect(result.current.resolvedTheme).toBe('light');
  setDark(true);
  expect(result.current.resolvedTheme).toBe('dark');
  act(() => api.registerCharacterThemeScope(owner, 'one', undefined));
  expect(result.current.resolvedTheme).toBe('blue');
  setDark(false);
  expect(result.current.resolvedTheme).toBe('blue');
  expect(localStorage.getItem('rollkeeper-theme')).toBe('blue');
});

it('retains a scope registered before the provider hydration effect', async () => {
  systemPreference();
  localStorage.setItem('rollkeeper-theme', 'light');
  const api = await import('../useTheme');
  const owner = {};
  api.registerCharacterThemeScope(owner, 'one', 'dark');
  const { result } = renderHook(() => api.useThemeInit());
  expect(result.current.theme).toBe('light');
  expect(result.current.resolvedTheme).toBe('dark');
  act(() => api.clearCharacterThemeScope(owner));
  expect(result.current.resolvedTheme).toBe('light');
});
