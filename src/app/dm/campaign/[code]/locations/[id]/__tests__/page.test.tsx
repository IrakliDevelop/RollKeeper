import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmStore } from '@/store/dmStore';
import { useLocationStore } from '@/store/locationStore';
import type { LocationMap } from '@/types/location';

import LocationEditorPage from '../page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  hydrated: { value: true },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M', id: 'loc-1' }),
  usePathname: () => '/dm/campaign/K7QX2M/locations/loc-1',
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));

vi.mock('@/hooks/useHydration', () => ({
  useHydration: () => mocks.hydrated.value,
}));

vi.mock('@/components/ui/campaign/CampaignSettingsSyncControls', () => ({
  CampaignSettingsSyncControls: () => null,
}));

vi.mock('@/components/ui/campaign/location-map/DmLocationEditor', () => ({
  default: () => <div data-testid="editor" />,
}));

const LOCATION: LocationMap = {
  id: 'loc-1',
  campaignCode: 'K7QX2M',
  name: 'The Yawning Portal',
  mapImageUrl: '/maps/portal.png',
  mapImageSize: { w: 1200, h: 800 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  mocks.hydrated.value = true;
  mocks.push.mockReset();
  useLocationStore.setState({ locations: {} });
  useDmStore.setState({
    campaigns: [
      {
        code: 'K7QX2M',
        name: 'The Ember Pass',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('DM location page', () => {
  it('shows the loading line before hydration', () => {
    mocks.hydrated.value = false;
    const { container } = render(<LocationEditorPage />);

    const loading = screen.getByText('Loading location…');
    expect(loading).toHaveClass('text-muted');
    expect(loading).not.toHaveClass('animate-pulse');
    expect(document.querySelector('.animate-pulse')).toBeNull();
    expect(container.firstElementChild).toHaveClass('min-h-dvh');
    expect(container.firstElementChild).not.toHaveClass('min-h-screen');
  });

  it('explains a missing location and links back to the list', () => {
    render(<LocationEditorPage />);

    const heading = screen.getByText('Location not found');
    expect(heading).toHaveClass('type-subheading', 'text-heading');
    const line = screen.getByText(
      'It was deleted, or the link is out of date.'
    );
    expect(line).toHaveClass('type-body', 'text-muted');

    const back = screen.getByRole('link', { name: 'Back to locations' });
    expect(back).toHaveAttribute('href', '/dm/campaign/K7QX2M/locations');
    expect(back).toHaveAttribute('data-variant', 'ghost');
    expect(back.querySelector('button')).toBeNull();
    expect(screen.queryByText('Back to Locations')).toBeNull();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('fills the dynamic viewport with the editor', () => {
    useLocationStore.setState({
      locations: { K7QX2M: { 'loc-1': LOCATION } },
    });
    const { container } = render(<LocationEditorPage />);

    expect(screen.getByTestId('editor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'The Yawning Portal'
    );
    expect(container.firstElementChild).toHaveClass('h-dvh');
    expect(container.firstElementChild).not.toHaveClass('h-screen');
  });
});
