import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignPlayersKey,
  campaignPlayerKey,
  refreshCampaignTTL,
  campaignKey,
} from '@/lib/redis';
import { CampaignPlayerData } from '@/types/campaign';
import { DeathSavingThrows } from '@/types/character';

export interface PartyMemberHP {
  characterId: string;
  characterName: string;
  playerName: string;
  avatar?: string;
  className: string;
  level: number;
  armorClass: number;
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
    deathSaves?: DeathSavingThrows;
  } | null;
  lastSynced: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();

    // Check campaign exists
    const campaignRaw = await redis.get<string>(campaignKey(code));
    if (!campaignRaw) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const playerIds = await redis.smembers(campaignPlayersKey(code));
    const realPlayerIds = playerIds.filter(id => id !== '__init__');

    const members: PartyMemberHP[] = [];

    if (realPlayerIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const pid of realPlayerIds) {
        pipeline.get(campaignPlayerKey(code, pid));
      }
      const results = await pipeline.exec();

      for (const raw of results) {
        if (raw) {
          const parsed: CampaignPlayerData =
            typeof raw === 'string' ? JSON.parse(raw) : raw;
          const char = parsed.characterData;

          // Respect opt-out: if shareHpWithParty is explicitly false, hide HP
          const hpHidden = char.shareHpWithParty === false;

          const primaryClass = char.classes?.[0];

          let ac = char.armorClass ?? 10;
          if (char.isTempACActive && char.tempArmorClass) {
            ac = char.tempArmorClass;
          }
          if (char.isWearingShield) {
            ac += char.shieldBonus ?? 2;
          }

          members.push({
            characterId: parsed.characterId,
            characterName: parsed.characterName,
            playerName: parsed.playerName,
            avatar: char.avatar,
            className: primaryClass?.className || char.class?.name || 'Unknown',
            level:
              char.classes?.reduce((sum, c) => sum + c.level, 0) ||
              char.level ||
              1,
            armorClass: ac,
            hitPoints: hpHidden
              ? null
              : {
                  current: char.hitPoints?.current ?? 0,
                  max: char.hitPoints?.max ?? 0,
                  temporary: char.hitPoints?.temporary ?? 0,
                  deathSaves: char.hitPoints?.deathSaves,
                },
            lastSynced: parsed.lastSynced,
          });
        }
      }

      members.sort((a, b) => a.characterName.localeCompare(b.characterName));
    }

    await refreshCampaignTTL(redis, code);

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching party HP:', error);
    return NextResponse.json(
      { error: 'Failed to fetch party HP data' },
      { status: 500 }
    );
  }
}
