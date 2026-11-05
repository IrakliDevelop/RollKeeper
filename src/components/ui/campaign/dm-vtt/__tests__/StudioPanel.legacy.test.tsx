import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioPanel } from '@/components/ui/campaign/dm-vtt/StudioPanel';
import { InitiativeTab } from '@/components/ui/campaign/dm-vtt/StudioPanel/InitiativeTab';
import { TurnControl } from '@/components/ui/campaign/dm-vtt/TurnControl';
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
  id: 'enc-1',
  name: 'Ambush',
  entities: [
    {
      id: 'g',
      type: 'monster',
      name: 'Goblin',
      initiative: 12,
      initiativeModifier: 2,
      currentHp: 7,
      maxHp: 7,
      tempHp: 0,
      armorClass: 15,
      conditions: [],
      isHidden: true,
    },
    {
      id: 'a',
      type: 'player',
      name: 'Aria',
      initiative: 18,
      initiativeModifier: 3,
      currentHp: 20,
      maxHp: 31,
      tempHp: 0,
      armorClass: 16,
      conditions: [],
      concentrationSpell: 'Bless',
    },
  ],
  currentTurn: 1,
  round: 2,
  isActive: true,
  sortOrder: 'initiative',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const base = {
  selectedEntityId: 'g',
  onSelectEntity: noop,
  actions,
  onTabChange: noop,
  encounterHref: '/dm/campaign/C/encounters/enc-1',
  collapsed: false,
  onToggleCollapsed: noop,
};

/** Byte-for-byte guards (R2-4/D10): legacy rendering without new props. */
describe('StudioPanel / InitiativeTab / TurnControl legacy rendering', () => {
  it.each([
    ['initiative active', { encounter, activeTab: 'initiative' as const }],
    [
      'initiative inactive',
      {
        encounter: { ...encounter, isActive: false },
        activeTab: 'initiative' as const,
      },
    ],
    ['no encounter', { encounter: null, activeTab: 'initiative' as const }],
    ['selected', { encounter, activeTab: 'selected' as const }],
    [
      'collapsed',
      { encounter, activeTab: 'initiative' as const, collapsed: true },
    ],
  ])('renders StudioPanel %s unchanged', (_name, props) => {
    const { container } = render(
      <StudioPanel {...base} followNote="Following: Ambush" {...props} />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders InitiativeTab inactive unchanged', () => {
    const { container } = render(
      <InitiativeTab
        encounter={{ ...encounter, isActive: false }}
        selectedEntityId={null}
        onSelectEntity={noop}
        encounterHref="/x"
      />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders TurnControl unchanged', () => {
    const { container } = render(
      <TurnControl round={3} activeName="Aria" onNext={noop} onPrev={noop} />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
