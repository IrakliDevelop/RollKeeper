import { describe, expect, it, vi } from 'vitest';

import {
  bootstrapCampaignDisplay,
  bootstrapMapPinnedDisplay,
  clearDisplayCredential,
  displayStorageKey,
  generateDisplayNonce,
  legacyDisplayStorageKey,
  scrubDisplayUrl,
  type DisplayEnvironment,
} from '../displayCredentialStore';
import {
  DISPLAY_EXPIRED,
  DISPLAY_IN_USE,
  DISPLAY_NOTHING_SHOWN,
  DISPLAY_OPEN_FROM_DM,
  DISPLAY_WAITING,
} from '../displayMessages';

const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: key => map.get(key) ?? null,
    key: index => [...map.keys()][index] ?? null,
    removeItem: key => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  };
}

function environment(
  url: string,
  storage: Storage | (() => Storage) = memoryStorage()
): DisplayEnvironment & {
  replaceState: ReturnType<typeof vi.fn>;
  current: () => string;
} {
  let current = new URL(url, 'http://dm.localhost');
  const replaceState = vi.fn(
    (_state: unknown, _title: string, next?: string | URL | null) => {
      current = new URL(String(next), current);
    }
  );
  return {
    location: {
      get hash() {
        return current.hash;
      },
      get search() {
        return current.search;
      },
      get pathname() {
        return current.pathname;
      },
    },
    history: { replaceState },
    storage: typeof storage === 'function' ? storage : () => storage,
    replaceState,
    current: () => current.pathname + current.search + current.hash,
  };
}

describe('display messages (C5-4)', () => {
  it('exports one exact constant per audience message', () => {
    expect(DISPLAY_EXPIRED).toBe(
      'This link has expired. Press Open display on your DM screen to start again.'
    );
    expect(DISPLAY_IN_USE).toBe(
      'This link is open on another screen. Press Open display on your DM screen to show it here.'
    );
    expect(DISPLAY_NOTHING_SHOWN).toBe(
      'Nothing is being shown on this map right now'
    );
    expect(DISPLAY_WAITING).toBe('Waiting for the DM');
    expect(DISPLAY_OPEN_FROM_DM).toBe(
      'To use this screen, press Open display on your DM screen.'
    );
  });
});

describe('campaign display bootstrap (E8)', () => {
  it('moves the fragment capability into sessionStorage with a fresh nonce and scrubs the URL', () => {
    const storage = memoryStorage();
    const env = environment(`/table-display/CAMP1#k=${CAPABILITY}`, storage);
    const result = bootstrapCampaignDisplay('CAMP1', env);
    expect(result).toEqual({
      status: 'ready',
      persisted: true,
      credential: { capability: CAPABILITY, nonce: expect.any(String) },
    });
    if (result.status !== 'ready') return;
    expect(result.credential.nonce).toMatch(/^[A-Za-z0-9_-]{22}$/u);
    expect(env.replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/table-display/CAMP1'
    );
    expect(env.current()).toBe('/table-display/CAMP1');
    expect(JSON.parse(storage.getItem(displayStorageKey('CAMP1'))!)).toEqual(
      result.credential
    );
  });

  it('reuses the stored capability and nonce on a same-tab reload', () => {
    const storage = memoryStorage();
    const first = bootstrapCampaignDisplay(
      'CAMP1',
      environment(`/table-display/CAMP1#k=${CAPABILITY}`, storage)
    );
    const reload = environment('/table-display/CAMP1', storage);
    const second = bootstrapCampaignDisplay('CAMP1', reload);
    expect(second).toEqual(first);
    expect(reload.replaceState).not.toHaveBeenCalled();
  });

  it('maps a malformed fragment (incl. a pre-PR05 UUID) to expired without keeping it', () => {
    const storage = memoryStorage();
    storage.setItem(
      displayStorageKey('CAMP1'),
      JSON.stringify({ capability: CAPABILITY, nonce: 'n'.repeat(22) })
    );
    for (const k of ['short', '123e4567-e89b-42d3-a456-426614174000']) {
      const env = environment(`/table-display/CAMP1#k=${k}`, storage);
      expect(bootstrapCampaignDisplay('CAMP1', env)).toEqual({
        status: 'expired',
      });
      expect(env.current()).toBe('/table-display/CAMP1');
      expect(storage.getItem(displayStorageKey('CAMP1'))).toBeNull();
    }
  });

  it('reports a missing credential and ignores malformed stored values', () => {
    const storage = memoryStorage();
    expect(
      bootstrapCampaignDisplay(
        'CAMP1',
        environment('/table-display/CAMP1', storage)
      )
    ).toEqual({ status: 'missing' });
    storage.setItem(displayStorageKey('CAMP1'), '{"capability":"x"}');
    expect(
      bootstrapCampaignDisplay(
        'CAMP1',
        environment('/table-display/CAMP1', storage)
      )
    ).toEqual({ status: 'missing' });
  });

  it('keeps the credential in memory only when sessionStorage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const env = environment(`/table-display/CAMP1#k=${CAPABILITY}`, blocked);
    const result = bootstrapCampaignDisplay('CAMP1', env);
    expect(result).toMatchObject({ status: 'ready', persisted: false });
    expect(env.current()).toBe('/table-display/CAMP1');
    const throwingSet = memoryStorage();
    throwingSet.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    expect(
      bootstrapCampaignDisplay(
        'CAMP1',
        environment(`/table-display/CAMP1#k=${CAPABILITY}`, throwingSet)
      )
    ).toMatchObject({ status: 'ready', persisted: false });
  });

  it('clears only its own campaign entry and never touches localStorage', () => {
    const storage = memoryStorage();
    const local = vi.spyOn(Storage.prototype, 'setItem');
    bootstrapCampaignDisplay(
      'CAMP1',
      environment(`/table-display/CAMP1#k=${CAPABILITY}`, storage)
    );
    storage.setItem(displayStorageKey('OTHER'), 'x');
    clearDisplayCredential('CAMP1', environment('/x', storage));
    expect(storage.getItem(displayStorageKey('CAMP1'))).toBeNull();
    expect(storage.getItem(displayStorageKey('OTHER'))).toBe('x');
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });

  it('generates 128-bit base64url nonces', () => {
    const nonces = new Set(
      Array.from({ length: 20 }, () => generateDisplayNonce())
    );
    expect(nonces.size).toBe(20);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/u);
  });
});

describe('map-pinned display bootstrap (E8, C5-4)', () => {
  const path = '/dm/campaign/CAMP1/battlemaps/map-1/display';

  it('v1: consumes ?dk into the campaign entry with a fresh nonce and scrubs the query', () => {
    const storage = memoryStorage();
    const env = environment(`${path}?dk=${CAPABILITY}`, storage);
    const result = bootstrapMapPinnedDisplay('CAMP1', true, env);
    expect(result).toMatchObject({
      status: 'ready',
      credential: { capability: CAPABILITY },
    });
    expect(env.current()).toBe(path);
    expect(storage.getItem(displayStorageKey('CAMP1'))).not.toBeNull();
    // Reload after the scrub keeps the consumed credential.
    expect(
      bootstrapMapPinnedDisplay('CAMP1', true, environment(path, storage))
    ).toEqual(result);
  });

  it('v1: a pre-PR05 UUID key is expired with no stored credential', () => {
    const storage = memoryStorage();
    const env = environment(
      `${path}?dk=123e4567-e89b-42d3-a456-426614174000`,
      storage
    );
    expect(bootstrapMapPinnedDisplay('CAMP1', true, env)).toEqual({
      status: 'expired',
    });
    expect(env.current()).toBe(path);
    expect(storage.length).toBe(0);
  });

  it('flag off: keeps the legacy key under its own entry and still scrubs the URL', () => {
    const storage = memoryStorage();
    const env = environment(`${path}?dk=legacy-uuid-key`, storage);
    expect(bootstrapMapPinnedDisplay('CAMP1', false, env)).toEqual({
      status: 'legacy',
      displayKey: 'legacy-uuid-key',
    });
    expect(env.current()).toBe(path);
    expect(storage.getItem(legacyDisplayStorageKey('CAMP1'))).toBe(
      'legacy-uuid-key'
    );
    expect(storage.getItem(displayStorageKey('CAMP1'))).toBeNull();
    expect(
      bootstrapMapPinnedDisplay('CAMP1', false, environment(path, storage))
    ).toEqual({ status: 'legacy', displayKey: 'legacy-uuid-key' });
  });
});

describe('scrubDisplayUrl (post-hydration re-scrub)', () => {
  it('removes a restored fragment or ?dk and leaves clean URLs alone', () => {
    for (const url of [
      `/table-display/C#k=${CAPABILITY}`,
      '/x/display?dk=key',
    ]) {
      const env = environment(url);
      scrubDisplayUrl(env);
      expect(env.current()).toBe(new URL(url, 'http://h').pathname);
    }
    const clean = environment('/table-display/C');
    scrubDisplayUrl(clean);
    expect(clean.replaceState).not.toHaveBeenCalled();
  });
});
