-- Create encounter_participants table

CREATE TABLE IF NOT EXISTS encounter_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('player_character', 'npc', 'monster')),

  -- Reference to character (if player_character)
  character_ref_id UUID REFERENCES character_references(id) ON DELETE SET NULL,

  -- Participant identity
  name TEXT NOT NULL,

  -- Combat stats (JSONB for flexibility)
  stats JSONB NOT NULL DEFAULT '{"hp": {"current": 0, "max": 0, "temp": 0}, "ac": 10, "conditions": []}'::jsonb,

  -- Initiative
  initiative INTEGER DEFAULT 0,
  initiative_bonus INTEGER DEFAULT 0,
  position INTEGER NOT NULL, -- Order in initiative

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_hidden BOOLEAN DEFAULT false, -- DM can hide enemies from players

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_encounter_participants_encounter ON encounter_participants(encounter_id);
CREATE INDEX idx_encounter_participants_position ON encounter_participants(encounter_id, position);
CREATE INDEX idx_encounter_participants_type ON encounter_participants(type);
CREATE INDEX idx_encounter_participants_char_ref ON encounter_participants(character_ref_id);

-- Add updated_at trigger
CREATE TRIGGER update_encounter_participants_updated_at
  BEFORE UPDATE ON encounter_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE encounter_participants ENABLE ROW LEVEL SECURITY;

-- DMs can manage participants in their campaign encounters
CREATE POLICY "DMs can view participants in their encounters"
  ON encounter_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM encounters
      JOIN campaigns ON campaigns.id = encounters.campaign_id
      WHERE encounters.id = encounter_participants.encounter_id
      AND campaigns.dm_id = auth.uid()
    )
  );

CREATE POLICY "DMs can add participants to their encounters"
  ON encounter_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM encounters
      JOIN campaigns ON campaigns.id = encounters.campaign_id
      WHERE encounters.id = encounter_participants.encounter_id
      AND campaigns.dm_id = auth.uid()
    )
  );

CREATE POLICY "DMs can update participants in their encounters"
  ON encounter_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM encounters
      JOIN campaigns ON campaigns.id = encounters.campaign_id
      WHERE encounters.id = encounter_participants.encounter_id
      AND campaigns.dm_id = auth.uid()
    )
  );

CREATE POLICY "DMs can remove participants from their encounters"
  ON encounter_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM encounters
      JOIN campaigns ON campaigns.id = encounters.campaign_id
      WHERE encounters.id = encounter_participants.encounter_id
      AND campaigns.dm_id = auth.uid()
    )
  );

-- Campaign members can view participants (excluding hidden ones)
CREATE POLICY "Campaign members can view visible participants"
  ON encounter_participants FOR SELECT
  USING (
    is_hidden = false
    AND EXISTS (
      SELECT 1 FROM encounters
      JOIN campaign_members ON campaign_members.campaign_id = encounters.campaign_id
      WHERE encounters.id = encounter_participants.encounter_id
      AND campaign_members.user_id = auth.uid()
      AND campaign_members.status = 'active'
    )
  );
