import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType, ReactNode } from 'react';

// Root-layout composition rendered for the main routes while the browser
// blocks site storage, as in an `<iframe sandbox="allow-scripts">` where even
// reading `window.localStorage` throws.

const navigation = vi.hoisted(() => ({
  pathname: '/',
  params: {} as Record<string, string>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => navigation.params,
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

const ROUTES = [
  { path: '/', page: () => import('@/app/page') },
  { path: '/resources', page: () => import('@/app/resources/page') },
  { path: '/player', page: () => import('@/app/player/page') },
  {
    path: '/player/characters/new',
    page: () => import('@/app/player/characters/new/page'),
  },
  {
    path: '/player/characters/[characterId]',
    params: { characterId: 'missing-character' },
    page: () => import('@/app/player/characters/[characterId]/page'),
  },
  { path: '/dm', page: () => import('@/app/dm/page') },
] as const;

const FLAG_SETS = [
  ['default flags', {}],
  [
    'character cutover enabled',
    {
      NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED: 'true',
      NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE: 'true',
    },
  ],
  [
    'IndexedDB migration enabled',
    { NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED: 'true' },
  ],
] as const;

const originals = {
  localStorage: Object.getOwnPropertyDescriptor(window, 'localStorage')!,
  sessionStorage: Object.getOwnPropertyDescriptor(window, 'sessionStorage')!,
};

function blockStorage() {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
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
}

async function renderRoot(route: (typeof ROUTES)[number]) {
  navigation.pathname = route.path;
  navigation.params = 'params' in route ? { ...route.params } : {};
  const [{ ThemeProviderWrapper }, { StorageBlockedBanner }, boot, eb, page] =
    await Promise.all([
      import('@/app/ThemeProviderWrapper'),
      import('@/components/ui/feedback/StorageBlockedBanner'),
      import('@/components/PersistenceBootstrap'),
      import('@/components/ui/feedback/ErrorBoundary'),
      route.page(),
    ]);
  const ErrorBoundary = eb.default as ComponentType<{ children: ReactNode }>;
  const Page = page.default as ComponentType;
  render(
    <ThemeProviderWrapper>
      <StorageBlockedBanner />
      <boot.PersistenceBootstrap>
        <ErrorBoundary>
          <Page />
        </ErrorBoundary>
      </boot.PersistenceBootstrap>
    </ThemeProviderWrapper>
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  Object.defineProperty(window, 'localStorage', originals.localStorage);
  Object.defineProperty(window, 'sessionStorage', originals.sessionStorage);
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-storage-blocked');
});

describe.each(FLAG_SETS)('blocked browser storage (%s)', (_label, env) => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  });

  it.each(ROUTES)('renders $path on memory storage', async route => {
    blockStorage();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await renderRoot(route);

    expect(screen.queryByText(/Reality\.exe|has stopped working/i)).toBeNull();
    expect(errors).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SecurityError' })
    );
    if (route.path === '/') {
      expect(screen.queryByText(/Site storage is blocked/)).toBeNull();
    } else {
      expect(
        screen.getByText(
          'Site storage is blocked, so nothing here will be saved.'
        )
      ).toBeInTheDocument();
    }
  });
});

describe('blocked browser storage that cannot be replaced', () => {
  it('still renders the player list', async () => {
    blockStorage();
    const defineProperty = Object.defineProperty;
    vi.spyOn(Object, 'defineProperty').mockImplementation(
      (target, key, attributes) => {
        if (
          target === window &&
          (key === 'localStorage' || key === 'sessionStorage')
        ) {
          throw new TypeError(`Cannot redefine property: ${String(key)}`);
        }
        return defineProperty(target, key, attributes);
      }
    );
    await expect(renderRoot(ROUTES[2])).resolves.toBeUndefined();
    expect(screen.queryByText(/Reality\.exe|has stopped working/i)).toBeNull();
  });
});
