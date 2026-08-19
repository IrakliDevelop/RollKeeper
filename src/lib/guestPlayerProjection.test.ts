import { describe, expect, it } from 'vitest';

import { projectGuestPlayer } from './guestPlayerProjection';

describe('guest player projection', () => {
  it('builds an explicit player-safe DTO without serializing the private source', () => {
    const privateDocument = {
      playerId: 'player-a',
      playerName: 'Synthetic Player',
      characterId: 'player-a',
      characterName: 'Mira Vale',
      lastSynced: '2026-08-19T00:00:00.000Z',
      characterData: {
        id: 'player-a',
        name: 'Mira Vale',
        playerName: 'Synthetic Player',
        avatar: 'https://assets.example.test/avatar.png',
        revision: 7,
        level: 4,
        class: { name: 'Wizard' },
        hitPoints: { current: 13, max: 20, temporary: 2 },
        armorClass: 15,
        notes: 'DM-private note must not escape',
        backstory: 'private backstory',
        inventory: [{ name: 'Secret artifact' }],
      },
      serverOnly: { dmNotes: 'never serialize me' },
    };

    const projected = projectGuestPlayer(privateDocument);

    expect(projected).toEqual({
      playerId: 'player-a',
      playerName: 'Synthetic Player',
      characterId: 'player-a',
      characterName: 'Mira Vale',
      lastSynced: '2026-08-19T00:00:00.000Z',
      character: {
        id: 'player-a',
        name: 'Mira Vale',
        playerName: 'Synthetic Player',
        avatar: 'https://assets.example.test/avatar.png',
        revision: 7,
        level: 4,
        className: 'Wizard',
        armorClass: 15,
        hitPoints: { current: 13, max: 20, temporary: 2 },
      },
    });
    expect(JSON.stringify(projected)).not.toMatch(
      /notes|backstory|inventory|serverOnly|dmNotes|Secret artifact/u
    );
  });

  it('uses bounded safe defaults for malformed optional fields', () => {
    expect(
      projectGuestPlayer({
        playerId: 'player-a',
        playerName: 'Player',
        characterId: 'player-a',
        characterName: 'Character',
        lastSynced: 'now',
        characterData: { id: 'player-a', name: 'Character' },
      })
    ).toMatchObject({
      character: {
        revision: 0,
        level: 1,
        className: 'Unknown',
        armorClass: 10,
        hitPoints: null,
      },
    });
  });

  it('projects multiclass totals without exposing class documents', () => {
    const projected = projectGuestPlayer({
      playerId: 'player-a',
      playerName: 'Player',
      characterId: 'character-a',
      characterName: 'Character',
      lastSynced: 'now',
      characterData: {
        classes: [
          { className: 'Wizard', level: 3, privateNotes: 'hidden' },
          { className: 'Rogue', level: 2 },
        ],
        hitPoints: { current: 'malformed', max: 9 },
      },
    });
    expect(projected.character).toMatchObject({
      level: 5,
      className: 'Wizard',
      hitPoints: { current: 0, max: 9, temporary: 0 },
    });
    expect(JSON.stringify(projected)).not.toContain('privateNotes');
  });
});
