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

-- Indexes
CREATE INDEX idx_encounters_campaign ON encounters(campaign_id);
CREATE INDEX idx_encounters_status ON encounters(status);
CREATE INDEX idx_encounters_created_at ON encounters(created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON encounters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
