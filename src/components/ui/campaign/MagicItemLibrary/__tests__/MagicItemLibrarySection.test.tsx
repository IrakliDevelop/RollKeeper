import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDmStore } from '@/store/dmStore';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import type { CampaignInfo } from '@/types/campaign';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import { MagicItemLibrarySection } from '../MagicItemLibrarySection';

const CODE = 'empty-campaign';
const NOW = '2026-08-08T00:00:00.000Z';

const NEW_ITEM_DATA: Omit<
  CustomMagicItem,
  'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
> = {
  name: 'Ring of Warmth',
  category: 'ring',
  rarity: 'uncommon',
  description: 'Resist cold damage.',
  properties: [],
  requiresAttunement: true,
  isAttuned: false,
  tags: [],
};

vi.mock('../MagicItemLibraryDialog', () => ({
  MagicItemLibraryDialog: ({
    open,
    onSave,
  }: {
    open: boolean;
    onSave: (data: typeof NEW_ITEM_DATA) => void;
  }) =>
    open ? (
      <button onClick={() => onSave(NEW_ITEM_DATA)}>Save item</button>
    ) : null,
}));

const item = (
  id: string,
  name: string,
  extra: Partial<CustomMagicItem> = {}
): CustomMagicItem => ({
  id,
  campaignCode: CODE,
  name,
  category: 'potion',
  rarity: 'common',
  description: 'Restores hit points.',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
  tags: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...extra,
});

const potion = item('healing-potion', 'Potion of Healing', {
  group: 'Healing',
  tags: ['quest'],
});

const seed = (
  items: CustomMagicItem[],
  dmDashboardUi?: CampaignInfo['dmDashboardUi']
) => {
  useMagicItemLibraryStore.setState({ itemsByCampaign: { [CODE]: items } });
  useDmStore.setState({
    campaigns: [
      {
        code: CODE,
        name: 'Empty campaign',
        createdAt: NOW,
        ...(dmDashboardUi ? { dmDashboardUi } : {}),
      },
    ],
  });
};

const dashboardUi = () =>
  useDmStore.getState().getCampaign(CODE)?.dmDashboardUi;

const renderSection = (
  players: Parameters<typeof MagicItemLibrarySection>[0]['players'] = []
) =>
  render(
    <MagicItemLibrarySection
      campaignCode={CODE}
      players={players}
      onGiveToPlayer={async () => {}}
    />
  );

const giveButton = (name: string) =>
  screen.getByRole('button', { name: 'Give copy', description: name });

describe('MagicItemLibrarySection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
    seed([]);
    renderConfirmDialogHost();
  });

  it('renders an empty campaign without an external-store snapshot loop', () => {
    const { container } = renderSection();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Magic items' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'No magic items yet' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start from a compendium item or a blank form. Players and NPCs get a copy and the template stays here.'
      )
    ).toBeInTheDocument();
    const creates = screen.getAllByRole('button', {
      name: 'Create magic item',
    });
    expect(creates).toHaveLength(1);
    expect(creates[0]).toHaveAttribute('data-variant', 'secondary');
    expect(container.querySelector('[data-variant="primary"]')).toBeNull();
  });

  it('keeps the default-off cloud sync card and its network work out of the section', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderSection();

    // The campaign exists, so the missing card is attributable to the flag.
    expect(useDmStore.getState().getCampaign(CODE)).toBeDefined();
    expect(screen.queryByText('Magic item library cloud sync')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('mounts the cloud sync card while the section is collapsed', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    seed([potion], { magicItemLibrarySectionOpen: false });
    renderSection();

    // Edits made from the always-visible heading must still reach the sync
    // effect, so the controls cannot live inside the collapsible block.
    expect(screen.queryByText('Potion of Healing')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Create magic item' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Magic item library cloud sync')
    ).toBeInTheDocument();
  });

  it('collapses independently while keeping creation available', async () => {
    const user = userEvent.setup();
    seed([potion]);
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Magic items (1)' }));

    expect(dashboardUi()?.magicItemLibrarySectionOpen).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Create magic item' })
    ).toBeInTheDocument();
  });

  it('opens the first template while saved as closed', () => {
    seed([], { magicItemLibrarySectionOpen: false });
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Create magic item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    expect(dashboardUi()?.magicItemLibrarySectionOpen).toBe(true);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Ring of Warmth' })
    ).toBeInTheDocument();
  });

  it('focuses the first new template once the editor has closed', () => {
    vi.useFakeTimers();
    try {
      renderSection();

      const create = screen.getByRole('button', { name: 'Create magic item' });
      create.focus();
      fireEvent.click(create);
      fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
      // The dialog's close auto-focus finds no Create button and drops to body.
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(
        screen.getByRole('button', {
          name: 'Give copy',
          description: NEW_ITEM_DATA.name,
        })
      ).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves focus alone when a template joins a library that has some', () => {
    vi.useFakeTimers();
    try {
      seed([potion]);
      renderSection();

      const create = screen.getByRole('button', { name: 'Create magic item' });
      create.focus();
      fireEvent.click(create);
      fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(
        useMagicItemLibraryStore.getState().itemsByCampaign[CODE]
      ).toHaveLength(2);
      expect(create).toHaveFocus();
      expect(giveButton('Ring of Warmth')).not.toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows rarity, category and group as text', () => {
    seed([potion, item('ring', 'Ring of Warmth', { category: 'ring' })]);
    renderSection();

    expect(
      screen.getByRole('heading', { level: 3, name: 'Potion of Healing' })
    ).toBeInTheDocument();
    expect(screen.getByText('Common potion · Healing')).toHaveClass(
      'type-small',
      'text-muted'
    );
    expect(screen.getByText('Common ring')).toBeInTheDocument();
    expect(screen.queryByText(/Ungrouped/)).toBeNull();

    const tags = screen.getByRole('list', { name: 'Tags' });
    expect(tags).toHaveTextContent('quest');
    expect(screen.getByText('quest')).toHaveAttribute(
      'data-variant',
      'neutral'
    );

    expect(giveButton('Potion of Healing')).toHaveAttribute(
      'data-variant',
      'secondary'
    );
    expect(
      screen.getByRole('button', { name: 'Edit Potion of Healing' })
    ).toHaveAttribute('data-variant', 'ghost');
    expect(
      screen.getByRole('button', { name: 'Duplicate Potion of Healing' })
    ).toHaveAttribute('data-variant', 'ghost');
    expect(
      screen.getByRole('button', { name: 'Delete Potion of Healing' })
    ).toHaveAttribute('data-variant', 'danger');
    expect(document.querySelector('[title]')).toBeNull();
  });

  it('searches and filters by tag, and clears both', async () => {
    const user = userEvent.setup();
    seed([potion, item('ring', 'Ring of Warmth')]);
    renderSection();

    const search = screen.getByRole('textbox', { name: 'Search magic items' });
    expect(search).toHaveAttribute('placeholder', 'Cloak of protection');

    await user.click(screen.getByRole('combobox', { name: 'Filter by tag' }));
    await user.click(screen.getByRole('option', { name: 'quest' }));
    expect(screen.queryByText('Ring of Warmth')).toBeNull();
    expect(screen.getByText('Potion of Healing')).toBeInTheDocument();

    await user.type(search, 'zzz');
    expect(
      screen.getByText('No magic items match these filters.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      screen.getByRole('combobox', { name: 'Filter by tag' })
    ).toHaveTextContent('All tags');
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(screen.getByText('Ring of Warmth')).toBeInTheDocument();
  });

  it('asks before deleting a template', async () => {
    seed([potion]);
    renderSection();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Potion of Healing' })
    );
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent('Delete Potion of Healing?');
    expect(dialog).toHaveTextContent(
      'The template is removed from your library. Copies you already gave out stay with their owners.'
    );
    await clickConfirmDialogButton('Delete magic item');

    expect(
      useMagicItemLibraryStore.getState().itemsByCampaign[CODE]
    ).toHaveLength(0);
    expect(screen.queryByText('Potion of Healing')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Create magic item' })
    ).toHaveFocus();
  });

  it('keeps the template when the delete is cancelled', async () => {
    seed([potion]);
    renderSection();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Potion of Healing' })
    );
    await findConfirmDialog();
    await clickConfirmDialogButton('Cancel');

    expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
  });

  it('moves focus to the next template after deleting one', async () => {
    seed([potion, item('ring', 'Ring of Warmth')]);
    renderSection();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Potion of Healing' })
    );
    await clickConfirmDialogButton('Delete magic item');

    await waitFor(() => expect(giveButton('Ring of Warmth')).toHaveFocus());
  });

  it('moves focus to the previous template after deleting the last one', async () => {
    seed([potion, item('ring', 'Ring of Warmth')]);
    renderSection();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Ring of Warmth' })
    );
    await clickConfirmDialogButton('Delete magic item');

    await waitFor(() => expect(giveButton('Potion of Healing')).toHaveFocus());
  });

  it('groups give recipients into players and NPCs', async () => {
    seed([potion]);
    useNPCStore.setState({
      npcsByCampaign: {
        [CODE]: [
          {
            id: 'npc-1',
            campaignCode: CODE,
            name: 'Sildar',
            armorClass: '16',
            maxHp: 27,
            speed: '30 ft.',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    });
    const user = userEvent.setup();
    renderSection([
      {
        playerId: 'player-1',
        playerName: 'Alice',
        characterId: 'character-1',
        characterName: 'Aria',
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'Give copy' }));
    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(screen.getByText('NPCs')).toBeInTheDocument();
    expect(screen.getByText('Sildar')).toBeInTheDocument();
  });
});
