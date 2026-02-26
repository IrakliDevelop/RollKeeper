import { pool } from '../db/connection';
import {
  Campaign,
  CampaignWithDm,
  CampaignMember,
  CampaignMemberWithProfile,
  CampaignSettings,
} from '../types';

/**
 * Generate a short, human-friendly invite code (e.g. "DRAGON42")
 */
function generateInviteCode(): string {
  const words = [
    'DRAGON',
    'SWORD',
    'SHIELD',
    'SPELL',
    'ROGUE',
    'WIZARD',
    'KNIGHT',
    'QUEST',
    'DUNGEON',
    'GOBLIN',
    'TAVERN',
    'SCROLL',
    'POTION',
    'ARCANE',
    'EMBER',
    'STORM',
    'SHADOW',
    'FROST',
    'IRON',
    'FLAME',
    'RAVEN',
    'WOLF',
    'HAWK',
    'THORN',
    'CROWN',
    'BLADE',
    'STONE',
    'MYTH',
    'FANG',
    'VALE',
  ];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${word}${num}`;
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  dmId: string,
  name: string,
  description?: string,
  settings?: Partial<CampaignSettings>
): Promise<Campaign> {
  // Generate a unique invite code (retry on collision)
  let inviteCode = generateInviteCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await pool.query(
      'SELECT id FROM campaigns WHERE invite_code = $1',
      [inviteCode]
    );
    if (existing.rows.length === 0) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique invite code');
  }

  const defaultSettings: CampaignSettings = {
    ruleSet: '2024',
    allowPlayerInvites: false,
    publicViewEncounters: true,
    xpSharing: 'manual',
    ...settings,
  };

  const result = await pool.query(
    `INSERT INTO campaigns (name, description, dm_id, invite_code, settings)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      name,
      description || null,
      dmId,
      inviteCode,
      JSON.stringify(defaultSettings),
    ]
  );

  return result.rows[0];
}

/**
 * Get a campaign by ID
 */
export async function getCampaignById(
  campaignId: string
): Promise<CampaignWithDm | null> {
  const result = await pool.query(
    `SELECT c.*, up.display_name as dm_display_name, up.username as dm_username
     FROM campaigns c
     JOIN user_profiles up ON up.id = c.dm_id
     WHERE c.id = $1`,
    [campaignId]
  );
  return result.rows[0] || null;
}

/**
 * List campaigns for a user (as DM or as player member)
 */
export async function listCampaignsForUser(
  userId: string
): Promise<CampaignWithDm[]> {
  const result = await pool.query(
    `SELECT DISTINCT c.*, up.display_name as dm_display_name, up.username as dm_username
     FROM campaigns c
     JOIN user_profiles up ON up.id = c.dm_id
     LEFT JOIN campaign_members cm ON cm.campaign_id = c.id AND cm.user_id = $1 AND cm.status = 'active'
     WHERE c.dm_id = $1 OR cm.id IS NOT NULL
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Update a campaign
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<
    Pick<
      Campaign,
      'name' | 'description' | 'settings' | 'status' | 'current_day'
    >
  >
): Promise<Campaign | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.settings !== undefined) {
    fields.push(`settings = $${paramIndex++}`);
    values.push(JSON.stringify(updates.settings));
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.current_day !== undefined) {
    fields.push(`current_day = $${paramIndex++}`);
    values.push(updates.current_day);
  }

  if (fields.length === 0) return getCampaignById(campaignId);

  values.push(campaignId);
  const result = await pool.query(
    `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM campaigns WHERE id = $1', [
    campaignId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Find a campaign by invite code
 */
export async function getCampaignByInviteCode(
  inviteCode: string
): Promise<Campaign | null> {
  const result = await pool.query(
    "SELECT * FROM campaigns WHERE invite_code = $1 AND status = 'active'",
    [inviteCode.toUpperCase()]
  );
  return result.rows[0] || null;
}

/**
 * Join a campaign as a player
 */
export async function joinCampaign(
  campaignId: string,
  userId: string
): Promise<CampaignMember> {
  // Check if already a member
  const existing = await pool.query(
    'SELECT * FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
    [campaignId, userId]
  );

  if (existing.rows.length > 0) {
    const member = existing.rows[0];
    if (member.status === 'left') {
      // Re-join
      const updated = await pool.query(
        `UPDATE campaign_members SET status = 'active', joined_at = NOW()
         WHERE id = $1 RETURNING *`,
        [member.id]
      );
      return updated.rows[0];
    }
    return member; // Already active
  }

  const result = await pool.query(
    `INSERT INTO campaign_members (campaign_id, user_id, role, status)
     VALUES ($1, $2, 'player', 'active')
     RETURNING *`,
    [campaignId, userId]
  );
  return result.rows[0];
}

/**
 * Leave a campaign
 */
export async function leaveCampaign(
  campaignId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE campaign_members SET status = 'left'
     WHERE campaign_id = $1 AND user_id = $2 AND status = 'active'`,
    [campaignId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * List members of a campaign (with profile info)
 */
export async function listCampaignMembers(
  campaignId: string
): Promise<CampaignMemberWithProfile[]> {
  const result = await pool.query(
    `SELECT cm.*, up.username, up.display_name, up.email
     FROM campaign_members cm
     JOIN user_profiles up ON up.id = cm.user_id
     WHERE cm.campaign_id = $1 AND cm.status = 'active'
     ORDER BY cm.joined_at ASC`,
    [campaignId]
  );
  return result.rows;
}

/**
 * Remove a member from a campaign (DM action)
 */
export async function removeMember(
  campaignId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
    [campaignId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Regenerate invite code for a campaign
 */
export async function regenerateInviteCode(
  campaignId: string
): Promise<string> {
  let inviteCode = generateInviteCode();
  let attempts = 0;

  while (attempts < 10) {
    const existing = await pool.query(
      'SELECT id FROM campaigns WHERE invite_code = $1',
      [inviteCode]
    );
    if (existing.rows.length === 0) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  await pool.query('UPDATE campaigns SET invite_code = $1 WHERE id = $2', [
    inviteCode,
    campaignId,
  ]);

  return inviteCode;
}
