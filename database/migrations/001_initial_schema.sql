-- RollKeeper Database Schema
-- This script sets up the initial database schema for the RollKeeper D&D app

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    is_dm BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    dm_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    invite_code VARCHAR(10) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Characters table
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    character_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    sync_status VARCHAR(20) DEFAULT 'synced',
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign members table (many-to-many relationship between users and campaigns)
CREATE TABLE campaign_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    role VARCHAR(20) DEFAULT 'player', -- 'player', 'co_dm'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(campaign_id, user_id)
);

-- Real-time sessions table (for managing active combat/session state)
CREATE TABLE realtime_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    session_type VARCHAR(20) NOT NULL, -- 'combat', 'general'
    session_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character updates log (for tracking real-time changes)
CREATE TABLE character_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    update_type VARCHAR(50) NOT NULL, -- 'hp_change', 'spell_slot_use', 'condition_add', etc.
    update_data JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_last_login ON users(last_login);

CREATE INDEX idx_campaigns_dm ON campaigns(dm_user_id);
CREATE INDEX idx_campaigns_active ON campaigns(is_active);
CREATE INDEX idx_campaigns_invite_code ON campaigns(invite_code);

CREATE INDEX idx_characters_owner ON characters(owner_user_id);
CREATE INDEX idx_characters_campaign ON characters(campaign_id);
CREATE INDEX idx_characters_sync ON characters(sync_status);
CREATE INDEX idx_characters_updated ON characters(updated_at);

CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX idx_campaign_members_active ON campaign_members(is_active);

CREATE INDEX idx_realtime_sessions_campaign ON realtime_sessions(campaign_id, is_active);
CREATE INDEX idx_realtime_sessions_type ON realtime_sessions(session_type);

CREATE INDEX idx_character_updates_character ON character_updates(character_id);
CREATE INDEX idx_character_updates_campaign ON character_updates(campaign_id);
CREATE INDEX idx_character_updates_time ON character_updates(created_at);
CREATE INDEX idx_character_updates_type ON character_updates(update_type);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_realtime_sessions_updated_at BEFORE UPDATE ON realtime_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Users table policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Campaigns table policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Users can see campaigns they're DM of or member of
CREATE POLICY "Users can view accessible campaigns" ON campaigns
    FOR SELECT USING (
        dm_user_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM campaign_members 
            WHERE campaign_id = campaigns.id 
            AND user_id = auth.uid()::uuid 
            AND is_active = true
        )
    );

-- Only DMs can create/update/delete campaigns
CREATE POLICY "DMs can manage their campaigns" ON campaigns
    FOR ALL USING (dm_user_id = auth.uid()::uuid);

-- Characters table policies
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Users can see their own characters and characters in campaigns they're part of
CREATE POLICY "Users can view accessible characters" ON characters
    FOR SELECT USING (
        owner_user_id = auth.uid()::uuid OR
        (campaign_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM campaign_members 
            WHERE campaign_id = characters.campaign_id 
            AND user_id = auth.uid()::uuid 
            AND is_active = true
        )) OR
        (campaign_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = characters.campaign_id 
            AND dm_user_id = auth.uid()::uuid
        ))
    );

-- Users can only modify their own characters
CREATE POLICY "Users can manage own characters" ON characters
    FOR ALL USING (owner_user_id = auth.uid()::uuid);

-- Campaign members table policies
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

-- Users can see memberships for campaigns they're part of
CREATE POLICY "Users can view campaign memberships" ON campaign_members
    FOR SELECT USING (
        user_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_id 
            AND dm_user_id = auth.uid()::uuid
        )
    );

-- Only DMs can manage campaign memberships
CREATE POLICY "DMs can manage campaign memberships" ON campaign_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_id 
            AND dm_user_id = auth.uid()::uuid
        )
    );

-- Real-time sessions table policies
ALTER TABLE realtime_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see sessions for campaigns they're part of
CREATE POLICY "Users can view campaign sessions" ON realtime_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaign_members 
            WHERE campaign_id = realtime_sessions.campaign_id 
            AND user_id = auth.uid()::uuid 
            AND is_active = true
        ) OR
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = realtime_sessions.campaign_id 
            AND dm_user_id = auth.uid()::uuid
        )
    );

-- Only DMs can manage sessions
CREATE POLICY "DMs can manage campaign sessions" ON realtime_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_id 
            AND dm_user_id = auth.uid()::uuid
        )
    );

-- Character updates table policies
ALTER TABLE character_updates ENABLE ROW LEVEL SECURITY;

-- Users can see updates for campaigns they're part of
CREATE POLICY "Users can view campaign character updates" ON character_updates
    FOR SELECT USING (
        created_by = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM campaign_members 
            WHERE campaign_id = character_updates.campaign_id 
            AND user_id = auth.uid()::uuid 
            AND is_active = true
        ) OR
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = character_updates.campaign_id 
            AND dm_user_id = auth.uid()::uuid
        )
    );

-- Users can create updates for characters they own or campaigns they're DM of
CREATE POLICY "Users can create character updates" ON character_updates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM characters 
            WHERE id = character_id 
            AND owner_user_id = auth.uid()::uuid
        ) OR
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_id 
            AND dm_user_id = auth.uid()::uuid
        )
    );

-- Function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically generate invite codes for campaigns
CREATE OR REPLACE FUNCTION set_campaign_invite_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invite_code IS NULL THEN
        NEW.invite_code := generate_invite_code();
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM campaigns WHERE invite_code = NEW.invite_code) LOOP
            NEW.invite_code := generate_invite_code();
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invite codes
CREATE TRIGGER set_campaign_invite_code_trigger
    BEFORE INSERT ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION set_campaign_invite_code();

-- Insert some sample data for testing (optional)
-- Note: In production, you would not include this section

-- Sample user (password is 'password123' hashed with bcrypt)
INSERT INTO users (email, username, password_hash, display_name, is_dm) VALUES
('dm@example.com', 'testdm', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', 'Test DM', true),
('player@example.com', 'testplayer', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', 'Test Player', false);

-- Sample campaign
INSERT INTO campaigns (name, description, dm_user_id) VALUES
('Test Campaign', 'A sample campaign for testing', (SELECT id FROM users WHERE username = 'testdm'));

-- Sample character
INSERT INTO characters (name, owner_user_id, character_data) VALUES
('Test Character', 
 (SELECT id FROM users WHERE username = 'testplayer'),
 '{"name": "Test Character", "race": "Human", "class": {"name": "Fighter"}, "level": 1, "hitPoints": {"current": 10, "max": 10, "temporary": 0}}'::jsonb
);

COMMIT;
