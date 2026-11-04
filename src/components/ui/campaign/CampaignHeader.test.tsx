import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CampaignHeader } from './CampaignHeader';

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));

afterEach(cleanup);

it('renders the crumb as a link named by its label', () => {
  render(
    <CampaignHeader
      crumb={{ href: '/dm', label: 'Campaigns' }}
      title={<h1>The Sunken Bell</h1>}
    />
  );
  const link = screen.getByRole('link', { name: 'Campaigns' });
  expect(link).toHaveAttribute('href', '/dm');
  expect(within(link).getByText('Campaigns')).toHaveClass(
    'sr-only',
    'sm:not-sr-only'
  );
});

it('renders no crumb when none is given', () => {
  render(<CampaignHeader title={<h1>Encounter</h1>} />);
  expect(
    screen.getAllByRole('link').map(l => l.getAttribute('aria-label'))
  ).toEqual(['RollKeeper home']);
});

it('renders the title and actions inside one banner', () => {
  render(
    <CampaignHeader
      title={<h1>Locations</h1>}
      actions={<button type="button">New location</button>}
    />
  );
  expect(screen.getAllByRole('banner')).toHaveLength(1);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Locations' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'New location' })
  ).toBeInTheDocument();
});
