import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useDmStore } from '@/store/dmStore';
import type { BattleMap } from '@/types/battlemap';

import BattleMapEditorPage from '../page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  hydrated: { value: true },
  mode: { value: 'setup' as 'setup' | 'play' | null },
  handleModeChange: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M', id: 'bm-1' }),
  usePathname: () => '/dm/campaign/K7QX2M/battlemaps/bm-1',
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

vi.mock('@/components/ui/campaign/dm-vtt/DmVttScreen', () => ({
  DmVttScreen: () => <div data-testid="vtt" />,
}));

vi.mock('@/components/ui/campaign/dm-vtt/useBattleMapMode', () => ({
  useBattleMapMode: () => ({
    mode: mocks.mode.value,
    handleModeChange: mocks.handleModeChange,
  }),
}));

const BATTLE_MAP: BattleMap = {
  id: 'bm-1',
  campaignCode: 'K7QX2M',
  name: 'The Sunken Keep',
  mapImageUrl: '/maps/keep.png',
  mapImageSize: { w: 1200, h: 800 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const BACK_HREF = '/dm/campaign/K7QX2M/battlemaps';

function seedBattleMap() {
  useBattleMapStore.setState({
    battleMaps: { K7QX2M: { 'bm-1': BATTLE_MAP } },
  });
}

beforeEach(() => {
  mocks.hydrated.value = true;
  mocks.mode.value = 'setup';
  mocks.push.mockReset();
  mocks.handleModeChange.mockReset();
  useBattleMapStore.setState({ battleMaps: {} });
  useDmStore.setState({
    dmId: 'dm-1',
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

describe('DM battle map page', () => {
  it('shows a static loading line before hydration', () => {
    mocks.hydrated.value = false;
    const { container } = render(<BattleMapEditorPage />);

    const loading = screen.getByText('Loading battle map…');
    expect(loading).toHaveClass('text-muted');
    expect(loading).not.toHaveClass('animate-pulse');
    expect(document.querySelector('.animate-pulse')).toBeNull();
    expect(container.firstElementChild).toHaveClass('min-h-dvh');
    expect(container.firstElementChild).not.toHaveClass('min-h-screen');
  });

  it('shows the not-found state with a link back', () => {
    render(<BattleMapEditorPage />);

    const heading = screen.getByText('Battle map not found');
    expect(heading).toHaveClass('type-subheading', 'text-heading');
    const line = screen.getByText(
      'It was deleted, or the link is out of date.'
    );
    expect(line).toHaveClass('type-body', 'text-muted');

    const back = screen.getByRole('link', { name: 'Back to battle maps' });
    expect(back).toHaveAttribute('href', BACK_HREF);
    expect(back.querySelector('button')).toBeNull();
    expect(screen.queryByText('Back to Battle Maps')).toBeNull();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('renders the campaign header with a Battle maps crumb and the map name', () => {
    seedBattleMap();
    render(<BattleMapEditorPage />);

    expect(screen.getByRole('link', { name: 'Battle maps' })).toHaveAttribute(
      'href',
      BACK_HREF
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'The Sunken Keep' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('editor')).toBeInTheDocument();
  });

  it('marks the current mode in a Mode group', async () => {
    seedBattleMap();
    render(<BattleMapEditorPage />);

    const group = within(screen.getByRole('group', { name: 'Mode' }));
    const setup = group.getByRole('button', { name: 'Setup' });
    const play = group.getByRole('button', { name: 'Play' });

    expect(setup).toHaveAttribute('aria-pressed', 'true');
    expect(setup).toHaveAttribute('data-selected', 'true');
    expect(setup).toHaveAttribute('data-variant', 'secondary');
    expect(play).toHaveAttribute('aria-pressed', 'false');
    expect(play).not.toHaveAttribute('data-selected');

    await userEvent.click(play);
    expect(mocks.handleModeChange).toHaveBeenCalledWith('play');
  });

  it('keeps the editor full-height', () => {
    seedBattleMap();
    const { container } = render(<BattleMapEditorPage />);

    expect(container.firstElementChild).toHaveClass('h-dvh');
    expect(container.firstElementChild).not.toHaveClass('h-screen');
  });
});
