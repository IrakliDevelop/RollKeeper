import type { Redis } from '@upstash/redis';

import type { CampaignPlayerData } from '@/types/campaign';

const CAMPAIGN_PLAYER_CAS_SCRIPT = `
-- campaign-player-cas-v1
local function deep_equal(left, right)
  if type(left) ~= type(right) then return false end
  if type(left) ~= 'table' then return left == right end
  for key, value in pairs(left) do
    if not deep_equal(value, right[key]) then return false end
  end
  for key, _ in pairs(right) do
    if left[key] == nil then return false end
  end
  return true
end

if redis.call('EXISTS', KEYS[3]) == 1 then
  return { 'removed', '' }
end

local incoming_character = cjson.decode(ARGV[2])
local existing_raw = redis.call('GET', KEYS[1])
if existing_raw then
  local ok, existing = pcall(cjson.decode, existing_raw)
  if not ok or type(existing) ~= 'table' then
    return { 'corrupt', existing_raw }
  end
  if type(existing.characterData) ~= 'table' then
    return { 'corrupt', existing_raw }
  end
  local stored_revision = tonumber(existing.characterData.revision) or 0
  local incoming_revision = tonumber(ARGV[1]) or 0
  if incoming_revision < stored_revision then
    return { 'stale', existing_raw }
  end
  if incoming_revision == stored_revision then
    if deep_equal(incoming_character, existing.characterData) then
      return { 'identical', existing_raw }
    end
    return { 'conflict', existing_raw }
  end
end

redis.call('SET', KEYS[1], ARGV[3], 'EX', tonumber(ARGV[5]))
redis.call('SADD', KEYS[2], ARGV[4])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[5]))
return { 'written', ARGV[3] }
`;

type CasStatus = 'written' | 'identical' | 'stale' | 'conflict' | 'removed';

export interface CampaignPlayerCasResult {
  status: CasStatus;
  current?: CampaignPlayerData;
}

function parsePlayerData(value: unknown): CampaignPlayerData | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return JSON.parse(value) as CampaignPlayerData;
  return value as CampaignPlayerData;
}

export async function compareAndSetCampaignPlayer(
  redis: Redis,
  keys: { player: string; players: string; removed: string },
  playerData: CampaignPlayerData,
  ttlSeconds: number
): Promise<CampaignPlayerCasResult> {
  const reply = await redis.eval(
    CAMPAIGN_PLAYER_CAS_SCRIPT,
    [keys.player, keys.players, keys.removed],
    [
      String(playerData.characterData.revision ?? 0),
      JSON.stringify(playerData.characterData),
      JSON.stringify(playerData),
      playerData.playerId,
      String(ttlSeconds),
    ]
  );
  if (!Array.isArray(reply) || typeof reply[0] !== 'string') {
    throw new Error('compareAndSetCampaignPlayer: malformed Redis reply');
  }
  const status = reply[0];
  if (status === 'corrupt') {
    throw new Error('compareAndSetCampaignPlayer: corrupt stored player data');
  }
  if (
    status !== 'written' &&
    status !== 'identical' &&
    status !== 'stale' &&
    status !== 'conflict' &&
    status !== 'removed'
  ) {
    throw new Error(`compareAndSetCampaignPlayer: unknown status ${status}`);
  }
  return { status, current: parsePlayerData(reply[1]) };
}
