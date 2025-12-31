-- Create campaigns table

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  dm_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{"ruleSet": "2024", "allowPlayerInvites": false, "publicViewEncounters": true, "xpSharing": "manual"}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  current_day INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_campaigns_dm_id ON campaigns(dm_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- DMs can view their own campaigns
CREATE POLICY "DMs can view their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = dm_id);

-- DMs can create campaigns
CREATE POLICY "DMs can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = dm_id);

-- DMs can update their own campaigns
CREATE POLICY "DMs can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = dm_id);

-- DMs can delete their own campaigns
CREATE POLICY "DMs can delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = dm_id);

-- Campaign members can view campaigns they're part of
-- (This will be refined after campaign_members table is created)
