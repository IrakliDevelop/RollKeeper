import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CombatantDetail } from '../CombatantDetail';
import type { EntityActions } from '../../types';
import type { EncounterEntity } from '@/types/encounter';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ loading: false, conditions: [] }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ loading: false, effects: [] }),
}));

afterEach(cleanup);

const noop = () => {};
const actions: EntityActions = {
  onUpdate: noop,
  onRemove: noop,
  onDamage: noop,
  onHeal: noop,
  onAddTempHp: noop,
  onSetMaxHp: noop,
  onAddCondition: noop,
  onRemoveCondition: noop,
  onSetConditionRounds: noop,
  onUseAbility: noop,
  onRestoreAbility: noop,
  onSpendResource: () => true,
  onRestoreResource: noop,
  onUseLegendaryAction: noop,
  onResetLegendaryActions: noop,
  onSetConcentration: noop,
  onUseLairAction: noop,
  onSetInitiative: noop,
  onLongRest: noop,
  onShortRest: noop,
  onViewNPC: noop,
};

const npc: EncounterEntity = {
  id: 'npc-1',
  type: 'npc',
  name: 'Captain Vex',
  initiative: 12,
  initiativeModifier: 2,
  proficiencyBonus: 2,
  currentHp: 0,
  maxHp: 30,
  tempHp: 4,
  armorClass: 15,
  tempAc: 2,
  conditions: [
    { id: 'c-1', name: 'Prone', kind: 'debuff', rounds: 2, source: 'dm' },
  ],
  concentrationSpell: 'Bless',
  hasUsedReaction: true,
  npcSourceId: 'npc-source',
  deathSaves: { successes: 1, failures: 1, isStabilized: false },
  hitDice: { current: 2, max: 4, dieType: 'd8' },
  isHidden: true,
  playerAlias: 'Masked figure',
  legendaryActions: {
    maxActions: 2,
    usedActions: 1,
    actions: [{ id: 'l-1', name: 'Swipe', cost: 1, description: 'Swipe.' }],
  },
};

const player: EncounterEntity = {
  id: 'player-1',
  type: 'player',
  name: 'Aria',
  initiative: 18,
  initiativeModifier: 3,
  currentHp: 20,
  maxHp: 31,
  tempHp: 2,
  armorClass: 16,
  conditions: [
    { id: 'psync-prone', name: 'Prone', source: 'player-sync' },
    { id: 'dm-1', name: 'Hexed', source: 'dm', rounds: 1 },
  ],
  hasUsedReaction: false,
  playerCharacterId: 'char-aria',
};

/**
 * Byte-for-byte guard (R2-4): without the optional `capabilities` prop the
 * legacy combat-screen detail renders exactly as before PR03.
 */
describe('CombatantDetail legacy rendering', () => {
  it.each([
    ['npc', npc],
    ['player', player],
  ])('renders the %s detail unchanged', (_name, entity) => {
    const { container } = render(
      <CombatantDetail entity={entity} actions={actions} />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
