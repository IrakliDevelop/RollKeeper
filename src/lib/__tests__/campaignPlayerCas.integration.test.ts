import type { Redis } from '@upstash/redis';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { compareAndSetCampaignPlayer } from '@/lib/campaignPlayerCas';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';

const describeRedis =
  process.env.RUN_REDIS_INTEGRATION === '1' ? describe : describe.skip;

describeRedis('campaign player CAS — real Redis', () => {
  it('allows exactly one of two divergent equal-revision writers', async () => {
    const run = promisify(execFile);
    const redisCli = process.env.REDIS_CLI_PATH ?? 'redis-cli';
    const redisPort = process.env.REDIS_TEST_PORT ?? '6381';
    const command = async (args: string[]): Promise<unknown> => {
      const { stdout } = await run(
        redisCli,
        ['-h', '127.0.0.1', '-p', redisPort, '--json', ...args],
        { encoding: 'utf8' }
      );
      return JSON.parse(stdout.trim());
    };
    const redis = {
      eval: (script: string, keys: string[], args: (string | number)[]) =>
        command([
          'EVAL',
          script,
          String(keys.length),
          ...keys,
          ...args.map(String),
        ]),
    } as unknown as Redis;
    const suffix = crypto.randomUUID();
    const keys = {
      player: `slice1:test:${suffix}:player`,
      players: `slice1:test:${suffix}:players`,
      removed: `slice1:test:${suffix}:removed`,
    };
    const base: CampaignPlayerData = {
      playerId: 'player-1',
      playerName: 'Alice',
      characterId: 'char-1',
      characterName: 'Hero',
      characterData: makeCharacter({ id: 'char-1', revision: 1 }),
      lastSynced: '2026-08-15T00:00:00.000Z',
    };

    try {
      const results = await Promise.all([
        compareAndSetCampaignPlayer(redis, keys, base, 60),
        compareAndSetCampaignPlayer(
          redis,
          keys,
          {
            ...base,
            characterData: {
              ...base.characterData,
              hitPoints: { ...base.characterData.hitPoints, current: 1 },
            },
          },
          60
        ),
      ]);

      expect(results.map(result => result.status).sort()).toEqual([
        'conflict',
        'written',
      ]);
      const storedRaw = await command(['GET', keys.player]);
      const stored = JSON.parse(String(storedRaw)) as CampaignPlayerData;
      expect(stored?.characterData.revision).toBe(1);
    } finally {
      await command(['DEL', keys.player, keys.players, keys.removed]);
    }
  });
});
