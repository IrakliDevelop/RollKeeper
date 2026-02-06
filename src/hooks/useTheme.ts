'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The user-chosen preference: 'light', 'dark', or 'system'. */
  theme: Theme;
  /** The actual applied theme after resolving 'system'. */
  resolvedTheme: ResolvedTheme;
  /** Change the theme preference. */
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'rollkeeper-theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return getSystemPreference();
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

// ---------------------------------------------------------------------------
// External store for SSR-safe subscription
// ---------------------------------------------------------------------------

let listeners: Array<() => void> = [];
let currentTheme: Theme = 'system';
let currentResolved: ResolvedTheme = 'light';

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshotTheme(): Theme {
  return currentTheme;
}

function getSnapshotResolved(): ResolvedTheme {
  return currentResolved;
}

function getServerSnapshotTheme(): Theme {
  return 'system';
}

function getServerSnapshotResolved(): ResolvedTheme {
  return 'light';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current theme and change it.
 *
 * Must be used inside a component tree wrapped with `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Initialise theme from localStorage + system preference and listen for
 * changes. Call this ONCE in a top-level client component.
 *
 * Returns { theme, resolvedTheme, setTheme } – pass into ThemeContext.Provider.
 */
export function useThemeInit(): ThemeContextValue {
  // Hydrate the store on first client render
  useEffect(() => {
    const stored = getStoredTheme();
    const resolved = resolveTheme(stored);
    currentTheme = stored;
    currentResolved = resolved;
    applyTheme(resolved);
    emitChange();

    // Listen for system preference changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (currentTheme === 'system') {
        currentResolved = getSystemPreference();
        applyTheme(currentResolved);
        emitChange();
      }
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const theme = useSyncExternalStore(
    subscribe,
    getSnapshotTheme,
    getServerSnapshotTheme
  );
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    getSnapshotResolved,
    getServerSnapshotResolved
  );

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    currentTheme = next;
    currentResolved = resolveTheme(next);
    applyTheme(currentResolved);
    emitChange();
  }, []);

  return { theme, resolvedTheme, setTheme };
}
