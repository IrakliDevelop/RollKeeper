import { describe, expect, it } from 'vitest';
import { buildDmEffects } from '@/hooks/useDmEffectsSync';
import { createMockEncounterEntity } from '@/test/helpers';

const NOW = '2026-09-19T10:00:00.000Z';

describe('buildDmEffects', () => {
  it('adds DM-source conditions with description and a validated icon', () => {
    const effects = buildDmEffects(
      createMockEncounterEntity({
        type: 'player',
        conditions: [
          {
            id: 'c1',
            name: 'Cursed Blood',
            description: 'Lose 1d4 HP at the start of each turn.',
            icon: 'droplet',
            kind: 'debuff',
            source: 'dm',
          },
          { id: 'c2', name: 'Prone', source: 'dm' },
          { id: 'c3', name: 'Poisoned', source: 'player-sync' },
        ],
      }),
      NOW
    );
    expect(effects).toEqual([
      {
        id: 'c1',
        name: 'Cursed Blood',
        action: 'add',
        description: 'Lose 1d4 HP at the start of each turn.',
        icon: 'droplet',
        kind: 'debuff',
        appliedAt: NOW,
      },
      { id: 'c2', name: 'Prone', action: 'add', appliedAt: NOW },
    ]);
    expect('icon' in effects[1]).toBe(false);
  });

  it('never forwards an icon outside the registry', () => {
    const [effect] = buildDmEffects(
      createMockEncounterEntity({
        type: 'player',
        conditions: [
          {
            id: 'c1',
            name: 'Hexed',
            icon: 'not-an-icon' as never,
            source: 'dm',
          },
        ],
      }),
      NOW
    );
    expect('icon' in effect).toBe(false);
  });

  it('still emits removals for suppressed conditions', () => {
    expect(
      buildDmEffects(
        createMockEncounterEntity({
          type: 'player',
          suppressedConditions: ['Mage Armor'],
        }),
        NOW
      )
    ).toEqual([
      {
        id: 'remove-mage-armor',
        name: 'Mage Armor',
        action: 'remove',
        appliedAt: NOW,
      },
    ]);
  });
});
