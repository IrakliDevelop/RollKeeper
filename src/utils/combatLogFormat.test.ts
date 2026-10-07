import { describe, expect, it } from 'vitest';

import { useCombatLogStore } from '@/store/combatLogStore';
import type { CombatLogEvent } from '@/types/combatLog';

import { formatCombatLogEvent } from './combatLogFormat';

const base = {
  id: 'e',
  timestamp: '2026-10-07T00:00:00.000Z',
  round: 2,
  turn: 0,
  encounterId: 'run-1',
};

const EVENTS: CombatLogEvent[] = [
  {
    ...base,
    type: 'damage',
    sourceId: 'dm',
    sourceName: 'DM',
    targetId: 'm-1',
    targetName: 'Goblin',
    amount: 4,
    damageType: 'untyped',
  },
  {
    ...base,
    type: 'healing',
    sourceId: 'dm',
    sourceName: 'DM',
    targetId: 'm-1',
    targetName: 'Goblin',
    amount: 4,
    actualHealing: 3,
  },
  {
    ...base,
    type: 'condition_applied',
    targetId: 'm-1',
    targetName: 'Goblin',
    conditionName: 'Prone',
  },
  {
    ...base,
    type: 'condition_removed',
    targetId: 'm-1',
    targetName: 'Goblin',
    conditionName: 'Prone',
  },
  { ...base, type: 'turn_start', entityId: 'm-1', entityName: 'Goblin' },
  { ...base, type: 'round_start', roundNumber: 2 },
  {
    ...base,
    type: 'combat_start',
    participantNames: ['Goblin', 'Aria'],
  },
  { ...base, type: 'combat_end', participantNames: [], endReason: 'dm_ended' },
];

describe('store-free combat log text formatter', () => {
  it.each(EVENTS.map(event => [event.type, event] as const))(
    'formats %s exactly like the legacy combat log export',
    (_type, event) => {
      useCombatLogStore.setState({
        encounters: {
          archive: {
            encounterId: 'enc',
            events: [event],
            startedAt: base.timestamp,
          },
        },
      });
      expect(formatCombatLogEvent(event)).toBe(
        useCombatLogStore.getState().exportArchive('archive', 'text')
      );
    }
  );

  it('produces the expected damage line', () => {
    expect(formatCombatLogEvent(EVENTS[0]!)).toBe(
      '[R2] DM dealt 4 untyped damage to Goblin'
    );
  });
});
