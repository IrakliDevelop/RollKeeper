/**
 * Browser storage access for documents that may not have any.
 *
 * In a document without storage access (an opaque-origin sandboxed iframe, or
 * site data blocked in browser settings) merely reading `window.localStorage`
 * throws a SecurityError, and so does `typeof localStorage`, so neither works
 * as a guard. RollKeeper then runs on in-memory storage for the session: the
 * pre-hydration `storageFallbackScript` swaps in a memory store before any
 * app code runs, and marks `<html data-storage-blocked>` for the banner that
 * tells the user nothing is being saved.
 */

const BLOCKED_ATTRIBUTE = 'data-storage-blocked';

/**
 * Replaces localStorage and sessionStorage with a memory store when the
 * browser refuses them: access throws, or an empty storage rejects a write. A
 * write that fails while other entries exist is a full quota, which
 * `createSafeStorage` reports separately, so that storage is kept.
 *
 * Keep this function self-contained: `storageFallbackScript` serialises it
 * into an inline script, where nothing from this module is in scope.
 */
export function installStorageFallback(win: Window): void {
  function isBlocked(name: 'localStorage' | 'sessionStorage'): boolean {
    let storage: Storage;
    try {
      storage = win[name];
    } catch {
      return true;
    }
    if (!storage) return true;
    try {
      storage.setItem('rollkeeper:storage-probe', '1');
      storage.removeItem('rollkeeper:storage-probe');
      return false;
    } catch {
      try {
        return storage.length === 0;
      } catch {
        return true;
      }
    }
  }

  function createMemoryStorage(): Storage {
    const items = new Map<string, string>();
    const api = {
      get length() {
        return items.size;
      },
      key(index: number) {
        const keys = Array.from(items.keys());
        return index >= 0 && index < keys.length ? keys[index] : null;
      },
      getItem(key: string) {
        const value = items.get(String(key));
        return value === undefined ? null : value;
      },
      setItem(key: string, value: string) {
        items.set(String(key), String(value));
      },
      removeItem(key: string) {
        items.delete(String(key));
      },
      clear() {
        items.clear();
      },
    };
    // Real Storage exposes its entries as own properties (Object.keys, `in`).
    return new Proxy(api, {
      ownKeys: () => Array.from(items.keys()),
      getOwnPropertyDescriptor: (_target, key) =>
        typeof key === 'string' && items.has(key)
          ? {
              value: items.get(key),
              writable: true,
              enumerable: true,
              configurable: true,
            }
          : undefined,
      has: (target, key) =>
        key in target || (typeof key === 'string' && items.has(key)),
    }) as unknown as Storage;
  }

  const names = ['localStorage', 'sessionStorage'] as const;
  for (const name of names) {
    if (!isBlocked(name)) continue;
    try {
      Object.defineProperty(win, name, {
        configurable: true,
        enumerable: true,
        value: createMemoryStorage(),
      });
    } catch {
      continue;
    }
    if (name === 'localStorage') {
      win.document.documentElement.setAttribute('data-storage-blocked', '');
    }
  }
}

/** Inline pre-hydration script that runs `installStorageFallback`. */
export const storageFallbackScript = `(${installStorageFallback.toString()})(window);`;

/** True when this session runs on memory storage because the browser blocks it. */
export function isStorageInMemoryOnly(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.hasAttribute(BLOCKED_ATTRIBUTE)
  );
}

/**
 * The window's localStorage, or undefined when there is none or the browser
 * refuses access and no memory store has been installed.
 */
export function readBrowserLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// Backstop for the inline script: every persisted store imports this module
// (through safeStorage) before it first reads storage.
if (typeof window !== 'undefined') installStorageFallback(window);
