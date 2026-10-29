import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppHeader } from './index';
vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('renders one banner with slots and publishes its full observed height', () => {
  let publish = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        publish = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  const { unmount } = render(
    <AppHeader
      sticky
      leading={<a href="/player">Characters</a>}
      title={<h1>Brin</h1>}
      actions={<button>Edit sheet</button>}
      subbar={<p>Editing sheet</p>}
      nav={<a href="/resources">Resources</a>}
    />
  );
  const bar = screen.getByRole('banner');
  expect(bar).toHaveClass('sticky');
  expect(bar).toContainElement(screen.getByText('Editing sheet'));
  expect(screen.getByRole('link', { name: 'RollKeeper home' })).toHaveAttribute(
    'href',
    '/'
  );
  vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
    height: 128,
  } as DOMRect);
  publish();
  expect(
    document.documentElement.style.getPropertyValue('--app-header-height')
  ).toBe('128px');
  unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(
    document.documentElement.style.getPropertyValue('--app-header-height')
  ).toBe('');
});
