-- Create campaign_members table

CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'co_dm')),
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'left')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure user can only be member of campaign once
  UNIQUE(campaign_id, user_id)
);

-- Create indexes
CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX idx_campaign_members_status ON campaign_members(status);

-- Add RLS policies
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
CREATE POLICY "Users can view their own memberships"
  ON campaign_members FOR SELECT
  USING (auth.uid() = user_id);

-- DMs can view members of their campaigns
CREATE POLICY "DMs can view their campaign members"
  ON campaign_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_members.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- DMs can add members to their campaigns
CREATE POLICY "DMs can add members to their campaigns"
  ON campaign_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_members.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- DMs can update members in their campaigns
CREATE POLICY "DMs can update their campaign members"
  ON campaign_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_members.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- DMs can remove members from their campaigns
CREATE POLICY "DMs can remove their campaign members"
  ON campaign_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_members.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- Users can update their own membership status (e.g., accept invite, leave)
CREATE POLICY "Users can update their own membership"
  ON campaign_members FOR UPDATE
  USING (auth.uid() = user_id);

-- Add policy for campaign members to view campaigns
CREATE POLICY "Campaign members can view their campaigns"
  ON campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = campaigns.id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.status = 'active'
    )
  );
