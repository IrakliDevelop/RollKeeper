import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// Dynamic imports per test reset the module-level snapshot and listeners.

const KEY = 'rollkeeper-ui-prefs';

async function load() {
  return import('@/hooks/useUiPrefs');
}

function otherTabWrites(value: string | null, key: string | null = KEY) {
  if (key !== null) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } else {
    localStorage.clear();
  }
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
}

describe('parseUiPrefs', () => {
  it('returns the defaults when nothing is stored', async () => {
    const { parseUiPrefs } = await load();
    expect(parseUiPrefs(null)).toEqual({
      abilityDisplay: 'modifier',
      collapsed: {},
    });
  });

  it('reads a stored value', async () => {
    const { parseUiPrefs } = await load();
    expect(parseUiPrefs('{"abilityDisplay":"score"}')).toEqual({
      abilityDisplay: 'score',
      collapsed: {},
    });
  });

  it.each(['{not json', 'null', '[]', '"score"', '42'])(
    'returns the defaults for %s',
    async raw => {
      const { parseUiPrefs } = await load();
      expect(parseUiPrefs(raw)).toEqual({
        abilityDisplay: 'modifier',
        collapsed: {},
      });
    }
  );

  it.each(['{"abilityDisplay":1}', '{"abilityDisplay":"large"}'])(
    'falls back to the default for a bad value in %s',
    async raw => {
      const { parseUiPrefs } = await load();
      expect(parseUiPrefs(raw)).toEqual({
        abilityDisplay: 'modifier',
        collapsed: {},
      });
    }
  );

  it('ignores keys it does not know', async () => {
    const { parseUiPrefs } = await load();
    expect(parseUiPrefs('{"abilityDisplay":"score","future":1}')).toEqual({
      abilityDisplay: 'score',
      collapsed: {},
    });
  });
});

describe('mergeUiPrefs', () => {
  it('keeps keys this version does not know', async () => {
    const { mergeUiPrefs } = await load();
    expect(
      JSON.parse(
        mergeUiPrefs('{"abilityDisplay":"modifier","future":1}', {
          abilityDisplay: 'score',
        })
      )
    ).toEqual({ abilityDisplay: 'score', future: 1 });
  });

  it('starts fresh from malformed JSON', async () => {
    const { mergeUiPrefs } = await load();
    expect(
      JSON.parse(mergeUiPrefs('[1]', { abilityDisplay: 'score' }))
    ).toEqual({ abilityDisplay: 'score' });
  });
});

describe('useUiPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('starts from the defaults with nothing stored', async () => {
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    expect(result.current.prefs).toEqual({
      abilityDisplay: 'modifier',
      collapsed: {},
    });
    expect(result.current.localChange).toBe(false);
  });

  it('renders the defaults on the server', async () => {
    localStorage.setItem(KEY, '{"abilityDisplay":"score"}');
    const { useUiPrefs } = await load();
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    function Probe() {
      return createElement('span', null, useUiPrefs().prefs.abilityDisplay);
    }
    expect(renderToString(createElement(Probe))).toBe('<span>modifier</span>');
  });

  it('reads the stored preference', async () => {
    localStorage.setItem(KEY, '{"abilityDisplay":"score"}');
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    expect(result.current.prefs.abilityDisplay).toBe('score');
  });

  it('writes a change, marks it local and keeps unknown keys', async () => {
    localStorage.setItem(KEY, '{"abilityDisplay":"modifier","future":1}');
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    act(() => result.current.setPref('abilityDisplay', 'score'));
    expect(result.current.prefs.abilityDisplay).toBe('score');
    expect(result.current.localChange).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      abilityDisplay: 'score',
      future: 1,
    });
  });

  it('keeps the same prefs object across renders', async () => {
    const { useUiPrefs } = await load();
    const { result, rerender } = renderHook(() => useUiPrefs());
    act(() => result.current.setPref('abilityDisplay', 'score'));
    const first = result.current.prefs;
    rerender();
    expect(result.current.prefs).toBe(first);
  });

  it('follows a change made in another tab, not marked local', async () => {
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    act(() => result.current.setPref('abilityDisplay', 'score'));
    act(() => otherTabWrites('{"abilityDisplay":"modifier"}'));
    expect(result.current.prefs.abilityDisplay).toBe('modifier');
    expect(result.current.localChange).toBe(false);
  });

  it('keeps the same prefs when another tab writes a different key', async () => {
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    const before = result.current.prefs;
    act(() => otherTabWrites('x', 'rollkeeper-theme'));
    expect(result.current.prefs).toBe(before);
  });

  it('returns to the defaults when another tab clears storage', async () => {
    localStorage.setItem(KEY, '{"abilityDisplay":"score"}');
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    act(() => otherTabWrites(null, null));
    expect(result.current.prefs.abilityDisplay).toBe('modifier');
  });

  it('falls back to the defaults when reading storage throws', async () => {
    localStorage.setItem(KEY, '{"abilityDisplay":"score"}');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { useUiPrefs } = await load();
    const { result } = renderHook(() => useUiPrefs());
    expect(result.current.prefs.abilityDisplay).toBe('modifier');
    act(() => result.current.setPref('abilityDisplay', 'score'));
    expect(result.current.prefs.abilityDisplay).toBe('score');
  });

  it('keeps a choice for the visit when writing storage throws', async () => {
    // A full store, not a blocked one: an empty store that refuses writes
    // makes browserStorage swap in memory storage.
    localStorage.setItem('rollkeeper-theme', 'dark');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { useUiPrefs } = await load();
    const { result, rerender } = renderHook(() => useUiPrefs());
    act(() => result.current.setPref('abilityDisplay', 'score'));
    rerender();
    expect(result.current.prefs.abilityDisplay).toBe('score');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('works on the memory store that replaces blocked storage', async () => {
    // An empty store that refuses writes is blocked: browserStorage swaps in
    // memory storage when the hook module first loads it.
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      const { useUiPrefs } = await load();
      const { result } = renderHook(() => useUiPrefs());
      act(() => result.current.setPref('abilityDisplay', 'score'));
      expect(result.current.prefs.abilityDisplay).toBe('score');
      expect(window.localStorage).not.toBeInstanceOf(Storage);
      expect(window.localStorage.getItem(KEY)).toBe(
        '{"abilityDisplay":"score"}'
      );
    } finally {
      if (real) Object.defineProperty(window, 'localStorage', real);
      else delete (window as { localStorage?: Storage }).localStorage;
      document.documentElement.removeAttribute('data-storage-blocked');
    }
  });

  it('stops listening when the last subscriber unmounts', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { useUiPrefs } = await load();
    const a = renderHook(() => useUiPrefs());
    const b = renderHook(() => useUiPrefs());
    a.unmount();
    expect(remove).not.toHaveBeenCalledWith('storage', expect.any(Function));
    b.unmount();
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});

describe('collapsed section preferences', () => {
  it('validates the entire boolean map and tolerates older preferences', async () => {
    const { parseUiPrefs } = await load();
    expect(
      parseUiPrefs('{"collapsed":{"spells":true,"notes":false}}').collapsed
    ).toEqual({ spells: true, notes: false });
    for (const collapsed of [null, [], true, { spells: 'yes' }]) {
      expect(parseUiPrefs(JSON.stringify({ collapsed })).collapsed).toEqual({});
    }
  });
});

it('retains visit-local choices across preference keys when writes are refused', async () => {
  localStorage.clear();
  vi.resetModules();
  localStorage.setItem(KEY, '{"abilityDisplay":"modifier","future":1}');
  const { useUiPrefs } = await load();
  const { result } = renderHook(() => useUiPrefs());
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  act(() => result.current.setPref('collapsed', { spells: true }));
  act(() => result.current.setPref('abilityDisplay', 'score'));
  expect(result.current.prefs).toEqual({
    abilityDisplay: 'score',
    collapsed: { spells: true },
  });
  act(() =>
    result.current.setPref('collapsed', {
      ...result.current.prefs.collapsed,
      notes: true,
    })
  );
  expect(result.current.prefs.abilityDisplay).toBe('score');
  expect(result.current.prefs.collapsed).toEqual({ spells: true, notes: true });
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
    abilityDisplay: 'modifier',
    future: 1,
  });
  // A genuine external write invalidates the visit-local values.
  vi.restoreAllMocks();
  act(() =>
    otherTabWrites('{"abilityDisplay":"modifier","collapsed":{"other":true}}')
  );
  expect(result.current.prefs).toEqual({
    abilityDisplay: 'modifier',
    collapsed: { other: true },
  });
  cleanup();
  localStorage.clear();
});
