'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';

import type { Theme, ResolvedTheme } from '@/types/theme';
export type { Theme, ResolvedTheme } from '@/types/theme';

export interface CharacterThemeScopeValue {
  characterId: string;
  theme: Theme | undefined;
}

interface ThemeContextValue {
  /** The user-chosen preference: 'light', 'dark', 'blue', or 'system'. */
  theme: Theme;
  characterScope: CharacterThemeScopeValue | null;
  /** The actual applied theme after resolving 'system'. */
  resolvedTheme: ResolvedTheme;
  /** Change the theme preference. */
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'rollkeeper-theme';

/** Retired in Felt and Brass 1b. A stored value migrates to 'light'. */
const RETIRED_PARCHMENT = 'parchment';

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
  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage is blocked: follow the system preference for this visit.
    return 'system';
  }
  if (stored === RETIRED_PARCHMENT) {
    // Paper replaces parchment. Write it back so later reads, including the
    // pre-hydration script in themeScript.ts, see 'light'.
    try {
      localStorage.setItem(STORAGE_KEY, 'light');
    } catch {
      // Storage is full or blocked: still render paper for this visit.
    }
    return 'light';
  }
  if (
    stored === 'light' ||
    stored === 'dark' ||
    stored === 'blue' ||
    stored === 'system'
  ) {
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
  if (resolved === 'light') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', resolved);
  }
}

// ---------------------------------------------------------------------------
// External store for SSR-safe subscription
// ---------------------------------------------------------------------------

let listeners: Array<() => void> = [];
let currentTheme: Theme = 'system';
let currentResolved: ResolvedTheme = 'light';
let characterScope: (CharacterThemeScopeValue & { owner: object }) | null =
  null;

function applyCurrentTheme() {
  currentResolved = resolveTheme(characterScope?.theme ?? currentTheme);
  applyTheme(currentResolved);
  emitChange();
}

/** Route scope is visit-local; only setTheme writes the app preference. */
export function registerCharacterThemeScope(
  owner: object,
  characterId: string,
  theme: Theme | undefined
) {
  characterScope = { owner, characterId, theme };
  applyCurrentTheme();
}

export function clearCharacterThemeScope(owner: object) {
  if (characterScope?.owner !== owner) return;
  characterScope = null;
  applyCurrentTheme();
}

function getSnapshotScope() {
  return characterScope;
}
function getServerSnapshotScope() {
  return null;
}

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
  characterScope: null,
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
    currentTheme = stored;
    applyCurrentTheme();

    // Listen for system preference changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if ((characterScope?.theme ?? currentTheme) === 'system')
        applyCurrentTheme();
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
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage is full or blocked: the choice still applies for this visit.
    }
    currentTheme = next;
    applyCurrentTheme();
  }, []);

  const scope = useSyncExternalStore(
    subscribe,
    getSnapshotScope,
    getServerSnapshotScope
  );
  return { theme, resolvedTheme, setTheme, characterScope: scope };
}
