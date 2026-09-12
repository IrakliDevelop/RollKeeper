import { describe, expect, it } from 'vitest';
import { buildNpcEntity, buildPlayerEntity } from './buildEntity';
import type { CampaignNPC } from '@/types/encounter';

describe('encounter entity avatars', () => {
  it('carries a campaign player portrait into the encounter', () => {
    const entity = buildPlayerEntity({
      id: 'player-1',
      name: 'Aria',
      class: 'Rogue',
      level: 5,
      armorClass: 15,
      currentHp: 30,
      maxHp: 30,
      dexterity: 18,
      avatarUrl: 'https://example.com/aria.png',
    });

    expect(entity.avatarUrl).toBe('https://example.com/aria.png');
  });

  it('carries an NPC dashboard portrait into the encounter', () => {
    const npc: CampaignNPC = {
      id: 'npc-1',
      campaignCode: 'TEST',
      name: 'Captain Vale',
      armorClass: '16',
      maxHp: 45,
      speed: '30 ft.',
      avatarUrl: 'https://example.com/vale.png',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const entity = buildNpcEntity(npc, {
      isHidden: false,
      playerDisposition: 'neutral',
      campaignCode: 'TEST',
    });

    expect(entity.avatarUrl).toBe('https://example.com/vale.png');
  });

  it('labels a saved custom monster as a monster while retaining its NPC source link', () => {
    const monster: CampaignNPC = {
      id: 'npc-monster-1',
      campaignCode: 'TEST',
      name: 'Ash Drake',
      kind: 'monster',
      armorClass: '15',
      maxHp: 52,
      speed: '30 ft., fly 60 ft.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const entity = buildNpcEntity(monster, {
      isHidden: false,
      playerDisposition: 'enemy',
      campaignCode: 'TEST',
    });

    expect(entity.type).toBe('monster');
    expect(entity.npcSourceId).toBe('npc-monster-1');
  });
});
