'use client';

import { useSyncExternalStore } from 'react';
import { readBrowserLocalStorage } from '@/lib/browserStorage';

/**
 * Per-device display preferences, in their own localStorage key. Not part
 * of PlayerSettings (that persists through the character storage and its
 * revisions), not per character, not cloud-synced. Future UI preferences
 * go here too.
 */
export const UI_PREFS_KEY = 'rollkeeper-ui-prefs';

export interface UiPrefs {
  /** Which number an ability shows large: the modifier or the score. */
  abilityDisplay: 'modifier' | 'score';
}

export const DEFAULT_UI_PREFS: UiPrefs = { abilityDisplay: 'modifier' };

type Validators = { [K in keyof UiPrefs]: (value: unknown) => boolean };

const VALIDATORS: Validators = {
  abilityDisplay: value => value === 'modifier' || value === 'score',
};

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/**
 * The stored JSON merged over the defaults. Each known field keeps its
 * stored value only when it is valid; anything else (malformed JSON, a
 * wrong type, an unknown value) falls back to the default.
 */
export function parseUiPrefs(raw: string | null): UiPrefs {
  const stored = parseObject(raw) ?? {};
  const prefs = { ...DEFAULT_UI_PREFS };
  for (const key of Object.keys(VALIDATORS) as (keyof UiPrefs)[]) {
    if (VALIDATORS[key](stored[key])) {
      prefs[key] = stored[key] as UiPrefs[typeof key];
    }
  }
  return prefs;
}

/**
 * The JSON to store after applying `patch`. Keys this version doesn't know
 * are kept, so an older tab doesn't wipe a newer preference.
 */
export function mergeUiPrefs(
  raw: string | null,
  patch: Partial<UiPrefs>
): string {
  return JSON.stringify({ ...(parseObject(raw) ?? {}), ...patch });
}

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------

interface UiPrefsSnapshot {
  prefs: UiPrefs;
  /** True when the latest change came from `setPref` in this tab. */
  localChange: boolean;
}

const SERVER_SNAPSHOT: UiPrefsSnapshot = {
  prefs: DEFAULT_UI_PREFS,
  localChange: false,
};

let listeners: Array<() => void> = [];
// What storage held when `cached` was built; undefined before the first read.
let observedRaw: string | null | undefined;
let cached: UiPrefsSnapshot = SERVER_SNAPSHOT;

function readRaw(): string | null {
  try {
    return readBrowserLocalStorage()?.getItem(UI_PREFS_KEY) ?? null;
  } catch {
    return null;
  }
}

function emitChange() {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent) {
  // key is null when another tab clears storage.
  if (event.key === UI_PREFS_KEY || event.key === null) emitChange();
}

function subscribe(listener: () => void) {
  if (listeners.length === 0) window.addEventListener('storage', handleStorage);
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter(l => l !== listener);
    if (listeners.length === 0) {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

// Re-parses only when the stored string changes, so the snapshot keeps its
// identity between renders (useSyncExternalStore loops otherwise).
function getSnapshot(): UiPrefsSnapshot {
  const raw = readRaw();
  if (raw !== observedRaw) {
    observedRaw = raw;
    cached = { prefs: parseUiPrefs(raw), localChange: false };
  }
  return cached;
}

function getServerSnapshot(): UiPrefsSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Change one preference on this device; other open tabs follow. When the
 * browser refuses the write, the choice holds for this visit until the
 * stored value itself changes (another tab writing the key; a clear that
 * leaves it as unset as before does not count).
 */
export function setPref<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) {
  const next = mergeUiPrefs(readRaw(), { [key]: value } as Partial<UiPrefs>);
  try {
    readBrowserLocalStorage()?.setItem(UI_PREFS_KEY, next);
  } catch {
    // Storage is full or blocked: the choice still applies for this visit.
  }
  observedRaw = readRaw();
  cached = { prefs: parseUiPrefs(next), localChange: true };
  emitChange();
}

export interface UseUiPrefs extends UiPrefsSnapshot {
  setPref: typeof setPref;
}

/**
 * This device's UI preferences. The server render and the first client
 * render use the defaults; stored values apply right after hydration.
 * `localChange` tells animations apart from corrections: only a change made
 * here with `setPref` is true.
 */
export function useUiPrefs(): UseUiPrefs {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return { ...snapshot, setPref };
}
