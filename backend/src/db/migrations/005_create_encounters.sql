-- Create encounters table

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  round_number INTEGER DEFAULT 0,
  current_turn_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_encounters_campaign ON encounters(campaign_id);
CREATE INDEX idx_encounters_status ON encounters(status);
CREATE INDEX idx_encounters_created_at ON encounters(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON encounters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;

-- DMs can manage encounters in their campaigns
CREATE POLICY "DMs can view their campaign encounters"
  ON encounters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = encounters.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

CREATE POLICY "DMs can create encounters in their campaigns"
  ON encounters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = encounters.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

CREATE POLICY "DMs can update their campaign encounters"
  ON encounters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = encounters.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

CREATE POLICY "DMs can delete their campaign encounters"
  ON encounters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = encounters.campaign_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- Campaign members can view encounters (read-only)
CREATE POLICY "Campaign members can view encounters"
  ON encounters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.campaign_id = encounters.campaign_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.status = 'active'
    )
  );
