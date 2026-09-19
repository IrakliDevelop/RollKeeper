import { describe, expect, it } from 'vitest';
import { validateNpcPayload } from './npcFamily';

describe('npcFamily — inflictableConditions ride inside monsterStatBlock', () => {
  it('accepts an NPC whose stat block carries inflictable conditions (no allowlist change needed)', () => {
    expect(
      validateNpcPayload({
        name: 'Giant Spider',
        armorClass: '14',
        maxHp: 26,
        speed: '30 ft.',
        monsterStatBlock: {
          traits: [],
          actions: [],
          reactions: [],
          bonusActions: [],
          lairActions: [],
          inflictableConditions: [
            {
              id: 'cc-web',
              name: 'Webbed',
              description: 'Restrained.',
              icon: 'link',
              kind: 'debuff',
            },
          ],
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).toMatchObject({ ok: true });
  });
});
