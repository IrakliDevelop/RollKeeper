import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreatureDrawer, type CreatureDrawerProps } from '..';
import {
  FULL_CREATURE,
  GOBLIN,
  LAIR,
  LEGENDARY_MONSTER,
} from '../CreatureDrawer.fixtures';
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

  it('Escape inside an editable field cancels that edit, not the drawer', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<CreatureDrawer {...p} />);
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Combatant name');
    await user.type(input, '{Escape}');
    expect(screen.queryByLabelText('Combatant name')).not.toBeInTheDocument();
    expect(p.onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'Goblin sheet' })
    ).toBeInTheDocument();
  });

  it('Escape on a non-editable element still closes the drawer', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<CreatureDrawer {...p} />);
    screen.getByRole('button', { name: 'Close sheet' }).focus();
    await user.keyboard('{Escape}');
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

  it('shows the library-sync banner copy for a library-linked NPC', async () => {
    const user = userEvent.setup();
    render(<CreatureDrawer {...props({ entity: FULL_CREATURE })} />);
    await user.click(screen.getByRole('button', { name: /^play$/i }));
    expect(
      screen.getByText(
        'Editing this combatant. Changes also sync back to the NPC library record.'
      )
    ).toBeInTheDocument();
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

  it('uses the spec drawer width (600px tablet, 680px desktop)', () => {
    render(<CreatureDrawer {...props()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('w-[min(600px,100vw)]');
    expect(dialog).toHaveClass('xl:w-[min(680px,100vw)]');
    expect(dialog).not.toHaveClass('w-[min(580px,100vw)]');
  });

  it('returns focus to the opener when it is still on the page', async () => {
    const p = props({ entity: null });
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(<CreatureDrawer {...p} />);
    rerender(<CreatureDrawer {...p} entity={GOBLIN} />);
    await waitFor(() => expect(opener).not.toHaveFocus());
    rerender(<CreatureDrawer {...p} entity={null} />);
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it('moves focus into the Studio panel when the opener unmounted', async () => {
    const p = props({ entity: null });
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    const panel = document.createElement('div');
    panel.dataset.testid = 'dm-vtt-studio-panel';
    const panelButton = document.createElement('button');
    panel.appendChild(panelButton);
    document.body.appendChild(panel);
    opener.focus();
    const { rerender } = render(<CreatureDrawer {...p} />);
    rerender(<CreatureDrawer {...p} entity={GOBLIN} />);
    await waitFor(() => expect(opener).not.toHaveFocus());
    opener.remove(); // the Sheet pill unmounts while the drawer is open
    rerender(<CreatureDrawer {...p} entity={null} />);
    await waitFor(() => expect(panelButton).toHaveFocus());
    panel.remove();
  });

  it('moves focus into the Studio panel when the pill unmounts in the same render that opens the drawer', async () => {
    const panel = document.createElement('div');
    panel.dataset.testid = 'dm-vtt-studio-panel';
    const panelButton = document.createElement('button');
    panel.appendChild(panelButton);
    document.body.appendChild(panel);

    // Mirrors DmVttScreen: `sheetPillEntity` hides the pill in the same
    // render that opens the drawer, so the pill and the drawer's open state
    // flip together, not in separate renders.
    function Harness({ entity }: { entity: CreatureDrawerProps['entity'] }) {
      return (
        <>
          {entity === null && <button>Sheet</button>}
          <CreatureDrawer {...props({ entity })} />
        </>
      );
    }

    const { rerender } = render(<Harness entity={null} />);
    screen.getByRole('button', { name: 'Sheet' }).focus();
    expect(screen.getByRole('button', { name: 'Sheet' })).toHaveFocus();

    rerender(<Harness entity={GOBLIN} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Sheet' })).toBeNull();

    rerender(<Harness entity={null} />);
    await waitFor(() => expect(panelButton).toHaveFocus());
    panel.remove();
  });

  it('closes without throwing when neither the opener nor the Studio panel exist', async () => {
    const p = props({ entity: null });
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(<CreatureDrawer {...p} />);
    rerender(<CreatureDrawer {...p} entity={GOBLIN} />);
    await waitFor(() => expect(opener).not.toHaveFocus());
    opener.remove();
    rerender(<CreatureDrawer {...p} entity={null} />);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(document.body).toHaveFocus();
  });
});
