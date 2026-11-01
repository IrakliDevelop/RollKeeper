import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// We use dynamic imports in each test so that module-level state
// (currentTheme, currentResolved, listeners) is reset between tests.

const STORAGE_KEY = 'rollkeeper-theme';

// Default matchMedia stub – reports "no dark mode preference"
function mockMatchMedia(darkMode = false) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: darkMode,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(
      (_: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners.push(cb);
      }
    ),
    removeEventListener: vi.fn(
      (_: string, cb: (e: MediaQueryListEvent) => void) => {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      }
    ),
    dispatchEvent: vi.fn(),
    // Helper to fire the change event in tests
    _fireChange: (matches: boolean) => {
      const event = { matches } as unknown as MediaQueryListEvent;
      listeners.forEach(cb => cb(event));
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return mql;
}

describe('useThemeInit', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Remove any data-theme attribute left by a previous test
    document.documentElement.removeAttribute('data-theme');
    // Reset modules so module-level vars (currentTheme, currentResolved) start fresh
    vi.resetModules();
    // Default: no dark-mode preference
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists blue, restores it on remount and ignores OS changes', async () => {
    const mql = mockMatchMedia(false);
    const { useThemeInit } = await import('@/hooks/useTheme');
    const view = renderHook(() => useThemeInit());
    act(() => view.result.current.setTheme('blue'));
    expect(view.result.current.theme).toBe('blue');
    expect(view.result.current.resolvedTheme).toBe('blue');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('blue');
    act(() => mql._fireChange(true));
    expect(document.documentElement.getAttribute('data-theme')).toBe('blue');
    view.unmount();
    const restored = renderHook(() => useThemeInit());
    expect(restored.result.current.theme).toBe('blue');
    expect(restored.result.current.resolvedTheme).toBe('blue');
  });

  it('defaults to system theme when nothing is stored in localStorage', async () => {
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());

    // Before the useEffect fires, the store returns the default server snapshot
    // After effects run (act flushes them), it reads localStorage → 'system'
    await act(async () => {});

    expect(result.current.theme).toBe('system');
  });

  it('reads stored theme from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('setTheme("dark") updates theme and resolvedTheme to dark', async () => {
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('setTheme("dark") sets data-theme="dark" on document.documentElement', async () => {
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    act(() => {
      result.current.setTheme('dark');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme("light") removes the data-theme attribute', async () => {
    // Start with dark so we can verify removal
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    // Confirm dark was applied
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.setTheme('light');
    });

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('persists theme choice to localStorage', async () => {
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    act(() => {
      result.current.setTheme('dark');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    act(() => {
      result.current.setTheme('light');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('setTheme("system") resolves to system preference (dark)', async () => {
    // Simulate a system that prefers dark mode
    mockMatchMedia(true);
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('setTheme("system") resolves to system preference (light)', async () => {
    // System reports no dark-mode preference (already the default mock)
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    // First go dark, then switch back to system
    act(() => {
      result.current.setTheme('dark');
    });

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('migrates a stored parchment theme to light and writes it back', async () => {
    localStorage.setItem(STORAGE_KEY, 'parchment');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('migrates parchment to light even when the OS prefers dark', async () => {
    mockMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, 'parchment');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('clears a stale data-theme="parchment" left by an older page', async () => {
    document.documentElement.setAttribute('data-theme', 'parchment');
    localStorage.setItem(STORAGE_KEY, 'parchment');
    const { useThemeInit } = await import('@/hooks/useTheme');

    renderHook(() => useThemeInit());
    await act(async () => {});

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('still renders light when the parchment write-back fails', async () => {
    localStorage.setItem(STORAGE_KEY, 'parchment');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('parchment');
  });

  it('falls back to system for an unknown stored value without rewriting it', async () => {
    localStorage.setItem(STORAGE_KEY, 'sepia');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('system');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('sepia');
  });

  it('falls back to system when reading storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    });
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('still applies the chosen theme when saving it throws', async () => {
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('system resolves only to light or dark', async () => {
    localStorage.setItem(STORAGE_KEY, 'system');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
    expect(['light', 'dark']).toContain(
      document.documentElement.getAttribute('data-theme') ?? 'light'
    );
  });
});
