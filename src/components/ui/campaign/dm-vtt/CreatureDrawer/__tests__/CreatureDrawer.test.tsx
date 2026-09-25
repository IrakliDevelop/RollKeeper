import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreatureDrawer, type CreatureDrawerProps } from '..';
import { GOBLIN, LAIR, LEGENDARY_MONSTER } from '../CreatureDrawer.fixtures';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ conditions: [], loading: false }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ effects: [], loading: false }),
}));

afterEach(() => cleanup());

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
  };
}

function props(
  overrides: Partial<CreatureDrawerProps> = {}
): CreatureDrawerProps {
  return {
    entity: GOBLIN,
    actions: makeActions(),
    isTurn: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('CreatureDrawer', () => {
  it('renders nothing when entity is null', () => {
    render(<CreatureDrawer {...props({ entity: null })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a dialog titled "<name> sheet", on the Actions tab', () => {
    render(<CreatureDrawer {...props()} />);
    expect(
      screen.getByRole('dialog', { name: 'Goblin sheet' })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /actions/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getByRole('tab', { name: /stat block/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /effects/i })).toBeInTheDocument();
  });

  it('shows the Their turn badge when isTurn', () => {
    render(<CreatureDrawer {...props({ isTurn: true })} />);
    expect(screen.getByText('Their turn')).toBeInTheDocument();
  });

  it('counts active effects on the Effects tab', () => {
    render(<CreatureDrawer {...props({ entity: LEGENDARY_MONSTER })} />);
    expect(screen.getByRole('tab', { name: /effects/i })).toHaveTextContent(
      'Effects1'
    );
  });

  it('calls onClose on Escape', () => {
    const p = props();
    render(<CreatureDrawer {...p} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalled();
  });

  it('calls onClose from the close button', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<CreatureDrawer {...p} />);
    await user.click(screen.getByRole('button', { name: 'Close sheet' }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('shows the editing banner and leaves it with Done', async () => {
    const user = userEvent.setup();
    render(<CreatureDrawer {...props()} />);
    await user.click(screen.getByRole('button', { name: /^play$/i }));
    expect(
      screen.getByText(
        'Editing this combatant. Changes stay on this combatant.'
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.queryByText(/editing this combatant/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Max HP')).not.toBeInTheDocument();
  });

  it('resets editing and the tab when switching entities', async () => {
    const user = userEvent.setup();
    const p = props();
    const { rerender } = render(<CreatureDrawer {...p} />);
    await user.click(screen.getByRole('button', { name: /^play$/i }));
    await user.click(screen.getByRole('tab', { name: /effects/i }));
    expect(screen.getByLabelText('Max HP')).toBeInTheDocument();

    rerender(<CreatureDrawer {...p} entity={LEGENDARY_MONSTER} />);
    expect(screen.queryByLabelText('Max HP')).not.toBeInTheDocument();
    expect(screen.queryByText(/editing this combatant/i)).toBeNull();
    expect(screen.getByRole('tab', { name: /actions/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('lair entities use a single Lair tab', () => {
    render(<CreatureDrawer {...props({ entity: LAIR })} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent('Lair');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Magma Eruption')).toBeInTheDocument();
  });
});
