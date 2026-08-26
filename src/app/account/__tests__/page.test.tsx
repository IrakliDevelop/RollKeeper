import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectCloudProductVocabulary } from '@/test/helpers';

import AccountPage, { safeAccountReturnTo } from '../page';

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  };
});

/**
 * `AccountPage` is an async Server Component (no props, no `params`). React
 * cannot client-render an async component via `render(<AccountPage />)`
 * outside the RSC pipeline, so it is called directly as the plain async
 * function it is and its resolved JSX is rendered -- same pattern as
 * `src/app/dm/migrate/[code]/__tests__/page.test.tsx`.
 */
async function renderPage(returnTo?: string) {
  const element = await AccountPage({
    searchParams: Promise.resolve(returnTo ? { returnTo } : {}),
  });
  return render(element);
}

describe('AccountPage', () => {
  it('uses R17-clean product vocabulary ("this browser", never "device")', async () => {
    const { container } = await renderPage();
    await screen.findByText(/stay on this browser/i);
    // Coordinator review round 1, Minor 4: this surface's copy changed
    // ("stay on this device" -> "stay on this browser") with no vocabulary
    // guard and no test file at all.
    expectCloudProductVocabulary(container);
  });

  it('accepts only the exact player backup return path', async () => {
    expect(safeAccountReturnTo('/player/backup')).toBe('/player/backup');

    for (const unsafe of [
      '//example.com',
      'https://example.com',
      '/player/backup/extra',
      '/player/backup?next=https://example.com',
    ]) {
      expect(safeAccountReturnTo(unsafe)).toBeNull();
    }
  });
});
