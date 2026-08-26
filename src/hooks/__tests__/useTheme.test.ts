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

  it('resolves parchment when stored', async () => {
    localStorage.setItem(STORAGE_KEY, 'parchment');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(result.current.theme).toBe('parchment');
    expect(result.current.resolvedTheme).toBe('parchment');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'parchment'
    );
  });

  it('setTheme("parchment") applies attribute and persists', async () => {
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    act(() => {
      result.current.setTheme('parchment');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('parchment');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'parchment'
    );
  });

  it('system never resolves to parchment', async () => {
    localStorage.setItem(STORAGE_KEY, 'system');
    const { useThemeInit } = await import('@/hooks/useTheme');

    const { result } = renderHook(() => useThemeInit());
    await act(async () => {});

    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
    expect(
      document.documentElement.getAttribute('data-theme') ?? 'light'
    ).not.toBe('parchment');
  });
});
