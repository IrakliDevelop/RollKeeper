import { describe, it, expect, vi } from 'vitest';
import {
  createSafeStorage,
  isQuotaExceeded,
  STORAGE_QUOTA_EVENT,
} from '../safeStorage';

function mockBacking(setItemImpl?: (k: string, v: string) => void): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: setItemImpl ?? ((k: string, v: string) => map.set(k, v)),
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

function quotaError(): DOMException {
  return new DOMException('quota', 'QuotaExceededError');
}

describe('isQuotaExceeded', () => {
  it('recognises a QuotaExceededError DOMException', () => {
    expect(isQuotaExceeded(quotaError())).toBe(true);
  });
  it('rejects unrelated errors', () => {
    expect(isQuotaExceeded(new Error('nope'))).toBe(false);
  });
});

describe('createSafeStorage', () => {
  it('delegates get/set/remove to the backing storage', () => {
    const storage = createSafeStorage(mockBacking());
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('on quota error: fires the quota event and does NOT throw', () => {
    const storage = createSafeStorage(
      mockBacking(() => {
        throw quotaError();
      })
    );
    const listener = vi.fn();
    window.addEventListener(STORAGE_QUOTA_EVENT, listener);
    expect(() => storage.setItem('big', 'x')).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(STORAGE_QUOTA_EVENT, listener);
  });

  it('rethrows non-quota errors', () => {
    const storage = createSafeStorage(
      mockBacking(() => {
        throw new Error('boom');
      })
    );
    expect(() => storage.setItem('k', 'v')).toThrow('boom');
  });
});
