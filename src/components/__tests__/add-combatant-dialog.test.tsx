// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { AddCombatantDialog } from '@/components/ui/encounter/combat-screen/AddCombatantDialog';
import userEvent from '@testing-library/user-event';
import type { CampaignNPC } from '@/types/encounter';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  queryConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock('@/store/npcStore', () => {
  const store = {
    npcsByCampaign: {},
    getNPCsForCampaign: vi.fn().mockReturnValue([]),
    createNPC: vi.fn(),
    deleteNPC: vi.fn(),
  };
  return {
    useNPCStore: (selector?: (state: typeof store) => unknown) =>
      selector ? selector(store) : store,
  };
});

const campaignPlayers = [
  {
    id: 'p1',
    name: 'Thorin',
    class: 'Fighter',
    level: 5,
    armorClass: 18,
    currentHp: 40,
    maxHp: 50,
    dexterity: 14,
  },
];

const npcs: CampaignNPC[] = [
  {
    id: 'npc1',
    campaignCode: 'CAMP1',
    name: 'Town Guard',
    group: 'City Watch',
    armorClass: '13',
    maxHp: 20,
    speed: '30 ft.',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'npc2',
    campaignCode: 'CAMP1',
    name: 'Forest Scout',
    group: 'Rangers',
    armorClass: '14',
    maxHp: 16,
    speed: '35 ft.',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'monster1',
    campaignCode: 'CAMP1',
    name: 'Bone Colossus',
    group: 'Crypt Horrors',
    kind: 'monster',
    armorClass: '17',
    maxHp: 95,
    speed: '30 ft.',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onAddEntity: vi.fn(),
  campaignCode: 'CAMP1',
  campaignPlayers,
  npcs,
};

const mockMonster = {
  id: 'goblin',
  name: 'Goblin',
  size: ['Small'],
  type: 'humanoid',
  alignment: 'neutral evil',
  ac: '15 (leather armor, shield)',
  hp: '7 (2d6)',
  speed: '30 ft.',
  str: 8,
  dex: 14,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  saves: '',
  skills: '',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  senses: 'darkvision 60 ft.',
  passivePerception: 9,
  languages: 'Common, Goblin',
  cr: '1/4',
  source: 'MM',
  page: 166,
  acValue: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  legendaryActionCount: 0,
  conditionImmunities: [],
  actions: [{ name: 'Scimitar', text: 'Attack.' }],
};

describe('AddCombatantDialog', () => {
  it('has one sentence-case title and keyboard tabs with stable panel ids', async () => {
    const user = userEvent.setup();
    render(<AddCombatantDialog {...defaultProps} />);
    expect(
      screen.getByRole('dialog', { name: 'Add combatant' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'Add combatant' })
    ).toHaveLength(1);
    expect(screen.queryByText('Encounter Roster')).not.toBeInTheDocument();
    const monsterTab = screen.getByRole('tab', { name: 'Monster' });
    monsterTab.focus();
    await user.keyboard('{ArrowRight}');
    const customTab = screen.getByRole('tab', { name: 'Custom' });
    expect(customTab).toHaveFocus();
    expect(customTab).toHaveAttribute('aria-selected', 'true');
    expect(
      document.getElementById(customTab.getAttribute('aria-controls')!)
    ).toBeInTheDocument();
  });
  it('renders all four tabs', () => {
    render(<AddCombatantDialog {...defaultProps} />);
    expect(screen.getByRole('tab', { name: /player/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /npc/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /monster/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /custom/i })).toBeInTheDocument();
  });

  it('player row click calls onAddEntity with type player and playerCharacterId', () => {
    const onAddEntity = vi.fn();
    render(<AddCombatantDialog {...defaultProps} onAddEntity={onAddEntity} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /player/i }), {
      button: 0,
      ctrlKey: false,
    });

    // Thorin row should appear
    const thorinRow = screen.getByText('Thorin').closest('button');
    expect(thorinRow).not.toBeNull();
    fireEvent.click(thorinRow!);

    expect(onAddEntity).toHaveBeenCalledOnce();
    const entity = onAddEntity.mock.calls[0][0];
    expect(entity.type).toBe('player');
    expect(entity.playerCharacterId).toBe('p1');
  });

  it('monster count=3 emits 3 entities with A/B/C suffixes and same color', async () => {
    const onAddEntity = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ monsters: [mockMonster] }),
    } as unknown as Response);

    render(<AddCombatantDialog {...defaultProps} onAddEntity={onAddEntity} />);

    // Monster tab is default — type in search
    const searchInput = screen.getByPlaceholderText(/search the bestiary/i);
    fireEvent.change(searchInput, { target: { value: 'goblin' } });

    // waitFor retries until Goblin appears (after 300ms debounce + fetch resolves)
    await waitFor(
      () => {
        expect(screen.getByText('Goblin')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Click Goblin result to enter detail view
    fireEvent.click(screen.getByText('Goblin'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Count' }), {
      target: { value: '3' },
    });

    // Click Add button (now in anchored footer)
    fireEvent.click(screen.getByRole('button', { name: /add goblin/i }));

    expect(onAddEntity).toHaveBeenCalledTimes(3);
    const calls = onAddEntity.mock.calls.map(c => c[0]);
    expect(calls[0].name).toBe('Goblin A');
    expect(calls[1].name).toBe('Goblin B');
    expect(calls[2].name).toBe('Goblin C');
    // All same color (group color from colorIdx=0)
    expect(calls[0].color).toBe(calls[1].color);
    expect(calls[1].color).toBe(calls[2].color);
  }, 10000);

  it('custom add carries isHidden, playerAlias, and playerDisposition', () => {
    const onAddEntity = vi.fn();
    render(<AddCombatantDialog {...defaultProps} onAddEntity={onAddEntity} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /custom/i }), {
      button: 0,
      ctrlKey: false,
    });

    // Fill name
    const nameInput = screen.getByPlaceholderText(/cursed statue/i);
    fireEvent.change(nameInput, { target: { value: 'Shadow Wraith' } });

    // Check hide name (SharedOptions renders after name)
    const hideCheckbox = screen.getByRole('checkbox', {
      name: /hide name from players/i,
    });
    fireEvent.click(hideCheckbox);

    // Alias input should now be visible
    const aliasInput = screen.getByPlaceholderText(/name players see/i);
    fireEvent.change(aliasInput, { target: { value: 'Dark Figure' } });

    // Enemy is default disposition — click Add button (now in anchored footer)
    const addBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addBtn);

    expect(onAddEntity).toHaveBeenCalledOnce();
    const entity = onAddEntity.mock.calls[0][0];
    expect(entity.isHidden).toBe(true);
    expect(entity.playerAlias).toBe('Dark Figure');
    expect(entity.playerDisposition).toBe('enemy');
  });

  it('custom combatant can save a fully editable stat block', () => {
    const onAddEntity = vi.fn();
    render(<AddCombatantDialog {...defaultProps} onAddEntity={onAddEntity} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /custom/i }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.change(screen.getByPlaceholderText(/cursed statue/i), {
      target: { value: 'Clockwork Sentry' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^edit stat block$/i }));

    fireEvent.change(screen.getByRole('textbox', { name: /str score/i }), {
      target: { value: '18' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^type$/i }), {
      target: { value: 'construct' },
    });
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: /actions and traits/i }),
      { button: 0, ctrlKey: false }
    );
    fireEvent.click(screen.getByRole('button', { name: /add actions entry/i }));
    fireEvent.change(
      screen.getByRole('textbox', { name: /actions entry name/i }),
      { target: { value: 'Slam' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: /actions entry text/i }),
      { target: { value: 'Melee Weapon Attack: +6 to hit.' } }
    );

    fireEvent.click(screen.getByRole('button', { name: /add npc/i }));

    const entity = onAddEntity.mock.calls[0][0];
    expect(entity.monsterStatBlock).toMatchObject({
      str: 18,
      type: 'construct',
      actions: [{ name: 'Slam', text: 'Melee Weapon Attack: +6 to hit.' }],
    });
    expect(entity.proficiencyBonus).toBe(2);
    expect(entity.abilities).toEqual([]);
  });

  it('NPC delete button triggers confirmation dialog', async () => {
    renderConfirmDialogHost();
    render(<AddCombatantDialog {...defaultProps} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /npc/i }), {
      button: 0,
      ctrlKey: false,
    });

    // Town Guard should appear
    const deleteBtn = screen.getByRole('button', {
      name: /delete town guard/i,
    });
    fireEvent.click(deleteBtn);

    expect(await findConfirmDialog()).toHaveAccessibleName(
      'Delete Town Guard?'
    );
    await clickConfirmDialogButton('Cancel');
  });

  it('does not ask to delete an NPC when no campaign is loaded', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderConfirmDialogHost();
    render(<AddCombatantDialog {...defaultProps} campaignCode="" />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /npc/i }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole('button', { name: /delete town guard/i }));

    await Promise.resolve();
    expect(queryConfirmDialog()).toBeNull();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('searches saved NPCs by name, group, or tag and excludes custom monsters', () => {
    render(<AddCombatantDialog {...defaultProps} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^npc$/i }), {
      button: 0,
      ctrlKey: false,
    });
    const search = screen.getByRole('textbox', {
      name: /search saved creatures by name, group, or tag/i,
    });
    expect(screen.getByText('Town Guard')).toBeInTheDocument();
    expect(screen.getByText('Forest Scout')).toBeInTheDocument();
    expect(screen.queryByText('Bone Colossus')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'city watch' } });
    expect(screen.getByText('Town Guard')).toBeInTheDocument();
    expect(screen.queryByText('Forest Scout')).not.toBeInTheDocument();
  });

  it('adds a saved custom monster from the Custom tab with its persistent source link', () => {
    const onAddEntity = vi.fn();
    render(<AddCombatantDialog {...defaultProps} onAddEntity={onAddEntity} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^custom$/i }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByText('Bone Colossus'));

    expect(onAddEntity).toHaveBeenCalledOnce();
    expect(onAddEntity.mock.calls[0][0]).toMatchObject({
      name: 'Bone Colossus',
      type: 'monster',
      npcSourceId: 'monster1',
      campaignCode: 'CAMP1',
    });
  });

  it('monster add button is anchored outside the scrollable body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ monsters: [mockMonster] }),
    } as unknown as Response);

    render(<AddCombatantDialog {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search the bestiary/i);
    fireEvent.change(searchInput, { target: { value: 'goblin' } });

    await waitFor(
      () => {
        expect(screen.getByText('Goblin')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    fireEvent.click(screen.getByText('Goblin'));

    const footer = screen.getByTestId('dialog-footer');
    const addBtn = screen.getByRole('button', { name: /add goblin/i });
    expect(footer).toContainElement(addBtn);

    const body = screen.getByRole('tabpanel');
    expect(body).not.toContainElement(addBtn);
  }, 10000);

  it('custom Add button resets form state so name field is empty on reopen', () => {
    const onOpenChange = vi.fn();
    const onAddEntity = vi.fn();
    const { rerender } = render(
      <AddCombatantDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onAddEntity={onAddEntity}
        open={true}
      />
    );

    // Switch to Custom tab and fill name
    fireEvent.mouseDown(screen.getByRole('tab', { name: /custom/i }), {
      button: 0,
      ctrlKey: false,
    });
    const nameInput = screen.getByPlaceholderText(/cursed statue/i);
    fireEvent.change(nameInput, { target: { value: 'Shadow Wraith' } });
    expect((nameInput as HTMLInputElement).value).toBe('Shadow Wraith');

    // Click the footer Add button (footer is visible because name is non-empty)
    fireEvent.click(screen.getByRole('button', { name: /add npc/i }));

    // handleAdd should have called handleOpenChange(false) which resets state
    expect(onAddEntity).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Simulate close → reopen
    rerender(
      <AddCombatantDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onAddEntity={onAddEntity}
        open={false}
      />
    );
    rerender(
      <AddCombatantDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onAddEntity={onAddEntity}
        open={true}
      />
    );

    // Switch back to Custom tab — name field must be empty
    fireEvent.mouseDown(screen.getByRole('tab', { name: /custom/i }), {
      button: 0,
      ctrlKey: false,
    });
    const nameInputAfterReopen = screen.getByPlaceholderText(
      /cursed statue/i
    ) as HTMLInputElement;
    expect(nameInputAfterReopen.value).toBe('');
  });

  it('X close button resets custom form state', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <AddCombatantDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        open={true}
      />
    );

    // Switch to Custom tab
    fireEvent.mouseDown(screen.getByRole('tab', { name: /custom/i }), {
      button: 0,
      ctrlKey: false,
    });

    // Type a name into the Name field
    const nameInput = screen.getByPlaceholderText(/cursed statue/i);
    fireEvent.change(nameInput, { target: { value: 'Test Enemy' } });
    expect((nameInput as HTMLInputElement).value).toBe('Test Enemy');

    // Click X close button
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    // Verify onOpenChange was called with false (proving X calls handleOpenChange)
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Re-render with open={true}
    rerender(
      <AddCombatantDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        open={true}
      />
    );

    // Switch to Custom tab again
    fireEvent.mouseDown(screen.getByRole('tab', { name: /custom/i }), {
      button: 0,
      ctrlKey: false,
    });

    // Verify name field is now empty (state was reset when X was clicked)
    const nameInputAfterReopen = screen.getByPlaceholderText(
      /cursed statue/i
    ) as HTMLInputElement;
    expect(nameInputAfterReopen.value).toBe('');
  });
});
