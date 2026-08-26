// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PreCombatControls } from './PreCombatControls';
import type { Encounter, EncounterEntity } from '@/types/encounter';

afterEach(cleanup);

const goblin: EncounterEntity = {
  id: 'e1',
  type: 'monster',
  name: 'Goblin',
  initiative: 15,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
};

const thorin: EncounterEntity = {
  id: 'e2',
  type: 'player',
  name: 'Thorin',
  initiative: null,
  initiativeModifier: 2,
  currentHp: 35,
  maxHp: 44,
  tempHp: 0,
  armorClass: 18,
  conditions: [],
  playerCharacterId: 'char-1',
};

const encounterWithPlayers: Encounter = {
  id: 'enc-1',
  name: 'Test Encounter',
  campaignCode: 'ABC123',
  entities: [goblin, thorin],
  currentTurn: 0,
  round: 0,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const baseProps = {
  encounter: encounterWithPlayers,
  onStartCombat: vi.fn(),
  onRollAllInitiatives: vi.fn(),
  onRequestPlayerRolls: vi.fn(),
  requestActive: false,
  waitingNames: [] as string[],
  canRequestRolls: true,
};

describe('PreCombatControls — request player rolls', () => {
  it('renders "Request player rolls" when campaign-linked with players', () => {
    render(<PreCombatControls {...baseProps} />);
    expect(
      screen.getByRole('button', { name: /request player rolls/i })
    ).toBeInTheDocument();
  });

  it('fires onRequestPlayerRolls when clicked', () => {
    const onRequestPlayerRolls = vi.fn();
    render(
      <PreCombatControls
        {...baseProps}
        onRequestPlayerRolls={onRequestPlayerRolls}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /request player rolls/i })
    );
    expect(onRequestPlayerRolls).toHaveBeenCalledOnce();
  });

  it('shows "Re-request" label and waiting names when requestActive', () => {
    render(
      <PreCombatControls
        {...baseProps}
        requestActive
        waitingNames={['Thorin']}
      />
    );
    expect(
      screen.getByRole('button', { name: /re-request player rolls/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/waiting for: thorin/i)).toBeInTheDocument();
  });

  it('is hidden when canRequestRolls is false', () => {
    render(<PreCombatControls {...baseProps} canRequestRolls={false} />);
    expect(
      screen.queryByRole('button', { name: /request player rolls/i })
    ).not.toBeInTheDocument();
  });
});
