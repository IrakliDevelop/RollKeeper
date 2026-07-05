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
import type { CampaignNPC } from '@/types/encounter';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock('@/store/npcStore', () => ({
  useNPCStore: () => ({
    getNPCsForCampaign: vi.fn().mockReturnValue([]),
    createNPC: vi.fn(),
    deleteNPC: vi.fn(),
  }),
}));

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
    armorClass: 13,
    maxHp: 20,
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
  it('renders all four tabs', () => {
    render(<AddCombatantDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /npc/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /monster/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
  });

  it('player row click calls onAddEntity with type player and playerCharacterId', () => {
    const onAddEntity = vi.fn();
    render(<AddCombatantDialog {...defaultProps} onAddEntity={onAddEntity} />);

    fireEvent.click(screen.getByRole('button', { name: /player/i }));

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

    // Increment count twice (1 → 2 → 3)
    const plusBtn = screen.getByRole('button', { name: /increase count/i });
    fireEvent.click(plusBtn);
    fireEvent.click(plusBtn);

    // Click Add button
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

    fireEvent.click(screen.getByRole('button', { name: /custom/i }));

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

    // Enemy is default disposition — click Add button
    const addBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addBtn);

    expect(onAddEntity).toHaveBeenCalledOnce();
    const entity = onAddEntity.mock.calls[0][0];
    expect(entity.isHidden).toBe(true);
    expect(entity.playerAlias).toBe('Dark Figure');
    expect(entity.playerDisposition).toBe('enemy');
  });

  it('NPC delete button triggers confirmation dialog', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AddCombatantDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /npc/i }));

    // Town Guard should appear
    const deleteBtn = screen.getByTitle('Delete NPC');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Town Guard')
    );
  });
});
