import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioPanel } from '@/components/ui/campaign/dm-vtt/StudioPanel';
import type { TurnControlProps } from '@/components/ui/campaign/dm-vtt/TurnControl';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { Encounter } from '@/types/encounter';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ loading: false, conditions: [] }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ loading: false, effects: [] }),
}));

afterEach(cleanup);

const noop = () => {};
const actions = new Proxy({} as EntityActions, {
  get: (_target, key) => (key === 'onSpendResource' ? () => true : noop),
});
const encounter: Encounter = {
  id: 'run-a',
  name: 'Run',
  entities: [
    {
      id: 'm-goblin',
      type: 'monster',
      name: 'Goblin',
      initiative: 12,
      initiativeModifier: 0,
      currentHp: 7,
      maxHp: 7,
      tempHp: 0,
      armorClass: 15,
      conditions: [],
    },
  ],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const base = {
  selectedEntityId: 'm-goblin',
  onSelectEntity: noop,
  actions,
  onTabChange: noop,
  encounterHref: '/dm/campaign/C/encounters/x',
  collapsed: false,
  onToggleCollapsed: noop,
};

describe('StudioPanel optional Table props (D10)', () => {
  it('replaces the encounter link and inactive message and renders a toolbar', () => {
    render(
      <StudioPanel
        {...base}
        encounter={encounter}
        activeTab="initiative"
        encounterLink={null}
        toolbar={<p>Scene run toolbar</p>}
        inactiveContent={<p>Choose participants and start</p>}
      />
    );
    expect(screen.queryByText(/Encounter page/)).toBeNull();
    expect(
      screen.queryByText(/Start combat from the encounter page/)
    ).toBeNull();
    expect(screen.getByText('Scene run toolbar')).toBeVisible();
    expect(screen.getByText('Choose participants and start')).toBeVisible();
  });

  it('replaces the empty message and passes detail capabilities', () => {
    const { rerender } = render(
      <StudioPanel
        {...base}
        encounter={null}
        activeTab="initiative"
        emptyContent={<p>No run selected</p>}
      />
    );
    expect(screen.getByText('No run selected')).toBeVisible();
    expect(screen.queryByText('No encounter linked yet.')).toBeNull();
    rerender(
      <StudioPanel
        {...base}
        encounter={encounter}
        activeTab="selected"
        detailCapabilities={() => ({
          hp: false,
          tempHp: false,
          maxHp: false,
          armorClass: false,
          conditions: false,
          reaction: false,
          hidden: false,
          creatureConditions: [],
          readOnlyNote: 'Read-only here',
        })}
      />
    );
    expect(screen.getByText('Read-only here')).toBeVisible();
    expect(screen.queryByTitle('Remove from combat')).toBeNull();
  });

  it('exports TurnControl props', () => {
    const props: TurnControlProps = {
      round: 1,
      activeName: 'Goblin',
      onNext: noop,
      onPrev: noop,
    };
    expect(props.round).toBe(1);
  });

  it('renders rows without real HP for entities waiting on player data (F1)', () => {
    render(
      <StudioPanel
        {...base}
        encounter={{
          ...encounter,
          isActive: true,
          entities: [{ ...encounter.entities[0]!, currentHp: 0, maxHp: 0 }],
        }}
        activeTab="initiative"
        hpUnknownEntityIds={new Set(['m-goblin'])}
      />
    );
    expect(screen.getByText(/HP —/)).toBeVisible();
    expect(screen.queryByText('0/0')).toBeNull();
  });
});
