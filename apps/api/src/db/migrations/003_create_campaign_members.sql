-- Create campaign_members table

CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'co_dm')),
  status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'left')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure user can only be member of campaign once
  UNIQUE(campaign_id, user_id)
);

-- Indexes
CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX idx_campaign_members_status ON campaign_members(status);
