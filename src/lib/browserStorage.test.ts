import { afterEach, describe, expect, it } from 'vitest';

import {
  installStorageFallback,
  isStorageInMemoryOnly,
  readBrowserLocalStorage,
  storageFallbackScript,
} from '@/lib/browserStorage';

type StorageName = 'localStorage' | 'sessionStorage';

const originals = {
  localStorage: Object.getOwnPropertyDescriptor(window, 'localStorage')!,
  sessionStorage: Object.getOwnPropertyDescriptor(window, 'sessionStorage')!,
};

function blockStorage(name: StorageName) {
  Object.defineProperty(window, name, {
    configurable: true,
    enumerable: true,
    get() {
      throw new DOMException(
        `Failed to read the '${name}' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.`,
        'SecurityError'
      );
    },
  });
}

function replaceStorage(name: StorageName, storage: Storage) {
  Object.defineProperty(window, name, {
    configurable: true,
    enumerable: true,
    get: () => storage,
  });
}

function rejectingWrites(base: Storage): Storage {
  return {
    get length() {
      return base.length;
    },
    key: index => base.key(index),
    getItem: key => base.getItem(key),
    setItem: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
    removeItem: key => base.removeItem(key),
    clear: () => base.clear(),
  };
}

afterEach(() => {
  Object.defineProperty(window, 'localStorage', originals.localStorage);
  Object.defineProperty(window, 'sessionStorage', originals.sessionStorage);
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute('data-storage-blocked');
});

describe('readBrowserLocalStorage', () => {
  it('returns the window storage when access is allowed', () => {
    expect(readBrowserLocalStorage()).toBe(window.localStorage);
  });

  it('returns undefined when reading the property throws', () => {
    blockStorage('localStorage');
    expect(readBrowserLocalStorage()).toBeUndefined();
  });
});

describe.each([
  ['installStorageFallback', () => installStorageFallback(window)],
  ['storageFallbackScript', () => new Function(storageFallbackScript)()],
])('%s', (_label, install) => {
  it('leaves working storage alone', () => {
    const native = window.localStorage;
    install();
    expect(window.localStorage).toBe(native);
    expect(window.localStorage.length).toBe(0);
    expect(isStorageInMemoryOnly()).toBe(false);
  });

  it('replaces storage that throws on access with a working memory store', () => {
    blockStorage('localStorage');
    blockStorage('sessionStorage');
    install();

    localStorage.setItem('rollkeeper-player-data', '{"state":{}}');
    sessionStorage.setItem('shop-spend', '3');
    expect(localStorage.getItem('rollkeeper-player-data')).toBe('{"state":{}}');
    expect(window.sessionStorage.getItem('shop-spend')).toBe('3');
    expect(isStorageInMemoryOnly()).toBe(true);
  });

  it('replaces an empty storage that rejects every write', () => {
    replaceStorage('localStorage', rejectingWrites(window.localStorage));
    install();
    localStorage.setItem('rollkeeper-theme', 'dark');
    expect(localStorage.getItem('rollkeeper-theme')).toBe('dark');
    expect(isStorageInMemoryOnly()).toBe(true);
  });

  it('keeps a full storage, whose quota errors are reported elsewhere', () => {
    window.localStorage.setItem('rollkeeper-player-data', '{}');
    const full = rejectingWrites(window.localStorage);
    replaceStorage('localStorage', full);
    install();
    expect(window.localStorage).toBe(full);
    expect(isStorageInMemoryOnly()).toBe(false);
  });

  it('gives the memory store the Storage API that the app relies on', () => {
    blockStorage('localStorage');
    install();

    localStorage.setItem('a', 'one');
    localStorage.setItem('b', 2 as unknown as string);
    expect(localStorage.getItem('b')).toBe('2');
    expect(localStorage.getItem('missing')).toBeNull();
    expect(localStorage.length).toBe(2);
    expect(localStorage.key(0)).toBe('a');
    expect(localStorage.key(5)).toBeNull();
    expect(Object.keys(localStorage)).toEqual(['a', 'b']);
    expect('a' in localStorage).toBe(true);

    localStorage.removeItem('a');
    expect(Object.keys(localStorage)).toEqual(['b']);
    localStorage.clear();
    expect(localStorage.length).toBe(0);
  });

  it('is idempotent once the memory store is in place', () => {
    blockStorage('localStorage');
    install();
    const memory = window.localStorage;
    memory.setItem('kept', 'yes');
    install();
    expect(window.localStorage).toBe(memory);
    expect(localStorage.getItem('kept')).toBe('yes');
  });
});
