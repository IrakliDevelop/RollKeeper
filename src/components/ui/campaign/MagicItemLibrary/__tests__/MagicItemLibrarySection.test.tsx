import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import { GiveMagicItemDialog } from '../GiveMagicItemDialog';
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

// The stub stays mounted while closed so tests can read which item the real
// dialog would still be holding during its exit.
vi.mock('../MagicItemLibraryDialog', () => ({
  MagicItemLibraryDialog: ({
    open,
    item,
    onOpenChange,
    onSave,
  }: {
    open: boolean;
    item: { name: string } | null;
    onOpenChange: (open: boolean) => void;
    onSave: (data: typeof NEW_ITEM_DATA) => void;
  }) => (
    <div
      data-testid="editor"
      data-open={open}
      data-title={item ? `Edit ${item.name}` : 'Create magic item'}
    >
      {open && (
        <>
          <button onClick={() => onSave(NEW_ITEM_DATA)}>Save item</button>
          <button onClick={() => onOpenChange(false)}>Close editor</button>
        </>
      )}
    </div>
  ),
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

  it('clears a search left over from an emptied library', async () => {
    const user = userEvent.setup();
    seed([potion]);
    renderSection();

    await user.type(
      screen.getByRole('textbox', { name: 'Search magic items' }),
      'potion'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Potion of Healing' })
    );
    await clickConfirmDialogButton('Delete magic item');
    fireEvent.click(screen.getByRole('button', { name: 'Create magic item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    expect(
      screen.getByRole('heading', { level: 3, name: 'Ring of Warmth' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Search magic items' })
    ).toHaveValue('');
  });

  it('falls back to all tags when the last template with the tag is deleted', async () => {
    const user = userEvent.setup();
    seed([potion, item('ring', 'Ring of Warmth')]);
    renderSection();

    await user.click(screen.getByRole('combobox', { name: 'Filter by tag' }));
    await user.click(screen.getByRole('option', { name: 'quest' }));
    expect(screen.queryByText('Ring of Warmth')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Potion of Healing' })
    );
    await clickConfirmDialogButton('Delete magic item');

    expect(
      screen.getByRole('combobox', { name: 'Filter by tag' })
    ).toHaveTextContent('All tags');
    expect(screen.getByText('Ring of Warmth')).toBeInTheDocument();
    expect(
      screen.queryByText('No magic items match these filters.')
    ).toBeNull();
  });

  describe('editor dialog', () => {
    const editor = () => screen.getByTestId('editor');

    it('keeps its item while it closes and clears it for a new template', async () => {
      seed([potion, item('ring', 'Ring of Warmth')]);
      renderSection();

      expect(editor()).toHaveAttribute('data-title', 'Create magic item');
      fireEvent.click(
        screen.getByRole('button', { name: 'Edit Potion of Healing' })
      );
      expect(editor()).toHaveAttribute('data-open', 'true');
      expect(editor()).toHaveAttribute('data-title', 'Edit Potion of Healing');

      fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
      expect(editor()).toHaveAttribute('data-open', 'false');
      expect(editor()).toHaveAttribute('data-title', 'Edit Potion of Healing');

      fireEvent.click(
        screen.getByRole('button', { name: 'Create magic item' })
      );
      expect(editor()).toHaveAttribute('data-open', 'true');
      expect(editor()).toHaveAttribute('data-title', 'Create magic item');
      fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));

      fireEvent.click(
        screen.getByRole('button', { name: 'Edit Ring of Warmth' })
      );
      expect(editor()).toHaveAttribute('data-title', 'Edit Ring of Warmth');
    });

    it('keeps its item while a save closes it', () => {
      seed([potion]);
      renderSection();

      fireEvent.click(
        screen.getByRole('button', { name: 'Edit Potion of Healing' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

      expect(editor()).toHaveAttribute('data-open', 'false');
      expect(editor()).toHaveAttribute('data-title', 'Edit Potion of Healing');
    });
  });

  describe('give a copy dialog', () => {
    const aria = {
      playerId: 'player-1',
      playerName: 'Alice',
      characterId: 'character-1',
      characterName: 'Aria',
    };
    const sildar = {
      id: 'npc-1',
      campaignCode: CODE,
      name: 'Sildar',
      armorClass: '16',
      maxHp: 27,
      speed: '30 ft.',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const seedNpcs = () =>
      useNPCStore.setState({ npcsByCampaign: { [CODE]: [sildar] } });
    const openGive = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(giveButton('Potion of Healing'));
      return screen.getByRole('dialog', {
        name: 'Give a copy of Potion of Healing',
      });
    };

    it('asks who gets the copy', async () => {
      seed([potion]);
      seedNpcs();
      const user = userEvent.setup();
      renderSection([aria]);

      const dialog = await openGive(user);
      expect(dialog).toHaveAccessibleDescription(
        'They get their own copy. The template stays in your library.'
      );
      const select = within(dialog).getByRole('combobox', { name: 'Give to' });
      expect(select).toHaveTextContent('Choose a player or NPC');
      expect(
        within(dialog).getByRole('button', { name: 'Cancel' })
      ).toHaveAttribute('data-variant', 'outline');
      const give = within(dialog).getByRole('button', { name: 'Give copy' });
      expect(give).toHaveAttribute('data-variant', 'primary');
      expect(give).toBeDisabled();

      await user.click(select);
      expect(screen.getByText('Players')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Aria' })).toBeInTheDocument();
      expect(screen.getByText('NPCs and monsters')).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'Sildar' })
      ).toBeInTheDocument();
    });

    it('leaves out a group with no entries', async () => {
      seed([potion]);
      seedNpcs();
      const user = userEvent.setup();
      const { unmount } = renderSection();

      let dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      expect(screen.queryByText('Players')).toBeNull();
      expect(screen.getByText('NPCs and monsters')).toBeInTheDocument();
      unmount();
      cleanup();

      useNPCStore.setState({ npcsByCampaign: {} });
      renderSection([aria]);
      dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      expect(screen.getByText('Players')).toBeInTheDocument();
      expect(screen.queryByText('NPCs and monsters')).toBeNull();
    });

    // Radix renders the separator as an aria-hidden div with no role.
    const SEPARATOR = '[aria-hidden="true"]';

    it('separates the groups only when both have entries', async () => {
      seed([potion]);
      seedNpcs();
      const user = userEvent.setup();
      const { unmount } = renderSection([aria]);

      let dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      expect(
        screen.getByRole('listbox').querySelectorAll(SEPARATOR)
      ).toHaveLength(1);
      unmount();
      cleanup();

      renderSection();
      dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      expect(screen.getByRole('listbox').querySelector(SEPARATOR)).toBeNull();
      unmount();
      cleanup();

      useNPCStore.setState({ npcsByCampaign: {} });
      renderSection([aria]);
      dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      expect(screen.getByRole('listbox').querySelector(SEPARATOR)).toBeNull();
    });

    it('says when nobody can receive a copy', async () => {
      seed([potion]);
      const user = userEvent.setup();
      renderSection();

      const dialog = await openGive(user);
      expect(
        within(dialog).getByRole('combobox', { name: 'Give to' })
      ).toHaveAccessibleDescription('No players or NPCs in this campaign yet.');
      expect(
        within(dialog).getByRole('button', { name: 'Give copy' })
      ).toBeDisabled();
    });

    it('gives a copy to a player and to an NPC', async () => {
      seed([potion]);
      seedNpcs();
      const onGiveToPlayer = vi.fn(async () => {});
      const user = userEvent.setup();
      render(
        <MagicItemLibrarySection
          campaignCode={CODE}
          players={[aria]}
          onGiveToPlayer={onGiveToPlayer}
        />
      );

      let dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Aria' }));
      await user.click(
        within(dialog).getByRole('button', { name: 'Give copy' })
      );

      await waitFor(() => expect(onGiveToPlayer).toHaveBeenCalledTimes(1));
      const [given, target] = onGiveToPlayer.mock.calls[0] as unknown as [
        Record<string, unknown>,
        unknown,
      ];
      expect(given.name).toBe('Potion of Healing');
      for (const key of ['campaignCode', 'tags', 'group', 'sourceItemId']) {
        expect(given).not.toHaveProperty(key);
      }
      expect(target).toEqual(aria);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Sildar' }));
      await user.click(
        within(dialog).getByRole('button', { name: 'Give copy' })
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const inventory =
        useNPCStore.getState().npcsByCampaign[CODE][0].inventory ?? [];
      expect(inventory).toHaveLength(1);
      expect(inventory[0]).toMatchObject({
        name: 'Potion of Healing',
        category: 'magic item',
      });
      expect(onGiveToPlayer).toHaveBeenCalledTimes(1);
    });

    it('clears the pick when the dialog closes', async () => {
      seed([potion]);
      const user = userEvent.setup();
      renderSection([aria]);

      let dialog = await openGive(user);
      await user.click(within(dialog).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Aria' }));
      expect(within(dialog).getByRole('combobox')).toHaveTextContent('Aria');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      dialog = await openGive(user);
      expect(within(dialog).getByRole('combobox')).toHaveTextContent(
        'Choose a player or NPC'
      );
      expect(
        within(dialog).getByRole('button', { name: 'Give copy' })
      ).toBeDisabled();
    });

    it('never renders an empty give title', () => {
      const props = {
        players: [],
        npcs: [],
        onGive: vi.fn(),
        onClose: vi.fn(),
      };
      const { rerender } = render(
        <GiveMagicItemDialog item={potion} {...props} />
      );
      expect(
        screen.getByText('Give a copy of Potion of Healing')
      ).toBeInTheDocument();

      rerender(<GiveMagicItemDialog item={null} {...props} />);

      // jsdom's Presence unmounts at once, so the exit itself cannot be seen
      // here; what must never appear is a title with its name missing.
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByText(/^Give a copy of\s*$/)).toBeNull();
    });

    describe('with the dialog driven directly', () => {
      const ring = item('ring', 'Ring of Warmth');
      const pick = async (
        user: ReturnType<typeof userEvent.setup>,
        name: string
      ) => {
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('combobox'));
        await user.click(screen.getByRole('option', { name }));
        return dialog;
      };

      it('does not close or spin the dialog opened for another item while a give is in flight', async () => {
        const user = userEvent.setup();
        let finish: () => void = () => {};
        const onGive = vi.fn(
          () =>
            new Promise<void>(resolve => {
              finish = resolve;
            })
        );
        const onClose = vi.fn();
        const props = { players: [aria], npcs: [], onGive, onClose };
        const { rerender } = render(
          <GiveMagicItemDialog item={potion} {...props} />
        );

        const first = await pick(user, 'Aria');
        await user.click(
          within(first).getByRole('button', { name: 'Give copy' })
        );
        expect(
          within(first).getByRole('button', { name: 'Give copy' })
        ).toBeDisabled();

        rerender(<GiveMagicItemDialog item={null} {...props} />);
        rerender(<GiveMagicItemDialog item={ring} {...props} />);
        const second = screen.getByRole('dialog', {
          name: 'Give a copy of Ring of Warmth',
        });
        await pick(user, 'Aria');
        expect(
          within(second).getByRole('button', { name: 'Give copy' })
        ).toBeEnabled();

        await act(async () => {
          finish();
        });

        expect(onClose).not.toHaveBeenCalled();
        expect(
          within(second).getByRole('button', { name: 'Give copy' })
        ).toBeEnabled();
      });

      it('closes after a give when its dialog is still the open one', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
          <GiveMagicItemDialog
            item={potion}
            players={[aria]}
            npcs={[]}
            onGive={async () => {}}
            onClose={onClose}
          />
        );

        const dialog = await pick(user, 'Aria');
        await user.click(
          within(dialog).getByRole('button', { name: 'Give copy' })
        );

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      });

      it('closes without giving when the pick has left the campaign', async () => {
        const user = userEvent.setup();
        const onGive = vi.fn(async () => {});
        const onClose = vi.fn();
        const props = { npcs: [], onGive, onClose };
        const { rerender } = render(
          <GiveMagicItemDialog item={potion} players={[aria]} {...props} />
        );

        const dialog = await pick(user, 'Aria');
        rerender(<GiveMagicItemDialog item={potion} players={[]} {...props} />);
        await user.click(
          within(dialog).getByRole('button', { name: 'Give copy' })
        );

        expect(onGive).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });
  });
});
