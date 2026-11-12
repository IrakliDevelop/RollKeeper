import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clickConfirmDialogButton,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { useDmStore } from '@/store/dmStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import { uploadAsset } from '@/utils/uploadAsset';
import type { BattleMap } from '@/types/battlemap';

import CampaignBattleMapsPage from '../page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  hydrated: { value: true },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M' }),
  usePathname: () => '/dm/campaign/K7QX2M/battlemaps',
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

const BATTLE_MAP: BattleMap = {
  id: 'bm-1',
  campaignCode: 'K7QX2M',
  name: 'Goblin Ambush',
  mapImageUrl: '/maps/ambush.png',
  mapImageSize: { w: 1200, h: 800 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  mocks.hydrated.value = true;
  mocks.push.mockReset();
  vi.mocked(uploadAsset).mockReset();
  useBattleMapStore.setState({ battleMaps: {} });
  useDmStore.setState({
    dmId: 'dm-test-1',
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

describe('DM battle maps page', () => {
  it('shows the loading line before hydration', () => {
    mocks.hydrated.value = false;
    render(<CampaignBattleMapsPage />);

    const loading = screen.getByText('Loading battle maps…');
    expect(loading).toHaveClass('text-muted');
    expect(loading).not.toHaveClass('animate-pulse');
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });

  it('shows the empty state with an action that opens the dialog', async () => {
    const user = userEvent.setup();
    render(<CampaignBattleMapsPage />);

    const heading = screen.getByText('Add your first battle map');
    expect(heading).toHaveClass('type-subheading', 'text-heading');
    const line = screen.getByText(
      'Upload a map image to run encounters on and share with your players.'
    );
    expect(line).toHaveClass('type-body', 'text-muted');

    const buttons = screen.getAllByRole('button', { name: 'New battle map' });
    const emptyAction = buttons.find(b => b.closest('main'));
    expect(emptyAction).toBeDefined();
    expect(emptyAction).toHaveAttribute('data-variant', 'secondary');
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );

    await user.click(emptyAction!);
    expect(
      await screen.findByRole('dialog', { name: 'New battle map' })
    ).toBeInTheDocument();
  });

  it('labels the name field and reaches the image picker by keyboard', async () => {
    const user = userEvent.setup();
    render(<CampaignBattleMapsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New battle map' })[0]
    );

    const name = await screen.findByRole('textbox', { name: /^Name/ });
    expect(name).toHaveAttribute('placeholder', 'Goblin ambush');
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

  it('keeps Create battle map disabled until a name and an image are set', async () => {
    const user = userEvent.setup();
    render(<CampaignBattleMapsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New battle map' })[0]
    );

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).not.toHaveAttribute('required');
    expect(fileInput).toHaveAttribute('tabindex', '-1');

    const name = await screen.findByRole('textbox', { name: /^Name/ });
    await user.type(name, 'Cellar');
    const submit = screen.getByRole('button', { name: 'Create battle map' });
    expect(submit).toBeDisabled();
    const onSubmit = vi.fn();
    const form = document.querySelector('form') as HTMLFormElement;
    form.addEventListener('submit', onSubmit);
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    form.removeEventListener('submit', onSubmit);

    await user.upload(
      fileInput,
      new File(['x'], 'ambush.png', { type: 'image/png' })
    );
    expect(screen.getByText('ambush.png')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change image' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create battle map' })
    ).toBeEnabled();
  });

  it('shows the upload error and clears it when the dialog closes', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadAsset).mockRejectedValue(new Error('boom'));
    render(<CampaignBattleMapsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New battle map' })[0]
    );

    await user.type(
      await screen.findByRole('textbox', { name: /^Name/ }),
      'Cellar'
    );
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'ambush.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Create battle map' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Couldn't upload the map. Check the image and try again."
    );
    expect(alert).toHaveClass('text-blood-text');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create battle map' })
    ).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(useBattleMapStore.getState().battleMaps.K7QX2M ?? {}).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(
      screen.getAllByRole('button', { name: 'New battle map' })[0]
    );

    expect(await screen.findByRole('textbox', { name: /^Name/ })).toHaveValue(
      ''
    );
    expect(
      screen.getByRole('button', { name: 'Choose image' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows Uploading… and disables the submit button while the upload runs', async () => {
    const user = userEvent.setup();
    let rejectUpload: (reason: Error) => void = () => {};
    vi.mocked(uploadAsset).mockReturnValue(
      new Promise<string>((_resolve, reject) => {
        rejectUpload = reject;
      })
    );
    render(<CampaignBattleMapsPage />);
    await user.click(
      screen.getAllByRole('button', { name: 'New battle map' })[0]
    );
    await user.type(
      await screen.findByRole('textbox', { name: /^Name/ }),
      'Cellar'
    );
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'ambush.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Create battle map' }));

    const submit = await screen.findByRole('button', { name: 'Uploading…' });
    expect(submit).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Create battle map' })
    ).toBeNull();

    rejectUpload(new Error('boom'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create battle map' })
    ).toBeEnabled();
  });

  it('lists saved battle maps as cards', () => {
    useBattleMapStore.setState({
      battleMaps: { K7QX2M: { 'bm-1': BATTLE_MAP } },
    });
    render(<CampaignBattleMapsPage />);

    expect(screen.queryByText('Add your first battle map')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Goblin Ambush' })
    ).toBeInTheDocument();
  });

  describe('deleting a battle map', () => {
    beforeEach(() => {
      useBattleMapStore.setState({
        battleMaps: { K7QX2M: { 'bm-1': BATTLE_MAP } },
      });
    });

    it('removes the battle map and calls the delete API once confirmed', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null));
      renderConfirmDialogHost();
      render(<CampaignBattleMapsPage />);

      fireEvent.click(
        screen.getByRole('button', { name: 'Delete Goblin Ambush' })
      );
      await clickConfirmDialogButton('Delete battle map');

      expect(
        useBattleMapStore.getState().battleMaps.K7QX2M?.['bm-1']
      ).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/campaign/K7QX2M/battlemaps/bm-1');
      expect(init?.method).toBe('DELETE');
      expect(JSON.parse(init?.body as string)).toEqual({ dmId: 'dm-test-1' });
    });

    it('keeps the battle map and sends nothing when the confirm is cancelled', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null));
      renderConfirmDialogHost();
      render(<CampaignBattleMapsPage />);

      fireEvent.click(
        screen.getByRole('button', { name: 'Delete Goblin Ambush' })
      );
      await clickConfirmDialogButton('Cancel');

      expect(useBattleMapStore.getState().battleMaps.K7QX2M['bm-1']).toEqual(
        BATTLE_MAP
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('drops the old wording', async () => {
    const user = userEvent.setup();
    render(<CampaignBattleMapsPage />);
    const old = [
      'New Battle Map',
      'Battle Map Name',
      'No battle maps yet',
      'Upload a map to get started.',
      'Failed to upload image',
      'PNG, JPG, or WebP',
      'Click to change',
      'Loading...',
      'Choose an image',
      'Create Battle Map',
    ];
    const text = () => document.body.textContent ?? '';
    for (const s of old) expect(text()).not.toContain(s);

    await user.click(
      screen.getAllByRole('button', { name: 'New battle map' })[0]
    );
    await screen.findByRole('dialog');
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'ambush.png', { type: 'image/png' })
    );
    for (const s of old) expect(text()).not.toContain(s);
  });
});
