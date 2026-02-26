-- Create character_references table
-- Stores snapshots of player characters shared with campaigns

CREATE TABLE IF NOT EXISTS character_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL, -- localStorage character ID from the frontend
  character_snapshot JSONB NOT NULL, -- Full character data from frontend
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One character can only be in a campaign once
  UNIQUE(campaign_id, character_id)
);

-- Indexes
CREATE INDEX idx_character_refs_campaign ON character_references(campaign_id);
CREATE INDEX idx_character_refs_player ON character_references(player_id);
CREATE INDEX idx_character_refs_active ON character_references(is_active);
CREATE INDEX idx_character_refs_last_synced ON character_references(last_synced_at DESC);
