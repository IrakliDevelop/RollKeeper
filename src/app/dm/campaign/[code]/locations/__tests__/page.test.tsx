import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmStore } from '@/store/dmStore';
import { useLocationStore } from '@/store/locationStore';
import { uploadAsset } from '@/utils/uploadAsset';
import type { LocationMap } from '@/types/location';

import CampaignLocationsPage from '../page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  hydrated: { value: true },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M' }),
  usePathname: () => '/dm/campaign/K7QX2M/locations',
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));

vi.mock('@/hooks/useHydration', () => ({
  useHydration: () => mocks.hydrated.value,
}));

vi.mock('@/utils/uploadAsset', () => ({
  uploadAsset: vi.fn(),
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
  vi.mocked(uploadAsset).mockReset();
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
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('DM locations page', () => {
  it('shows the loading line before hydration', () => {
    mocks.hydrated.value = false;
    render(<CampaignLocationsPage />);

    const loading = screen.getByText('Loading locations…');
    expect(loading).toHaveClass('text-muted');
    expect(loading).not.toHaveClass('animate-pulse');
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });

  it('shows the empty state with an action that opens the dialog', async () => {
    const user = userEvent.setup();
    render(<CampaignLocationsPage />);

    const heading = screen.getByText('Add your first location');
    expect(heading).toHaveClass('type-subheading', 'text-heading');
    const line = screen.getByText(
      'Upload a map image to mark up and share with your players.'
    );
    expect(line).toHaveClass('type-body', 'text-muted');

    const buttons = screen.getAllByRole('button', { name: 'New location' });
    const emptyAction = buttons.find(b => b.closest('main'));
    expect(emptyAction).toBeDefined();
    expect(emptyAction).toHaveAttribute('data-variant', 'secondary');
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );

    await user.click(emptyAction!);
    expect(
      await screen.findByRole('dialog', { name: 'New location' })
    ).toBeInTheDocument();
  });

  it('labels the name field and reaches the image picker by keyboard', async () => {
    const user = userEvent.setup();
    render(<CampaignLocationsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New location' })[0]
    );

    const name = await screen.findByRole('textbox', { name: /^Name/ });
    expect(name).toHaveAttribute('placeholder', 'The Yawning Portal');
    await waitFor(() => expect(name).toHaveFocus());
    expect(
      screen.getByRole('group', { name: 'Map image' })
    ).toBeInTheDocument();

    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {});
    await user.tab();
    const picker = screen.getByRole('button', { name: 'Choose image' });
    expect(picker).toHaveFocus();
    expect(picker).toHaveAttribute('type', 'button');

    await user.keyboard('{Enter}');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('keeps Create location disabled until a name and an image are set', async () => {
    const user = userEvent.setup();
    render(<CampaignLocationsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New location' })[0]
    );

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).not.toHaveAttribute('required');
    expect(fileInput).toHaveAttribute('tabindex', '-1');

    const name = await screen.findByRole('textbox', { name: /^Name/ });
    await user.type(name, 'Cellar');
    const submit = screen.getByRole('button', { name: 'Create location' });
    expect(submit).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(uploadAsset).not.toHaveBeenCalled();

    await user.upload(
      fileInput,
      new File(['x'], 'portal.png', { type: 'image/png' })
    );
    expect(screen.getByText('portal.png')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change image' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create location' })
    ).toBeEnabled();
  });

  it('shows the upload error and clears it when the dialog closes', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadAsset).mockRejectedValue(new Error('boom'));
    render(<CampaignLocationsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New location' })[0]
    );

    await user.type(
      await screen.findByRole('textbox', { name: /^Name/ }),
      'Cellar'
    );
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'portal.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Create location' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Couldn't upload the map. Check the image and try again."
    );
    expect(alert).toHaveClass('text-blood-text');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create location' })
    ).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(useLocationStore.getState().locations.K7QX2M ?? {}).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(
      screen.getAllByRole('button', { name: 'New location' })[0]
    );

    expect(await screen.findByRole('textbox', { name: /^Name/ })).toHaveValue(
      ''
    );
    expect(
      screen.getByRole('button', { name: 'Choose image' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lists saved locations as cards', () => {
    useLocationStore.setState({
      locations: { K7QX2M: { 'loc-1': LOCATION } },
    });
    render(<CampaignLocationsPage />);

    expect(screen.queryByText('Add your first location')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'The Yawning Portal' })
    ).toBeInTheDocument();
  });

  it('drops the old wording', async () => {
    const user = userEvent.setup();
    render(<CampaignLocationsPage />);
    const old = [
      'New Location',
      'Location Name',
      'No locations yet',
      'PNG, JPG, or WebP',
      'Click to change',
      'Loading...',
      'Choose an image',
      'Create Location',
    ];
    const text = () => document.body.textContent ?? '';
    for (const s of old) expect(text()).not.toContain(s);

    await user.click(
      screen.getAllByRole('button', { name: 'New location' })[0]
    );
    await screen.findByRole('dialog');
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'portal.png', { type: 'image/png' })
    );
    for (const s of old) expect(text()).not.toContain(s);
  });
});
