import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmStore } from '@/store/dmStore';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';
import type { CampaignInfo } from '@/types/campaign';
import type { CampaignNPC } from '@/types/encounter';

import { NpcSyncProvider } from '../NpcSyncControls';
import { NpcLibrarySection } from './NpcLibrarySection';

const NEW_NPC_DATA: Omit<
  CampaignNPC,
  'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
> = {
  name: 'Wren',
  armorClass: '12',
  maxHp: 9,
  speed: '30 ft.',
};

vi.mock('@/components/ui/campaign/NPCFormDialog', () => ({
  NPCFormDialog: ({
    open,
    kind,
    onSave,
  }: {
    open: boolean;
    kind?: string;
    onSave: (data: typeof NEW_NPC_DATA) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={`Form ${kind}`}>
        <button onClick={() => onSave(NEW_NPC_DATA)}>Save form</button>
      </div>
    ) : null,
}));

vi.mock('@/components/ui/campaign/NPCDetailDialog', () => ({
  NPCDetailDialog: ({
    open,
    npc,
    onDelete,
  }: {
    open: boolean;
    npc: CampaignNPC | null;
    onDelete?: (npc: CampaignNPC) => void;
  }) =>
    open && npc ? (
      <div role="dialog" aria-label={npc.name}>
        <button onClick={() => onDelete?.(npc)}>Delete from dialog</button>
      </div>
    ) : null,
}));

// Its data hooks fetch on mount.
vi.mock(
  '@/components/ui/campaign/MagicItemLibrary/MagicItemLibraryDialog',
  () => ({
    MagicItemLibraryDialog: () => null,
  })
);

const CODE = 'K7QX2M';

const creature = (
  id: string,
  name: string,
  extra: Partial<CampaignNPC> = {}
): CampaignNPC => ({
  id,
  campaignCode: CODE,
  name,
  armorClass: '13',
  maxHp: 11,
  speed: '30 ft.',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
  ...extra,
});

const seed = (
  npcs: CampaignNPC[],
  dmDashboardUi?: CampaignInfo['dmDashboardUi']
) => {
  useNPCStore.setState({ npcsByCampaign: { [CODE]: npcs } });
  useDmStore.setState({
    campaigns: [
      {
        code: CODE,
        name: 'Saltmarsh',
        createdAt: '2026-08-23T00:00:00.000Z',
        ...(dmDashboardUi ? { dmDashboardUi } : {}),
      },
    ],
  });
};

const dashboardUi = () =>
  useDmStore.getState().getCampaign(CODE)?.dmDashboardUi;

const storedNames = () =>
  (useNPCStore.getState().npcsByCampaign[CODE] ?? []).map(n => n.name);

const viewButton = (name: string) =>
  screen.getByRole('button', { name: 'View', description: name });

const levelHeadings = (level: number) =>
  screen.getAllByRole('heading', { level }).map(h => h.textContent);

describe('NpcLibrarySection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
    seed([]);
    renderConfirmDialogHost();
  });

  afterEach(() => {
    cleanup();
    resetFetch();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('heads an empty library without a count or a disclosure', () => {
    seed([], { npcSectionOpen: false });
    render(<NpcLibrarySection campaignCode={CODE} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'NPCs' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^NPCs/ })).toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: 'No NPCs yet' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'NPCs you create here can join any encounter in this campaign.'
      )
    ).toBeInTheDocument();
    const creates = screen.getAllByRole('button', { name: 'Create NPC' });
    expect(creates).toHaveLength(1);
    expect(creates[0]).toHaveAttribute('data-variant', 'secondary');
    expect(screen.queryByRole('textbox', { name: 'Search NPCs' })).toBeNull();

    fireEvent.click(creates[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save form' }));

    expect(dashboardUi()?.npcSectionOpen).toBe(true);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Wren' })
    ).toBeInTheDocument();
  });

  it('focuses the first new entry once the form dialog has closed', () => {
    vi.useFakeTimers();
    try {
      render(<NpcLibrarySection campaignCode={CODE} />);

      const create = screen.getByRole('button', { name: 'Create NPC' });
      create.focus();
      fireEvent.click(create);
      fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
      // The dialog's close auto-focus finds no Create button and drops to body.
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(viewButton('Wren')).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('focuses the first new custom monster the same way', () => {
    vi.useFakeTimers();
    try {
      render(<NpcLibrarySection campaignCode={CODE} kind="monster" />);

      const create = screen.getByRole('button', {
        name: 'Create custom monster',
      });
      create.focus();
      fireEvent.click(create);
      fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(viewButton('Wren')).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves focus alone when a new entry joins a library that has some', () => {
    vi.useFakeTimers();
    try {
      seed([creature('a', 'A')]);
      render(<NpcLibrarySection campaignCode={CODE} />);

      const create = screen.getByRole('button', { name: 'Create NPC' });
      create.focus();
      fireEvent.click(create);
      fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(storedNames()).toEqual(['A', 'Wren']);
      expect(create).toHaveFocus();
      expect(viewButton('Wren')).not.toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('heads an empty custom monster library with its own copy', () => {
    render(<NpcLibrarySection campaignCode={CODE} kind="monster" />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Custom monsters' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'No custom monsters yet' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Custom monsters you create here can join any encounter in this campaign.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create custom monster' })
    ).toBeInTheDocument();
  });

  it('counts the entries and collapses into dmDashboardUi', () => {
    seed([creature('a', 'Brenn Ironhand'), creature('b', 'Mira')]);
    const { container } = render(<NpcLibrarySection campaignCode={CODE} />);

    const toggle = screen.getByRole('button', { name: 'NPCs (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Create NPC' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );

    fireEvent.click(toggle);

    expect(dashboardUi()?.npcSectionOpen).toBe(false);
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Create NPC' })
    ).toBeInTheDocument();
    expect(
      container.querySelector('[aria-controls^="dm-campaign-"]')
    ).toBeNull();
  });

  it('lists the entries as a list in store order', () => {
    seed([creature('a', 'Brenn Ironhand'), creature('b', 'Mira')]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    expect(levelHeadings(3)).toEqual(['Brenn Ironhand', 'Mira']);
    const row = screen
      .getByRole('heading', { level: 3, name: 'Brenn Ironhand' })
      .closest('li');
    expect(row).not.toBeNull();
    expect(row!.closest('ul')).toHaveClass('divide-y');

    const section = screen
      .getByRole('heading', { level: 2, name: 'NPCs (2)' })
      .closest('section')!;
    expect(section.querySelector('[class*="accent-"]')).toBeNull();
    expect(section.querySelector('[data-variant="primary"]')).toBeNull();
  });

  it('opens the detail dialog from View', () => {
    seed([
      creature('a', 'Brenn Ironhand', {
        description: 'Runs the Rusty Anchor.',
      }),
    ]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    fireEvent.click(screen.getByText('Runs the Rusty Anchor.'));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(viewButton('Brenn Ironhand'));
    expect(
      screen.getByRole('dialog', { name: 'Brenn Ironhand' })
    ).toBeInTheDocument();
  });

  it('opens the form with the current entity label', () => {
    const { unmount } = render(<NpcLibrarySection campaignCode={CODE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create NPC' }));
    expect(
      screen.getByRole('dialog', { name: 'Form npc' })
    ).toBeInTheDocument();
    unmount();

    render(<NpcLibrarySection campaignCode={CODE} kind="monster" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Create custom monster' })
    );
    expect(
      screen.getByRole('dialog', { name: 'Form monster' })
    ).toBeInTheDocument();
  });

  it('searches by name and filters by tag', () => {
    seed([
      creature('a', 'Brenn Ironhand', { tags: ['merchant'] }),
      creature('b', 'Mira', { tags: ['guard'] }),
    ]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    const search = screen.getByRole('textbox', { name: 'Search NPCs' });
    expect(search).toHaveAttribute('placeholder', 'Brenn');
    fireEvent.change(search, { target: { value: 'mir' } });
    expect(levelHeadings(3)).toEqual(['Mira']);
    fireEvent.change(search, { target: { value: '' } });

    const group = screen.getByRole('group', { name: 'Filter by tag' });
    const tagButtons = within(group).getAllByRole('button');
    expect(tagButtons.map(b => b.textContent)).toEqual(['guard', 'merchant']);
    tagButtons.forEach(b => expect(b).toHaveAttribute('aria-pressed', 'false'));

    const merchant = within(group).getByRole('button', { name: 'merchant' });
    fireEvent.click(merchant);
    expect(merchant).toHaveAttribute('aria-pressed', 'true');
    expect(merchant).toHaveAttribute('data-selected', 'true');
    expect(levelHeadings(3)).toEqual(['Brenn Ironhand']);
    const clearTags = within(group).getByRole('button', { name: 'Clear tags' });
    expect(clearTags).toHaveAttribute('data-variant', 'ghost');

    fireEvent.click(clearTags);
    expect(levelHeadings(3)).toEqual(['Brenn Ironhand', 'Mira']);
    expect(screen.queryByRole('button', { name: 'Clear tags' })).toBeNull();
  });

  it('says when nothing matches and clears the filters', () => {
    seed([creature('a', 'Brenn Ironhand'), creature('b', 'Mira')]);
    const { unmount } = render(<NpcLibrarySection campaignCode={CODE} />);

    const search = screen.getByRole('textbox', { name: 'Search NPCs' });
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(
      screen.getByText('No NPCs match these filters.')
    ).toBeInTheDocument();
    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear).toHaveAttribute('data-variant', 'ghost');

    fireEvent.click(clear);
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(levelHeadings(3)).toEqual(['Brenn Ironhand', 'Mira']);
    unmount();

    seed([creature('m', 'Dire Wolf', { kind: 'monster' })]);
    render(<NpcLibrarySection campaignCode={CODE} kind="monster" />);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search custom monsters' }),
      { target: { value: 'zzz' } }
    );
    expect(
      screen.getByText('No custom monsters match these filters.')
    ).toBeInTheDocument();
  });

  it('groups entries under level-3 sections, Ungrouped last', () => {
    seed([
      creature('g', 'Gate warden', { group: 'Town guard' }),
      creature('b1', 'Red Cap', { group: 'Bandits' }),
      creature('b2', 'Knife Sal', { group: 'Bandits' }),
      creature('u', 'Loner'),
    ]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    expect(levelHeadings(3)).toEqual([
      'Bandits (2)',
      'Town guard (1)',
      'Ungrouped (1)',
    ]);
    expect(levelHeadings(4)).toEqual([
      'Red Cap',
      'Knife Sal',
      'Gate warden',
      'Loner',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Bandits (2)' }));
    expect(dashboardUi()?.npcCollapsedGroupNames).toEqual(['Bandits']);
    expect(screen.queryByRole('heading', { name: 'Red Cap' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Knife Sal' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bandits (2)' }));
    expect(dashboardUi()?.npcCollapsedGroupNames).toEqual([]);
  });

  it('asks before deleting and names the library', async () => {
    seed([creature('m', 'Dire Wolf', { kind: 'monster' })]);
    const { unmount } = render(
      <NpcLibrarySection campaignCode={CODE} kind="monster" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Dire Wolf' }));
    let dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent('Delete Dire Wolf?');
    expect(dialog).toHaveTextContent(
      "Dire Wolf is removed from this campaign's custom monsters. Encounters that already include them keep their copy."
    );
    await clickConfirmDialogButton('Cancel');
    expect(storedNames()).toEqual(['Dire Wolf']);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Dire Wolf' }));
    await clickConfirmDialogButton('Delete custom monster');
    expect(storedNames()).toEqual([]);
    unmount();

    seed([creature('a', 'Brenn Ironhand')]);
    render(<NpcLibrarySection campaignCode={CODE} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Brenn Ironhand' })
    );
    dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent(
      "Brenn Ironhand is removed from this campaign's NPCs. Encounters that already include them keep their copy."
    );
    await clickConfirmDialogButton('Delete NPC');
    expect(storedNames()).toEqual([]);
  });

  it('moves focus to the next row, the previous row, then Create after a delete', async () => {
    seed([creature('a', 'A'), creature('b', 'B'), creature('c', 'C')]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete B' }));
    await clickConfirmDialogButton('Delete NPC');
    await waitFor(() => expect(viewButton('C')).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Delete C' }));
    await clickConfirmDialogButton('Delete NPC');
    await waitFor(() => expect(viewButton('A')).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Delete A' }));
    await clickConfirmDialogButton('Delete NPC');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create NPC' })).toHaveFocus()
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'No NPCs yet' })
    ).toBeInTheDocument();
  });

  it('moves focus after Move like it does after a delete', () => {
    seed([creature('a', 'A'), creature('b', 'B'), creature('c', 'C')]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Move B to custom monsters' })
    );
    expect(storedNames()).toEqual(['A', 'B', 'C']);
    expect(
      useNPCStore.getState().npcsByCampaign[CODE].find(n => n.id === 'b')?.kind
    ).toBe('monster');
    expect(viewButton('C')).toHaveFocus();

    fireEvent.click(
      screen.getByRole('button', { name: 'Move C to custom monsters' })
    );
    expect(viewButton('A')).toHaveFocus();

    fireEvent.click(
      screen.getByRole('button', { name: 'Move A to custom monsters' })
    );
    expect(screen.getByRole('button', { name: 'Create NPC' })).toHaveFocus();
  });

  it('closes the open detail dialog when the entry changes kind elsewhere', () => {
    seed([creature('a', 'A'), creature('b', 'B')]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    fireEvent.click(viewButton('A'));
    expect(screen.getByRole('dialog', { name: 'A' })).toBeInTheDocument();

    act(() => {
      useNPCStore.getState().updateNPC(CODE, 'a', { kind: 'monster' });
    });

    expect(screen.queryByRole('dialog', { name: 'A' })).toBeNull();
    expect(levelHeadings(3)).toEqual(['B']);
  });

  it('shows the first new entry after the last one is deleted under a search', async () => {
    seed([creature('a', 'Brenn Ironhand')]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search NPCs' }), {
      target: { value: 'Brenn' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Brenn Ironhand' })
    );
    await clickConfirmDialogButton('Delete NPC');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 3, name: 'No NPCs yet' })
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create NPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save form' }));

    expect(
      screen.getByRole('heading', { level: 3, name: 'Wren' })
    ).toBeInTheDocument();
    expect(screen.queryByText('No NPCs match these filters.')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search NPCs' })).toHaveValue(
      ''
    );
  });

  it('deletes from the detail dialog through the same confirm', async () => {
    seed([creature('a', 'A'), creature('b', 'B')]);
    render(<NpcLibrarySection campaignCode={CODE} />);

    fireEvent.click(viewButton('A'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete from dialog' }));
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent('Delete A?');

    await clickConfirmDialogButton('Delete NPC');
    expect(screen.queryByRole('dialog', { name: 'A' })).toBeNull();
    expect(storedNames()).toEqual(['B']);
    await waitFor(() => expect(viewButton('B')).toHaveFocus());
  });

  describe('closing a published shop on delete', () => {
    const OPEN_SHOP = {
      open: true,
      updatedAt: '2026-09-12T00:00:00.000Z',
      description: 'Ironmonger of the Low Market',
    };

    const expectCloseRequest = (fetchFn: typeof global.fetch) => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toBe(`/api/campaign/${CODE}/shops/a`);
      expect(init.method).toBe('PUT');
      const body = JSON.parse(init.body as string);
      expect(body.npc.shop).toEqual(
        expect.objectContaining({
          open: false,
          description: 'Ironmonger of the Low Market',
        })
      );
      expect(body.entityIds).toEqual([]);
      expect(body.dmId).toBe(useDmStore.getState().dmId);
    };

    it('sends a close request when the deleted NPC has an open shop', async () => {
      const fetchFn = mockFetchResponse(200, { success: true, shop: null });
      seed([creature('a', 'Brenn Ironhand', { shop: OPEN_SHOP })]);
      render(<NpcLibrarySection campaignCode={CODE} />);

      fireEvent.click(
        screen.getByRole('button', { name: 'Delete Brenn Ironhand' })
      );
      await clickConfirmDialogButton('Delete NPC');

      expectCloseRequest(fetchFn);
      expect(storedNames()).toEqual([]);
    });

    it('sends the same close request when deleting from the detail dialog', async () => {
      const fetchFn = mockFetchResponse(200, { success: true, shop: null });
      seed([creature('a', 'Brenn Ironhand', { shop: OPEN_SHOP })]);
      render(<NpcLibrarySection campaignCode={CODE} />);

      fireEvent.click(viewButton('Brenn Ironhand'));
      fireEvent.click(
        screen.getByRole('button', { name: 'Delete from dialog' })
      );
      await clickConfirmDialogButton('Delete NPC');

      expectCloseRequest(fetchFn);
      expect(storedNames()).toEqual([]);
    });

    it.each([
      ['a closed shop', { shop: { ...OPEN_SHOP, open: false } }],
      ['no shop', {}],
    ])('sends nothing for an NPC with %s', async (_label, extra) => {
      const fetchFn = mockFetchResponse(200, { success: true, shop: null });
      seed([creature('a', 'Brenn Ironhand', extra)]);
      render(<NpcLibrarySection campaignCode={CODE} />);

      fireEvent.click(
        screen.getByRole('button', { name: 'Delete Brenn Ironhand' })
      );
      await clickConfirmDialogButton('Delete NPC');

      expect(fetchFn).not.toHaveBeenCalled();
      expect(storedNames()).toEqual([]);
    });
  });

  it('offers Reorder only with two or more entries', () => {
    seed([creature('a', 'Anna')]);
    const { unmount } = render(<NpcLibrarySection campaignCode={CODE} />);
    expect(screen.queryByRole('button', { name: 'Reorder' })).toBeNull();
    unmount();

    seed([creature('a', 'Anna'), creature('b', 'Bo')]);
    render(<NpcLibrarySection campaignCode={CODE} />);
    const reorder = screen.getByRole('button', { name: 'Reorder' });
    expect(reorder).toHaveAttribute('data-variant', 'ghost');
    expect(reorder).toHaveAttribute('aria-pressed', 'false');
    const create = screen.getByRole('button', { name: 'Create NPC' });
    expect(
      reorder.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(reorder.parentElement).toBe(create.parentElement);
  });

  it('moves entries with Move up and Move down while Reorder is on', () => {
    seed([creature('a', 'Anna'), creature('b', 'Bo'), creature('c', 'Cara')]);
    render(<NpcLibrarySection campaignCode={CODE} />);
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();

    const reorder = screen.getByRole('button', { name: 'Reorder' });
    fireEvent.click(reorder);
    expect(reorder).toHaveAttribute('aria-pressed', 'true');
    expect(reorder).toHaveAttribute('data-selected', 'true');

    const downs = screen.getAllByRole('button', { name: 'Move down' });
    expect(downs).toHaveLength(3);
    expect(downs[0]).toHaveAccessibleDescription('Anna');
    expect(
      screen.getAllByRole('button', { name: 'Move up' })[0]
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit Anna' })
    ).toBeInTheDocument();
    expect(viewButton('Anna')).toBeInTheDocument();

    expect(downs[2]).toBeDisabled();

    fireEvent.click(downs[0]);
    expect(storedNames()).toEqual(['Bo', 'Anna', 'Cara']);
    expect(downs[0]).toHaveFocus();

    fireEvent.click(downs[0]);
    expect(storedNames()).toEqual(['Bo', 'Cara', 'Anna']);
    expect(downs[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Move up' })[2]).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
  });

  it('keeps moves inside a group and the filtered list', () => {
    seed([
      creature('a', 'Anna', { group: 'Bandits' }),
      creature('b', 'Bo', { group: 'Bandits' }),
      creature('c', 'Cara', { group: 'Town guard' }),
    ]);
    const { unmount } = render(<NpcLibrarySection campaignCode={CODE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));

    const downOf = (name: string) =>
      screen
        .getAllByRole('button', { name: 'Move down' })
        .find(
          b =>
            b.getAttribute('aria-describedby') &&
            document.getElementById(b.getAttribute('aria-describedby')!)
              ?.textContent === name
        )!;
    const upOf = (name: string) =>
      screen
        .getAllByRole('button', { name: 'Move up' })
        .find(
          b =>
            b.getAttribute('aria-describedby') &&
            document.getElementById(b.getAttribute('aria-describedby')!)
              ?.textContent === name
        )!;
    expect(downOf('Bo')).toBeDisabled();
    expect(upOf('Cara')).toBeDisabled();
    expect(downOf('Cara')).toBeDisabled();
    expect(downOf('Anna')).toBeEnabled();
    unmount();

    seed([creature('a', 'Anna'), creature('b', 'Bo'), creature('c', 'Cara')]);
    render(<NpcLibrarySection campaignCode={CODE} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search NPCs' }), {
      target: { value: 'a' },
    });
    expect(levelHeadings(3)).toEqual(['Anna', 'Cara']);
    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(storedNames()).toEqual(['Cara', 'Bo', 'Anna']);
  });

  it('hides Reorder and its controls when one entry is left', async () => {
    seed([creature('a', 'Anna'), creature('b', 'Bo')]);
    render(<NpcLibrarySection campaignCode={CODE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    expect(screen.getAllByRole('button', { name: 'Move up' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Bo' }));
    await clickConfirmDialogButton('Delete NPC');
    await waitFor(() => expect(storedNames()).toEqual(['Anna']));
    expect(screen.queryByRole('button', { name: 'Reorder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create NPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
    const reorder = screen.getByRole('button', { name: 'Reorder' });
    expect(reorder).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
  });

  it('keeps the sync controls and the magic item library as siblings after the monster section', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    seed([creature('m', 'Dire Wolf', { kind: 'monster' })], {
      monsterSectionOpen: false,
    });
    render(
      <NpcSyncProvider campaignCode={CODE}>
        <NpcLibrarySection
          campaignCode={CODE}
          kind="monster"
          showLibraryExtras
          onGiveMagicItemToPlayer={async () => {}}
        />
      </NpcSyncProvider>
    );

    const monster = screen
      .getByRole('heading', { level: 2, name: 'Custom monsters (1)' })
      .closest('section')!;
    const magic = screen.getByRole('heading', {
      level: 2,
      name: 'Magic items',
    });
    expect(monster).not.toContainElement(magic);
    expect(
      monster.compareDocumentPosition(magic) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(monster).not.toContainElement(screen.getByText('NPC cloud sync'));
  });
});
