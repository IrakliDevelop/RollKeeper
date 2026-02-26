import { pool } from '../db/connection';
import { CharacterReference, CharacterSummary } from '../types';

/**
 * Extract a summary from a character snapshot for quick display
 */
function extractSummary(
  ref: CharacterReference,
  playerName?: string
): CharacterSummary {
  const snap = ref.character_snapshot;
  const hitPoints = snap.hitPoints as Record<string, unknown> | undefined;
  const classInfo = snap.class as Record<string, unknown> | undefined;

  return {
    character_id: ref.character_id,
    name: (snap.name as string) || 'Unknown',
    race: (snap.race as string) || 'Unknown',
    class: (classInfo?.name as string) || (snap.class as string) || 'Unknown',
    level: (snap.totalLevel as number) || (snap.level as number) || 1,
    hp_current: (hitPoints?.current as number) ?? 0,
    hp_max: (hitPoints?.max as number) ?? 0,
    ac: (snap.armorClass as number) ?? 10,
    player_name: playerName,
    last_synced_at: ref.last_synced_at,
  };
}

/**
 * Sync (upsert) a character snapshot to a campaign
 */
export async function syncCharacter(
  campaignId: string,
  playerId: string,
  characterId: string,
  characterSnapshot: Record<string, unknown>
): Promise<CharacterReference> {
  const result = await pool.query(
    `INSERT INTO character_references (campaign_id, player_id, character_id, character_snapshot, last_synced_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (campaign_id, character_id)
     DO UPDATE SET
       character_snapshot = EXCLUDED.character_snapshot,
       last_synced_at = NOW(),
       is_active = true
     RETURNING *`,
    [campaignId, playerId, characterId, JSON.stringify(characterSnapshot)]
  );
  return result.rows[0];
}

/**
 * Get all character summaries for a campaign (for DM dashboard)
 */
export async function getCampaignCharacterSummaries(
  campaignId: string
): Promise<CharacterSummary[]> {
  const result = await pool.query(
    `SELECT cr.*, up.display_name as player_name
     FROM character_references cr
     JOIN user_profiles up ON up.id = cr.player_id
     WHERE cr.campaign_id = $1 AND cr.is_active = true
     ORDER BY cr.last_synced_at DESC`,
    [campaignId]
  );

  return result.rows.map((row: CharacterReference & { player_name?: string }) =>
    extractSummary(row, row.player_name)
  );
}

/**
 * Get full character snapshot for a specific character in a campaign
 */
export async function getCharacterSnapshot(
  campaignId: string,
  characterId: string
): Promise<(CharacterReference & { player_name?: string }) | null> {
  const result = await pool.query(
    `SELECT cr.*, up.display_name as player_name
     FROM character_references cr
     JOIN user_profiles up ON up.id = cr.player_id
     WHERE cr.campaign_id = $1 AND cr.character_id = $2 AND cr.is_active = true`,
    [campaignId, characterId]
  );
  return result.rows[0] || null;
}

/**
 * Get all characters a player has synced to a campaign
 */
export async function getPlayerCharactersInCampaign(
  campaignId: string,
  playerId: string
): Promise<CharacterReference[]> {
  const result = await pool.query(
    `SELECT * FROM character_references
     WHERE campaign_id = $1 AND player_id = $2 AND is_active = true
     ORDER BY last_synced_at DESC`,
    [campaignId, playerId]
  );
  return result.rows;
}

/**
 * Remove a character from a campaign
 */
export async function removeCharacterFromCampaign(
  campaignId: string,
  characterId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE character_references SET is_active = false
     WHERE campaign_id = $1 AND character_id = $2`,
    [campaignId, characterId]
  );
  return (result.rowCount ?? 0) > 0;
}
