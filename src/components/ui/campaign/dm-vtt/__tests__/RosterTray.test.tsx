import { useState, type ReactElement } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { groupRosterEntities } from '@/components/ui/campaign/dm-vtt/rosterGroups';
import { RosterTray } from '@/components/ui/campaign/dm-vtt/RosterTray';

import type { EncounterEntity } from '@/types/encounter';
import type { RosterTrayProps } from '@/components/ui/campaign/dm-vtt/RosterTray';

// RosterTray's Tooltips need the provider DmVttScreen wraps around the
// floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeEntity(overrides: Partial<EncounterEntity>): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin',
    initiative: null,
    initiativeModifier: 0,
    currentHp: 7,
    maxHp: 7,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  } as EncounterEntity;
}

const player = makeEntity({ id: 'p1', type: 'player', name: 'Aria Windrider' });
const npc = makeEntity({ id: 'n1', type: 'npc', name: 'Barkeep Tomas' });
const monster = makeEntity({ id: 'm1', type: 'monster', name: 'Goblin' });
const lair = makeEntity({ id: 'l1', type: 'lair', name: 'Lair Action' });

function baseProps(overrides: Partial<RosterTrayProps> = {}): RosterTrayProps {
  return {
    entities: [player, npc, monster],
    placedIndex: new Map(),
    armedEntityId: null,
    onArmPlacement: vi.fn(),
    onSelectEntity: vi.fn(),
    onDragStart: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    hasLinkedEncounter: true,
    ...overrides,
  };
}

describe('groupRosterEntities', () => {
  it('splits entities into players/npcs/monsters and drops lair entities', () => {
    const groups = groupRosterEntities([player, npc, monster, lair]);
    expect(groups.players).toEqual([player]);
    expect(groups.npcs).toEqual([npc]);
    expect(groups.monsters).toEqual([monster]);
  });

  it('returns empty arrays for groups with no matching entities', () => {
    const groups = groupRosterEntities([player]);
    expect(groups.npcs).toEqual([]);
    expect(groups.monsters).toEqual([]);
  });
});

describe('RosterTray', () => {
  it('shows a no-encounter prompt when hasLinkedEncounter is false', () => {
    render(<RosterTray {...baseProps({ hasLinkedEncounter: false })} />);
    expect(
      screen.getByText(/link an encounter in setup mode/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Aria')).not.toBeInTheDocument();
  });

  it('shows an empty-encounter prompt when linked but no entities', () => {
    render(
      <RosterTray {...baseProps({ hasLinkedEncounter: true, entities: [] })} />
    );
    expect(
      screen.getByText(/no combatants in the linked encounter yet/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/link an encounter in setup mode/i)
    ).not.toBeInTheDocument();
  });

  it('renders group headings and first-word names for each entity', () => {
    render(<RosterTray {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Players' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NPCs' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Monsters' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/PLAYERS|NPCS|MONSTERS/)).not.toBeInTheDocument();
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(screen.getByText('Barkeep')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('sizes to its content with a viewport-aware height cap', () => {
    render(<RosterTray {...baseProps()} />);
    const panel = screen.getByTestId('dm-vtt-roster-panel');

    expect(panel.className).not.toContain('bottom-0');
    expect(panel.className).toContain('max-h-[70vh]');
    expect(panel.style.maxHeight).toContain('70dvh');
  });

  it('shows "On map" on a placed row; clicking it calls onSelectEntity', () => {
    const onSelectEntity = vi.fn();
    const onArmPlacement = vi.fn();
    const placedIndex = new Map([['m1', ['token-1']]]);
    render(
      <RosterTray
        {...baseProps({ placedIndex, onSelectEntity, onArmPlacement })}
      />
    );

    const label = screen.getByText('On map');
    expect(label).toBeInTheDocument();
    const row = label.closest('button');
    expect(row).not.toBeNull();
    expect(row).not.toHaveAttribute('aria-pressed');

    fireEvent.click(row!);
    expect(onSelectEntity).toHaveBeenCalledWith('m1');
    expect(onArmPlacement).not.toHaveBeenCalled();
  });

  it('clicking an unplaced row calls onArmPlacement with the entity', () => {
    const onArmPlacement = vi.fn();
    const onSelectEntity = vi.fn();
    render(<RosterTray {...baseProps({ onArmPlacement, onSelectEntity })} />);

    const row = screen.getByText('Goblin').closest('button')!;
    fireEvent.click(row);

    expect(onArmPlacement).toHaveBeenCalledWith(monster);
    expect(onSelectEntity).not.toHaveBeenCalled();
  });

  it('forwards pointerdown on an unplaced row to onDragStart', () => {
    const onDragStart = vi.fn();
    render(<RosterTray {...baseProps({ onDragStart })} />);

    const row = screen.getByText('Goblin').closest('button')!;
    fireEvent.pointerDown(row);

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragStart.mock.calls[0][0]).toEqual(monster);
  });

  it('labels unplaced rows "Place on map"', () => {
    render(<RosterTray {...baseProps({ entities: [monster] })} />);
    expect(screen.getByText('Place on map')).toBeInTheDocument();
    expect(screen.queryByText(/Tap/)).not.toBeInTheDocument();
  });

  it('marks the armed row pressed and other unplaced rows not pressed', () => {
    const placedIndex = new Map([['p1', ['token-1']]]);
    render(<RosterTray {...baseProps({ armedEntityId: 'm1', placedIndex })} />);
    expect(screen.getByText('Goblin').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Barkeep').closest('button')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByText('Aria').closest('button')).not.toHaveAttribute(
      'aria-pressed'
    );
  });

  it('renders a collapsed "Roster" pill that expands on click', () => {
    const onToggleCollapsed = vi.fn();
    render(
      <RosterTray {...baseProps({ collapsed: true, onToggleCollapsed })} />
    );

    const pill = screen.getByRole('button', { name: 'Roster' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).not.toHaveAttribute('title');
    expect(
      screen.queryByRole('heading', { name: 'Players' })
    ).not.toBeInTheDocument();

    fireEvent.click(pill);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('collapses from an expanded "Collapse roster" button', () => {
    const onToggleCollapsed = vi.fn();
    render(<RosterTray {...baseProps({ onToggleCollapsed })} />);

    const collapse = screen.getByRole('button', { name: 'Collapse roster' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(collapse).toHaveAttribute('data-variant', 'ghost');

    fireEvent.click(collapse);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});

describe('RosterTray focus across collapse', () => {
  function Harness() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <RosterTray
        {...baseProps({
          collapsed,
          onToggleCollapsed: () => setCollapsed(c => !c),
        })}
      />
    );
  }

  it('moves focus to the pill after collapsing and back after expanding', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Collapse roster' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Roster' })).toHaveFocus()
    );

    await user.click(screen.getByRole('button', { name: 'Roster' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Collapse roster' })
      ).toHaveFocus()
    );
  });
});

describe('RosterRow player eye button', () => {
  const playerWithPc = makeEntity({
    id: 'p2',
    type: 'player',
    name: 'Aria Windrider',
    playerCharacterId: 'char-9',
  });

  it('renders an eye for player rows with a playerCharacterId and fires onViewPlayer', () => {
    const onViewPlayer = vi.fn();
    render(
      <RosterTray {...baseProps({ entities: [playerWithPc], onViewPlayer })} />
    );

    const eye = screen.getByRole('button', { name: 'View Aria details' });
    expect(eye).toHaveAttribute('data-variant', 'ghost');
    expect(eye).not.toHaveAttribute('title');
    fireEvent.click(eye);
    expect(onViewPlayer).toHaveBeenCalledWith('char-9');
  });

  it('renders no eye for monsters, players without playerCharacterId, or when onViewPlayer is absent', () => {
    const onViewPlayer = vi.fn();
    const bareplayer = makeEntity({ id: 'p3', type: 'player', name: 'Bo' });
    const { unmount } = render(
      <RosterTray
        {...baseProps({ entities: [monster, bareplayer], onViewPlayer })}
      />
    );
    expect(screen.queryByLabelText(/View .* details/)).not.toBeInTheDocument();
    unmount();

    render(<RosterTray {...baseProps({ entities: [playerWithPc] })} />);
    expect(screen.queryByLabelText(/View .* details/)).not.toBeInTheDocument();
  });

  it('eye click does not arm placement; the row click still does', () => {
    const onViewPlayer = vi.fn();
    const onArmPlacement = vi.fn();
    render(
      <RosterTray
        {...baseProps({
          entities: [playerWithPc],
          onViewPlayer,
          onArmPlacement,
        })}
      />
    );

    fireEvent.click(screen.getByLabelText('View Aria details'));
    expect(onArmPlacement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Aria'));
    expect(onArmPlacement).toHaveBeenCalledTimes(1);
  });
});
