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
import { StudioPanel } from '@/components/ui/campaign/dm-vtt/StudioPanel';

import type { Encounter, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { StudioPanelProps } from '@/components/ui/campaign/dm-vtt/StudioPanel';

// StudioPanel's Tooltips need the provider DmVttScreen wraps around the
// floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: ReactElement) {
  const result = rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    ...result,
    rerender: (next: ReactElement) =>
      result.rerender(<TooltipProvider>{next}</TooltipProvider>),
  };
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
    onSpendResource: vi.fn(() => true),
    onRestoreResource: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onShortRest: vi.fn(),
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
  it('renders a collapsed "Combat" pill that expands on click', () => {
    const onToggleCollapsed = vi.fn();
    render(
      <StudioPanel {...baseProps({ collapsed: true, onToggleCollapsed })} />
    );

    const pill = screen.getByRole('button', { name: 'Combat' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).toHaveAttribute('data-variant', 'secondary');
    expect(pill).not.toHaveAttribute('title');
    expect(screen.queryByText(/COMBAT/)).not.toBeInTheDocument();
    expect(screen.queryByText('Aria Windrider')).not.toBeInTheDocument();

    fireEvent.click(pill);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('collapses from an expanded "Collapse combat panel" button', () => {
    const onToggleCollapsed = vi.fn();
    render(<StudioPanel {...baseProps({ onToggleCollapsed })} />);

    const collapse = screen.getByRole('button', {
      name: 'Collapse combat panel',
    });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(collapse).toHaveAttribute('data-variant', 'ghost');
    expect(collapse).not.toHaveTextContent('▸');

    fireEvent.click(collapse);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('marks the active tab with aria-pressed on ghost buttons', () => {
    const onTabChange = vi.fn();
    render(<StudioPanel {...baseProps({ onTabChange })} />);

    const initiative = screen.getByRole('button', { name: 'Initiative' });
    const selected = screen.getByRole('button', { name: 'Selected' });
    expect(initiative).toHaveAttribute('aria-pressed', 'true');
    expect(initiative).toHaveAttribute('data-variant', 'ghost');
    expect(selected).toHaveAttribute('aria-pressed', 'false');
    expect(selected).toHaveAttribute('data-variant', 'ghost');

    fireEvent.click(initiative);
    expect(onTabChange).toHaveBeenCalledWith('initiative');
  });

  it('links to the encounter page in a new tab', () => {
    render(<StudioPanel {...baseProps()} />);
    const link = screen.getByRole('link', { name: /Encounter page/ });
    expect(link).toHaveAccessibleName(
      /^Encounter page ?\(opens in a new tab\)$/
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', '/dm/campaign/ABCD/encounters/enc1');
    expect(link).toHaveAttribute('data-variant', 'link');
    expect(link).not.toHaveTextContent('↗');
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

  it('keeps initiative content-sized with a viewport-aware height cap', () => {
    render(<StudioPanel {...baseProps()} />);
    const panel = screen.getByTestId('dm-vtt-studio-panel');

    expect(panel).toHaveAttribute('data-active-tab', 'initiative');
    expect(panel.className).not.toContain('bottom-0');
    expect(panel.className).toContain('max-h-[70vh]');
    expect(panel.style.maxHeight).toContain('70dvh');
  });

  it('lets selected details use all remaining viewport height', () => {
    render(
      <StudioPanel
        {...baseProps({ activeTab: 'selected', selectedEntityId: 'm1' })}
      />
    );
    const panel = screen.getByTestId('dm-vtt-studio-panel');

    expect(panel).toHaveAttribute('data-active-tab', 'selected');
    expect(panel.style.maxHeight).not.toContain('min(70dvh');
    expect(panel.style.maxHeight).toContain('100dvh');
  });

  it('clicking a row calls onSelectEntity with that entity id', () => {
    const onSelectEntity = vi.fn();
    render(<StudioPanel {...baseProps({ onSelectEntity })} />);

    fireEvent.click(screen.getByText('Goblin Scout').closest('button')!);
    expect(onSelectEntity).toHaveBeenCalledWith('m1');
  });

  it('marks the active row (sorted[currentTurn]) as the current turn', () => {
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
    expect(activeRow).toHaveAttribute('aria-current', 'true');
    expect(activeRow).toHaveTextContent('Current turn');
    expect(screen.getAllByText('Current turn')).toHaveLength(1);
    const otherRow = screen.getByText('Aria Windrider').closest('button')!;
    expect(otherRow).not.toHaveAttribute('aria-current');
  });

  it('marks the selected row pressed and others not pressed', () => {
    render(<StudioPanel {...baseProps({ selectedEntityId: 'm2' })} />);
    expect(screen.getByText('Goblin Boss').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Goblin Scout').closest('button')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('marks an active AND selected row as both current and pressed', () => {
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
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveTextContent('Current turn');
  });

  it('shows a hidden badge and concentration glyph on the initiative row', () => {
    render(<StudioPanel {...baseProps()} />);
    const row = screen.getByText('Goblin Boss').closest('button')!;
    expect(row).toHaveTextContent('Hidden');
    expect(row).not.toHaveTextContent('hidden');
    expect(row.querySelector('.lucide-brain')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Concentrating on Bane' })
    ).toBeInTheDocument();
    expect(row.querySelector('[title]')).toBeNull();
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
    expect(links).toHaveLength(2);
    links.forEach(link => {
      expect(link).toHaveAttribute('href', '/dm/campaign/ABCD/encounters/enc1');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAccessibleName(
        /^Encounter page ?\(opens in a new tab\)$/
      );
    });
  });

  it('flips to the selected tab and renders CombatantDetail for the selected entity', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <StudioPanel {...baseProps({ selectedEntityId: 'm1', onTabChange })} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Selected' }));
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

  it('clicking a chess piece calls the handler with { chessPiece }', () => {
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
    fireEvent.click(screen.getByRole('radio', { name: 'Rook' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(goblin1, {
      chessPiece: 'rook',
    });
  });

  it('clicking the selected chess piece again clears it ({ chessPiece: undefined })', () => {
    const onTokenIdentityChange = vi.fn();
    render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({
            entities: [aria, { ...goblin1, chessPiece: 'rook' }, goblin2],
          }),
          activeTab: 'selected',
          selectedEntityId: 'm1',
          onTokenIdentityChange,
        })}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Rook' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(
      { ...goblin1, chessPiece: 'rook' },
      { chessPiece: undefined }
    );
  });

  it('clicking "None" clears the chess piece ({ chessPiece: undefined })', () => {
    const onTokenIdentityChange = vi.fn();
    render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({
            entities: [aria, { ...goblin1, chessPiece: 'rook' }, goblin2],
          }),
          activeTab: 'selected',
          selectedEntityId: 'm1',
          onTokenIdentityChange,
        })}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(
      { ...goblin1, chessPiece: 'rook' },
      { chessPiece: undefined }
    );
  });

  it('clicking a color swatch calls the handler with { color }', () => {
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
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(goblin1, {
      color: '#ef4444',
    });
  });

  it('clicking "Clear" on colors sends { color: undefined }', () => {
    const onTokenIdentityChange = vi.fn();
    render(
      <StudioPanel
        {...baseProps({
          encounter: makeEncounter({
            entities: [aria, { ...goblin1, color: '#ef4444' }, goblin2],
          }),
          activeTab: 'selected',
          selectedEntityId: 'm1',
          onTokenIdentityChange,
        })}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Clear' }));
    expect(onTokenIdentityChange).toHaveBeenCalledWith(
      { ...goblin1, color: '#ef4444' },
      { color: undefined }
    );
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

describe('StudioPanel focus across collapse', () => {
  function Harness() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <StudioPanel
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

    await user.click(
      screen.getByRole('button', { name: 'Collapse combat panel' })
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Combat' })).toHaveFocus()
    );

    await user.click(screen.getByRole('button', { name: 'Combat' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Collapse combat panel' })
      ).toHaveFocus()
    );
  });

  it('does not take focus when it mounts expanded', () => {
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();

    render(<StudioPanel {...baseProps()} />);
    expect(outside).toHaveFocus();
    outside.remove();
  });
});
