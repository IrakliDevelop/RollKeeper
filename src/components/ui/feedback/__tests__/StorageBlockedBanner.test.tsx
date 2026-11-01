import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageBlockedBanner } from '@/components/ui/feedback/StorageBlockedBanner';

const navigation = vi.hoisted(() => ({ pathname: '/player' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

function markStorageBlocked() {
  document.documentElement.setAttribute('data-storage-blocked', '');
}

describe('StorageBlockedBanner', () => {
  beforeEach(() => {
    navigation.pathname = '/player';
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-storage-blocked');
    vi.unstubAllGlobals();
  });

  it('renders nothing while browser storage works', () => {
    const { container } = render(<StorageBlockedBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing will be saved when storage is blocked', () => {
    markStorageBlocked();
    render(<StorageBlockedBanner />);

    expect(
      screen.getByText(
        'Site storage is blocked, so nothing here will be saved.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Characters and campaigns you create disappear when this page closes or reloads.'
      )
    ).toBeInTheDocument();
  });

  it('stays off the landing page, where nothing is created', () => {
    markStorageBlocked();
    navigation.pathname = '/';
    const { container } = render(<StorageBlockedBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('cannot be dismissed', () => {
    markStorageBlocked();
    render(<StorageBlockedBanner />);
    expect(
      screen.queryByRole('button', { name: /dismiss|close/i })
    ).not.toBeInTheDocument();
  });

  it('reveals how to allow storage on request', () => {
    markStorageBlocked();
    render(<StorageBlockedBanner />);
    const toggle = screen.getByRole('button', {
      name: 'How to allow storage',
    });
    const howTo =
      'Allow cookies and site data for this site in your browser settings, then reload. If RollKeeper is open inside another page, open it in its own tab.';

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(howTo)).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(howTo)).toBeInTheDocument();
    expect(toggle).toHaveAttribute(
      'aria-controls',
      screen.getByText(howTo).closest('[id]')!.id
    );
  });

  it('reloads the page from the instructions', () => {
    markStorageBlocked();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<StorageBlockedBanner />);

    fireEvent.click(
      screen.getByRole('button', { name: 'How to allow storage' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
