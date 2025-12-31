-- Create character_references table
-- Stores snapshots of player characters shared with campaigns

CREATE TABLE IF NOT EXISTS character_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL, -- localStorage character ID
  character_snapshot JSONB NOT NULL, -- Full character data from frontend
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One character can only be in a campaign once
  UNIQUE(campaign_id, character_id)
);

-- Create indexes
CREATE INDEX idx_character_refs_campaign ON character_references(campaign_id);
CREATE INDEX idx_character_refs_player ON character_references(player_id);
CREATE INDEX idx_character_refs_active ON character_references(is_active);
CREATE INDEX idx_character_refs_last_synced ON character_references(last_synced_at DESC);

-- Add RLS policies
ALTER TABLE character_references ENABLE ROW LEVEL SECURITY;

-- Players can view their own character references
CREATE POLICY "Players can view their own characters"
  ON character_references FOR SELECT
  USING (auth.uid() = player_id);

-- DMs can view characters in their campaigns
CREATE POLICY "DMs can view characters in their campaigns"
  ON character_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = character_references.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- Campaign members can view characters in their campaigns
CREATE POLICY "Campaign members can view campaign characters"
  ON character_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = character_references.campaign_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.status = 'active'
    )
  );

-- Players can insert their own characters
CREATE POLICY "Players can add their own characters"
  ON character_references FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Players can update their own character snapshots
CREATE POLICY "Players can update their own characters"
  ON character_references FOR UPDATE
  USING (auth.uid() = player_id);

-- Players can delete their own character references
CREATE POLICY "Players can remove their own characters"
  ON character_references FOR DELETE
  USING (auth.uid() = player_id);

-- DMs can delete character references from their campaigns
CREATE POLICY "DMs can remove characters from their campaigns"
  ON character_references FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = character_references.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );
