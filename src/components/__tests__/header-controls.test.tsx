// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderControls } from '@/components/ui/encounter/combat-screen/detail/HeaderControls';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(cleanup);

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

const monsterEntity: EncounterEntity = {
  id: 'monster-1',
  type: 'monster',
  name: 'Goblin Boss',
  initiative: 15,
  initiativeModifier: 1,
  currentHp: 21,
  maxHp: 21,
  tempHp: 0,
  armorClass: 17,
  conditions: [],
};

const playerEntity: EncounterEntity = {
  id: 'player-1',
  type: 'player',
  name: 'Aragorn',
  initiative: 18,
  initiativeModifier: 3,
  currentHp: 40,
  maxHp: 44,
  tempHp: 0,
  armorClass: 16,
  conditions: [],
  playerCharacterId: 'char-a',
};

const SHOW_LABEL = 'Show exact HP to players';
const HIDE_LABEL = 'Hide HP from players';

describe('HeaderControls — HP visibility toggle', () => {
  it('is off by default: unpressed "Show exact HP to players" button and no summary', () => {
    render(<HeaderControls entity={monsterEntity} actions={makeActions()} />);
    const button = screen.getByRole('button', { name: SHOW_LABEL });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.queryByRole('button', { name: HIDE_LABEL })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Players see:/)).not.toBeInTheDocument();
  });

  it('turns the flag on when clicked', async () => {
    const actions = makeActions();
    render(<HeaderControls entity={monsterEntity} actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: SHOW_LABEL }));
    expect(actions.onUpdate).toHaveBeenCalledTimes(1);
    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      hpVisibleToPlayers: true,
    });
  });

  it('shows a pressed "Hide HP from players" button when on, and turns the flag off when clicked', async () => {
    const actions = makeActions();
    render(
      <HeaderControls
        entity={{ ...monsterEntity, hpVisibleToPlayers: true }}
        actions={actions}
      />
    );
    const button = screen.getByRole('button', { name: HIDE_LABEL });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      hpVisibleToPlayers: false,
    });
  });

  it('summary shows the real name plus "· exact HP" when only the HP toggle is on', () => {
    render(
      <HeaderControls
        entity={{ ...monsterEntity, hpVisibleToPlayers: true }}
        actions={makeActions()}
      />
    );
    expect(screen.getByText(/Players see:/).textContent).toBe(
      'Players see: Goblin Boss · exact HP'
    );
  });

  it('summary appends "· exact HP" to a hidden entity and to an alias', () => {
    const { unmount } = render(
      <HeaderControls
        entity={{ ...monsterEntity, isHidden: true, hpVisibleToPlayers: true }}
        actions={makeActions()}
      />
    );
    expect(screen.getByText(/Players see:/).textContent).toBe(
      'Players see: Enemy · exact HP'
    );
    unmount();

    render(
      <HeaderControls
        entity={{
          ...monsterEntity,
          playerAlias: 'Hooded Figure',
          hpVisibleToPlayers: true,
        }}
        actions={makeActions()}
      />
    );
    expect(screen.getByText(/Players see:/).textContent).toBe(
      'Players see: Hooded Figure · exact HP'
    );
  });

  it('summary is unchanged when the HP toggle is off', () => {
    render(
      <HeaderControls
        entity={{ ...monsterEntity, playerAlias: 'Hooded Figure' }}
        actions={makeActions()}
      />
    );
    expect(screen.getByText(/Players see:/).textContent).toBe(
      'Players see: Hooded Figure'
    );
  });

  it('renders nothing for player entities, even with the flag set', () => {
    const { container } = render(
      <HeaderControls
        entity={{ ...playerEntity, hpVisibleToPlayers: true }}
        actions={makeActions()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
