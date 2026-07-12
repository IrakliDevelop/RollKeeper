import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { StudioPanel } from '@/components/ui/campaign/dm-vtt/StudioPanel';

import type { Encounter, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { StudioPanelProps } from '@/components/ui/campaign/dm-vtt/StudioPanel';

function makeEntity(overrides: Partial<EncounterEntity>): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin',
    initiative: 10,
    initiativeModifier: 0,
    currentHp: 7,
    maxHp: 7,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  } as EncounterEntity;
}

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: 'enc1',
    name: 'Goblin Ambush',
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: true,
    sortOrder: 'initiative',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Encounter;
}

// Every member of EntityActions (src/components/ui/encounter/combat-screen/types.ts)
// stubbed with vi.fn() so CombatantDetail (and its sub-sections) never crash on a
// missing callback.
function makeActions(): EntityActions {
  return {
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onAddTempHp: vi.fn(),
    onSetMaxHp: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onSetConditionRounds: vi.fn(),
    onUseAbility: vi.fn(),
    onRestoreAbility: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onViewPlayer: vi.fn(),
    onViewNPC: vi.fn(),
    onChangePlayerColor: vi.fn(),
    onAdjustCounter: vi.fn(),
  };
}

const aria = makeEntity({
  id: 'p1',
  type: 'player',
  name: 'Aria Windrider',
  initiative: 18,
  currentHp: 24,
  maxHp: 30,
  tempHp: 3,
  armorClass: 16,
});
const goblin1 = makeEntity({
  id: 'm1',
  type: 'monster',
  name: 'Goblin Scout',
  initiative: 14,
  currentHp: 5,
  maxHp: 7,
});
const goblin2 = makeEntity({
  id: 'm2',
  type: 'monster',
  name: 'Goblin Boss',
  initiative: 9,
  currentHp: 20,
  maxHp: 20,
  concentrationSpell: 'Bane',
  isHidden: true,
});

function baseProps(
  overrides: Partial<StudioPanelProps> = {}
): StudioPanelProps {
  return {
    encounter: makeEncounter({ entities: [aria, goblin1, goblin2] }),
    selectedEntityId: null,
    onSelectEntity: vi.fn(),
    actions: makeActions(),
    activeTab: 'initiative',
    onTabChange: vi.fn(),
    encounterHref: '/dm/campaign/ABCD/encounters/enc1',
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    ...overrides,
  };
}

describe('StudioPanel', () => {
  afterEach(() => cleanup());

  it('renders a collapsed pill and expands on click', () => {
    const onToggleCollapsed = vi.fn();
    render(
      <StudioPanel {...baseProps({ collapsed: true, onToggleCollapsed })} />
    );

    const pill = screen.getByText(/combat/i).closest('button')!;
    expect(pill).toBeInTheDocument();
    expect(screen.queryByText('Aria')).not.toBeInTheDocument();

    fireEvent.click(pill);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('renders sorted initiative rows on the initiative tab', () => {
    render(<StudioPanel {...baseProps()} />);
    const names = screen.getAllByText(
      /Aria Windrider|Goblin Scout|Goblin Boss/
    );
    // Order should follow initiative descending: Aria(18) > Scout(14) > Boss(9)
    expect(names.map(n => n.textContent)).toEqual([
      'Aria Windrider',
      'Goblin Scout',
      'Goblin Boss',
    ]);
  });

  it('clicking a row calls onSelectEntity with that entity id', () => {
    const onSelectEntity = vi.fn();
    render(<StudioPanel {...baseProps({ onSelectEntity })} />);

    fireEvent.click(screen.getByText('Goblin Scout').closest('button')!);
    expect(onSelectEntity).toHaveBeenCalledWith('m1');
  });

  it('highlights the active row (sorted[currentTurn]) with amber + pulse styling', () => {
    // Sorted order is [Aria(18), Scout(14), Boss(9)] — currentTurn 1 → Scout is active.
    render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({
            entities: [aria, goblin1, goblin2],
            currentTurn: 1,
          }),
        })}
      />
    );
    const activeRow = screen.getByText('Goblin Scout').closest('button')!;
    expect(activeRow.className).toMatch(/bg-accent-amber-bg/);
    expect(activeRow.className).toMatch(/animate-pulse/);
    const otherRow = screen.getByText('Aria Windrider').closest('button')!;
    expect(otherRow.className).not.toMatch(/animate-pulse/);
  });

  it('gives the selected row a blue border', () => {
    render(<StudioPanel {...baseProps({ selectedEntityId: 'm2' })} />);
    const selectedRow = screen.getByText('Goblin Boss').closest('button')!;
    expect(selectedRow.className).toMatch(/border-accent-blue-border/);
  });

  it('gives an active AND selected row the selected (blue) border, not amber', () => {
    // Sorted order is [Aria(18), Scout(14), Boss(9)] — currentTurn 1 → Scout is active.
    render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({
            entities: [aria, goblin1, goblin2],
            currentTurn: 1,
          }),
          selectedEntityId: 'm1',
        })}
      />
    );
    const row = screen.getByText('Goblin Scout').closest('button')!;
    expect(row.className).toMatch(/border-accent-blue-border/);
    expect(row.className).not.toMatch(/border-accent-amber-border/);
    // Non-border active styling (bg + pulse) is preserved.
    expect(row.className).toMatch(/bg-accent-amber-bg/);
    expect(row.className).toMatch(/animate-pulse/);
  });

  it('shows a hidden badge and concentration glyph on the roster row', () => {
    render(<StudioPanel {...baseProps()} />);
    const row = screen.getByText('Goblin Boss').closest('button')!;
    expect(row).toHaveTextContent(/hidden/i);
    expect(row).toHaveTextContent('🧠');
  });

  it('shows the not-started prompt when combat has not begun', () => {
    render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({
            entities: [aria, goblin1],
            isActive: false,
          }),
        })}
      />
    );
    expect(
      screen.getByText(/start combat from the encounter page/i)
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /encounter page/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach(link =>
      expect(link).toHaveAttribute('href', '/dm/campaign/ABCD/encounters/enc1')
    );
  });

  it('flips to the selected tab and renders CombatantDetail for the selected entity', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <StudioPanel {...baseProps({ selectedEntityId: 'm1', onTabChange })} />
    );

    fireEvent.click(screen.getByRole('button', { name: /selected/i }));
    expect(onTabChange).toHaveBeenCalledWith('selected');

    rerender(
      <StudioPanel
        {...baseProps({
          activeTab: 'selected',
          selectedEntityId: 'm1',
          onTabChange,
        })}
      />
    );
    // CombatantDetail renders the entity's name in its header.
    expect(screen.getByText('Goblin Scout')).toBeInTheDocument();
  });

  it('shows a hint on the selected tab when nothing is selected', () => {
    render(
      <StudioPanel
        {...baseProps({ activeTab: 'selected', selectedEntityId: null })}
      />
    );
    expect(
      screen.getByText(/select a combatant or token/i)
    ).toBeInTheDocument();
  });

  it('renders the follow note when provided', () => {
    render(
      <StudioPanel {...baseProps({ followNote: 'Following: Fight A' })} />
    );
    expect(screen.getByText('Following: Fight A')).toBeInTheDocument();
  });

  it('renders no follow note when null/absent', () => {
    render(<StudioPanel {...baseProps({ followNote: null })} />);
    expect(screen.queryByText(/^Following:/)).not.toBeInTheDocument();
  });

  it('renders the Token settings section on the selected tab when the prop is provided, and calls the handler with the entity + update', () => {
    const onTokenIdentityChange = vi.fn();
    render(
      <StudioPanel
        {...baseProps({
          activeTab: 'selected',
          selectedEntityId: 'm1',
          onTokenIdentityChange,
        })}
      />
    );
    expect(screen.getByText('Token')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'L 2×2' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(goblin1, {
      tokenSize: 2,
    });
  });

  it('does not render the Token settings section when onTokenIdentityChange is absent', () => {
    render(
      <StudioPanel
        {...baseProps({ activeTab: 'selected', selectedEntityId: 'm1' })}
      />
    );
    expect(screen.queryByText('Token')).not.toBeInTheDocument();
  });

  it('resets the portrait input when the selected entity changes (no state bleed)', () => {
    const entityA = makeEntity({
      id: 'm1',
      name: 'Goblin Scout',
      avatarUrl: 'https://example.com/goblin-a.png',
    });
    const entityB = makeEntity({
      id: 'm2',
      name: 'Goblin Boss',
      avatarUrl: undefined,
    });
    const onTokenIdentityChange = vi.fn();
    const { rerender } = render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({ entities: [entityA, entityB] }),
          activeTab: 'selected',
          selectedEntityId: 'm1',
          onTokenIdentityChange,
        })}
      />
    );

    expect(screen.getByLabelText('Portrait URL')).toHaveValue(
      'https://example.com/goblin-a.png'
    );

    rerender(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({ entities: [entityA, entityB] }),
          activeTab: 'selected',
          selectedEntityId: 'm2',
          onTokenIdentityChange,
        })}
      />
    );

    expect(screen.getByLabelText('Portrait URL')).toHaveValue('');
  });
});
