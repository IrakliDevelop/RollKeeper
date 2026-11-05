import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/campaign/table/display/TableDisplayShell', () => ({
  TableDisplayShell: ({ code }: { code: string }) => (
    <div data-testid="shell">{code}</div>
  ),
}));

import TableDisplayPage, { metadata } from './page';
import nextConfig from '../../../../next.config';

describe('/table-display/[code] route (E8)', () => {
  it('renders the campaign display shell outside the DM layout', async () => {
    render(
      await TableDisplayPage({ params: Promise.resolve({ code: 'CAMP1' }) })
    );
    expect(screen.getByTestId('shell').textContent).toBe('CAMP1');
  });

  it('declares no-referrer and no indexing in its metadata', () => {
    expect(metadata.referrer).toBe('no-referrer');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('sends Referrer-Policy: no-referrer for the shell and the map-pinned display', async () => {
    const rules = await nextConfig.headers!();
    const policy = (source: string) =>
      rules
        .find(rule => rule.source === source)
        ?.headers.find(header => header.key === 'Referrer-Policy')?.value;
    expect(policy('/table-display/:path*')).toBe('no-referrer');
    expect(policy('/dm/campaign/:code/battlemaps/:id/display')).toBe(
      'no-referrer'
    );
  });
});
