import { describe, it, expect, beforeEach } from 'vitest';
import { useEncounterStore } from '@/store/encounterStore';
import { applyPlayersToEncounter } from '@/utils/encounterSync';
import { createMockCharacterState } from '@/test/helpers';
import type { CampaignPlayerData } from '@/types/campaign';

describe('applyPlayersToEncounter', () => {
  let encounterId: string;

  beforeEach(() => {
    useEncounterStore.setState({ encounters: [] });
    encounterId = useEncounterStore
      .getState()
      .createEncounter('Test Encounter');
    useEncounterStore.getState().addEntity(encounterId, {
      type: 'player',
      name: 'Thorn',
      initiative: null,
      initiativeModifier: 0,
      currentHp: 44,
      maxHp: 44,
      tempHp: 0,
      armorClass: 16,
      conditions: [],
      isHidden: false,
      playerCharacterId: 'char-1',
    });
  });

  it('updates a player entity HP from the snapshot', () => {
    const player: CampaignPlayerData = {
      playerId: 'char-1',
      playerName: 'Alice',
      characterId: 'char-1',
      characterName: 'Thorn',
      characterData: {
        ...createMockCharacterState({ id: 'char-1' }),
        hitPoints: {
          current: 30,
          max: 44,
          temporary: 0,
          calculationMode: 'auto',
        },
      },
      lastSynced: new Date().toISOString(),
    };
    applyPlayersToEncounter(encounterId, [player]);

    const entity = useEncounterStore
      .getState()
      .encounters.find(e => e.id === encounterId)!
      .entities.find(e => e.playerCharacterId === 'char-1')!;
    expect(entity.currentHp).toBe(30);
  });

  it('is a no-op for unknown encounter ids and empty player lists', () => {
    expect(() => applyPlayersToEncounter('nope', [])).not.toThrow();
  });
});
