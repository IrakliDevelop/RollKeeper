import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { groupRosterEntities } from '@/components/ui/campaign/dm-vtt/rosterGroups';
import { RosterTray } from '@/components/ui/campaign/dm-vtt/RosterTray';

import type { EncounterEntity } from '@/types/encounter';
import type { RosterTrayProps } from '@/components/ui/campaign/dm-vtt/RosterTray';

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
  afterEach(() => cleanup());

  it('shows a no-encounter prompt when hasLinkedEncounter is false', () => {
    render(<RosterTray {...baseProps({ hasLinkedEncounter: false })} />);
    expect(
      screen.getByText(/link an encounter in setup mode/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Aria')).not.toBeInTheDocument();
  });

  it('renders group labels and first-word names for each entity', () => {
    render(<RosterTray {...baseProps()} />);
    expect(screen.getByText('PLAYERS')).toBeInTheDocument();
    expect(screen.getByText('NPCS')).toBeInTheDocument();
    expect(screen.getByText('MONSTERS')).toBeInTheDocument();
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(screen.getByText('Barkeep')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('dims a placed row and shows "On map"; clicking it calls onSelectEntity', () => {
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
    expect(row?.className).toMatch(/opacity-60/);

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

  it('highlights the armed row with the accent-blue classes', () => {
    render(<RosterTray {...baseProps({ armedEntityId: 'm1' })} />);
    const row = screen.getByText('Goblin').closest('button')!;
    expect(row.className).toMatch(/bg-accent-blue-bg/);
    expect(row.className).toMatch(/border-accent-blue-border/);
  });

  it('renders a collapsed pill and expands on click', () => {
    const onToggleCollapsed = vi.fn();
    render(
      <RosterTray {...baseProps({ collapsed: true, onToggleCollapsed })} />
    );

    const pill = screen.getByText('ROSTER').closest('button')!;
    expect(pill).toBeInTheDocument();
    expect(screen.queryByText('PLAYERS')).not.toBeInTheDocument();

    fireEvent.click(pill);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
