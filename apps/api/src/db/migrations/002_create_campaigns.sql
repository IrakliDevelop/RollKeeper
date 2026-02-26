-- Create campaigns table

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  dm_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL, -- Short code for players to join (e.g. "DRAGON42")
  settings JSONB DEFAULT '{"ruleSet": "2024", "allowPlayerInvites": false, "publicViewEncounters": true, "xpSharing": "manual"}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  current_day INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaigns_dm_id ON campaigns(dm_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_invite_code ON campaigns(invite_code);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
