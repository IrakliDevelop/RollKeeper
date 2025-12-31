# DM Features - Technical Specification

**Version:** 1.0
**Last Updated:** 2025-12-31
**Status:** Planning

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Architecture](#architecture)
4. [Technical Stack](#technical-stack)
5. [Data Model](#data-model)
6. [Authentication & Authorization](#authentication--authorization)
7. [Data Flow & Synchronization](#data-flow--synchronization)
8. [Real-time Combat Tracker](#real-time-combat-tracker)
9. [API Design](#api-design)
10. [Frontend Integration](#frontend-integration)
11. [Implementation Phases](#implementation-phases)
12. [Open Questions](#open-questions)

---

## Overview

### Goals

RollKeeper currently provides comprehensive offline character management for D&D 5e players. The DM features will extend this to support:

1. **Campaign Management**: DMs can create campaigns and invite players
2. **Character Access**: DMs can view and manage player character states
3. **Item Management**: DMs can give/remove items, adjust resources
4. **Combat Tracker**: Real-time initiative and HP tracking for encounters
5. **Session Management**: Track campaign progress and history

### Design Principles

- **Offline-First for Characters**: Player character data remains in localStorage
- **Online for Collaboration**: Campaign and combat data requires backend connectivity
- **Minimal Disruption**: Players can continue using character sheets offline
- **Privacy**: Character data only shared when player explicitly joins campaign
- **Real-time Where It Matters**: Combat encounters sync instantly, other features can be async

---

## Core Features

### 1. Campaign Management

**DM Capabilities:**
- Create campaigns with name, description, settings
- Invite players via shareable link or email
- Manage campaign members (add/remove players)
- Archive/delete campaigns
- Track campaign timeline (days, sessions)

**Player Capabilities:**
- Accept campaign invitations
- View campaign information
- Share character(s) with campaign
- Leave campaign

### 2. Character Management (DM View)

**DM Can:**
- View character sheets of players in their campaign
- See real-time character stats (HP, resources, inventory)
- Give items/equipment to characters
- Adjust resources (gold, consumables, spell slots)
- Add/remove conditions
- Award XP or adjust level
- View character history/notes

**DM Cannot:**
- Directly edit character builds (race, class, abilities)
- Access character data from players not in their campaign
- See private notes unless shared by player

### 3. Combat/Initiative Tracker

**Features:**
- Add participants (player characters, NPCs, monsters)
- Roll initiative (auto-sort by result)
- Track HP (current, max, temp HP, damage taken)
- Track conditions (exhaustion, stunned, etc.)
- Round counter
- Turn indicator
- Quick actions (heal, damage, apply condition)
- Real-time sync between DM and all players viewing the encounter

**UI/UX:**
- Canvas-based or list-based view (TBD)
- Drag-and-drop initiative reordering
- Quick reference to character stats
- Monster stat blocks from bestiary
- Initiative history log

### 4. Session Management (Future)

- Session notes
- Combat log
- Loot distribution
- Session summary

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│         Next.js Frontend                │
│      (Player & DM Interface)            │
│                                         │
│  - Character Store (localStorage)       │
│  - Campaign UI                          │
│  - Combat Tracker UI                    │
│  - Socket.io Client                     │
└──────────────┬──────────────────────────┘
               │
               │ HTTP REST API
               │ WebSocket (Socket.io)
               │
┌──────────────▼──────────────────────────┐
│       Custom Backend Server             │
│      (Node.js + Express)                │
│                                         │
│  - REST API (campaigns, encounters)     │
│  - Socket.io Server (real-time)         │
│  - Auth Middleware (Supabase JWT)       │
│  - Business Logic                       │
└──────────────┬──────────────────────────┘
               │
               │ PostgreSQL Connection
               │
┌──────────────▼──────────────────────────┐
│        Supabase PostgreSQL              │
│         (Database Only)                 │
│                                         │
│  - Users (via Supabase Auth)            │
│  - Campaigns                            │
│  - Campaign Members                     │
│  - Character References                 │
│  - Encounters                           │
│  - Encounter Participants               │
└─────────────────────────────────────────┘
```

### Why This Architecture?

1. **Supabase PostgreSQL**: Managed database with backups, scaling, and dashboard UI
2. **Custom Backend**: Full control over business logic, Socket.io integration, complex queries
3. **Next.js Frontend**: Existing app continues to work, minimal changes
4. **Separation of Concerns**: Frontend doesn't talk directly to database
5. **Scalability**: Backend can be scaled independently of frontend

---

## Technical Stack

### Backend

```json
{
  "runtime": "Node.js 20+",
  "framework": "Express.js",
  "database": "PostgreSQL (via Supabase)",
  "realtime": "Socket.io",
  "auth": "Supabase Auth (JWT validation)",
  "orm": "pg (node-postgres) - raw SQL",
  "validation": "Zod",
  "typescript": "TypeScript 5+"
}
```

**Key Dependencies:**
- `express` - Web framework
- `socket.io` - Real-time bidirectional communication
- `pg` - PostgreSQL client
- `@supabase/supabase-js` - Auth validation only
- `zod` - Request/response validation
- `jsonwebtoken` - JWT verification
- `cors` - CORS handling
- `dotenv` - Environment variables

### Frontend Changes

**New Dependencies:**
- `socket.io-client` - Real-time client
- `@supabase/supabase-js` - Auth only (already have it)

**New Stores:**
- `campaignStore.ts` - Campaign state management
- `encounterStore.ts` - Combat tracker state
- `dmStore.ts` - DM-specific UI state

**New Pages:**
- `/dm` - DM dashboard
- `/dm/campaigns` - Campaign list
- `/dm/campaigns/[id]` - Campaign detail
- `/dm/campaigns/[id]/combat` - Combat tracker
- `/player/campaigns` - Player's campaigns view

---

## Data Model

### Database Schema

#### **users** (Supabase Auth table)
```sql
-- Managed by Supabase Auth
id              uuid PRIMARY KEY
email           text UNIQUE NOT NULL
encrypted_password text
created_at      timestamp
-- ... other Supabase Auth fields
```

#### **user_profiles**
```sql
CREATE TABLE user_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        text UNIQUE NOT NULL,
  display_name    text,
  role            text DEFAULT 'player' CHECK (role IN ('player', 'dm', 'both')),
  avatar_url      text,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);
```

#### **campaigns**
```sql
CREATE TABLE campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  dm_id           uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  settings        jsonb DEFAULT '{}'::jsonb,
  status          text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  current_day     integer DEFAULT 0,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

CREATE INDEX idx_campaigns_dm_id ON campaigns(dm_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

**Settings JSONB Structure:**
```typescript
{
  ruleSet: '2014' | '2024',
  allowPlayerInvites: boolean,
  publicViewEncounters: boolean,
  xpSharing: 'manual' | 'auto-split',
  // ... extensible
}
```

#### **campaign_members**
```sql
CREATE TABLE campaign_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role            text DEFAULT 'player' CHECK (role IN ('player', 'co_dm')),
  status          text DEFAULT 'active' CHECK (status IN ('invited', 'active', 'left')),
  joined_at       timestamp DEFAULT now(),

  UNIQUE(campaign_id, user_id)
);

CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
```

#### **character_references**
```sql
CREATE TABLE character_references (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  character_id      text NOT NULL, -- localStorage character ID
  character_snapshot jsonb NOT NULL, -- Full character data snapshot
  is_active         boolean DEFAULT true,
  last_synced_at    timestamp DEFAULT now(),
  created_at        timestamp DEFAULT now(),

  UNIQUE(campaign_id, character_id)
);

CREATE INDEX idx_character_refs_campaign ON character_references(campaign_id);
CREATE INDEX idx_character_refs_player ON character_references(player_id);
```

**character_snapshot JSONB Structure:**
```typescript
// Full CharacterState from characterStore
// This is a snapshot - not the source of truth
// Player can re-sync anytime to update
```

#### **encounters**
```sql
CREATE TABLE encounters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  status          text DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  round_number    integer DEFAULT 0,
  current_turn_index integer DEFAULT 0,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

CREATE INDEX idx_encounters_campaign ON encounters(campaign_id);
CREATE INDEX idx_encounters_status ON encounters(status);
```

#### **encounter_participants**
```sql
CREATE TABLE encounter_participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      uuid NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('player_character', 'npc', 'monster')),

  -- Reference to character (if player_character)
  character_ref_id  uuid REFERENCES character_references(id) ON DELETE SET NULL,

  -- Participant identity
  name              text NOT NULL,

  -- Combat stats
  stats             jsonb NOT NULL,

  -- Initiative
  initiative        integer DEFAULT 0,
  initiative_bonus  integer DEFAULT 0,
  position          integer NOT NULL, -- Order in initiative

  -- Status
  is_active         boolean DEFAULT true,
  is_hidden         boolean DEFAULT false, -- DM can hide enemies

  created_at        timestamp DEFAULT now(),
  updated_at        timestamp DEFAULT now()
);

CREATE INDEX idx_encounter_participants_encounter ON encounter_participants(encounter_id);
CREATE INDEX idx_encounter_participants_position ON encounter_participants(encounter_id, position);
```

**stats JSONB Structure:**
```typescript
{
  // Core stats
  hp: {
    current: number,
    max: number,
    temp: number
  },
  ac: number,

  // Conditions
  conditions: string[], // ['poisoned', 'stunned']

  // For monsters (from bestiary)
  monster_id?: string,
  cr?: number,

  // Extended stats (optional)
  abilities?: {
    str: number,
    dex: number,
    con: number,
    int: number,
    wis: number,
    cha: number
  },

  // Notes
  notes?: string
}
```

---

## Authentication & Authorization

### Authentication Flow

1. **User Registration/Login** (Supabase Auth)
   ```typescript
   // Frontend
   const { data, error } = await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'password'
   });
   ```

2. **Create User Profile** (Backend trigger or frontend call)
   ```typescript
   // After signup, create profile
   POST /api/users/profile
   { username: 'playerOne', display_name: 'Player One' }
   ```

3. **Get Session Token**
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   const token = session.access_token;
   ```

4. **Backend Validates Token**
   ```typescript
   // Backend middleware
   const { data: { user } } = await supabase.auth.getUser(token);
   req.user = user;
   ```

### Authorization Rules

#### Campaign Access
- **DM**: Full access to their campaigns
- **Player**: Read access to campaigns they're a member of
- **Public**: No access (campaign invites only)

#### Character Data
- **Player**: Full control over their own characters
- **DM**: Read-only access to characters in their campaigns
- **Other Players**: No access (unless future sharing feature)

#### Encounter Management
- **DM**: Full CRUD on encounters in their campaigns
- **Players**: Read-only view of active encounters
- **Public**: No access

---

## Data Flow & Synchronization

### Character Data Sync Strategy

#### Problem
- Player characters live in `localStorage` (offline-first)
- DM needs to see character data to run the game
- How do we sync without losing offline capability?

#### Solution: Snapshot System

```
┌─────────────────────────────────────────────────────┐
│                Player's Browser                     │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │     localStorage                     │           │
│  │  characterStore (Source of Truth)    │           │
│  │  - HP: 45/60                         │           │
│  │  - Inventory: [sword, potion]        │           │
│  └──────────────┬───────────────────────┘           │
│                 │                                   │
│                 │ Player clicks "Sync to Campaign"  │
│                 │                                   │
│  ┌──────────────▼───────────────────────┐           │
│  │  POST /api/campaigns/{id}/sync       │           │
│  │  { character_id, character_snapshot }│           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                  │
                  │ HTTP Request
                  ▼
┌─────────────────────────────────────────────────────┐
│                  Backend                            │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │  character_references table          │           │
│  │  character_snapshot = { ...data }    │           │
│  │  last_synced_at = now()              │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                  │
                  │ DM views campaign
                  ▼
┌─────────────────────────────────────────────────────┐
│                DM's Browser                         │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │  GET /api/campaigns/{id}/characters  │           │
│  │  Returns: character snapshots        │           │
│  │  - HP: 45/60 (read-only for DM)      │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

#### Sync Triggers

**Player-initiated:**
- Player joins campaign (initial sync)
- Player manually clicks "Sync Now" button
- Player takes long rest (auto-sync option)
- Player levels up (auto-sync option)

**DM-initiated:**
- DM requests fresh snapshot from player
- DM gives item (triggers sync request to player)

#### Conflict Resolution

**Scenario**: DM gives item while player is offline

```typescript
// Backend stores "pending changes"
{
  character_ref_id: 'abc',
  pending_changes: [
    { type: 'ADD_ITEM', item: { name: 'Longsword +1', ... }, timestamp: '...' }
  ]
}

// When player syncs next time:
// 1. Player sends current state
// 2. Backend checks pending_changes
// 3. Backend returns: { snapshot: {...}, pending_changes: [...] }
// 4. Frontend shows modal: "DM gave you: Longsword +1. Accept?"
// 5. Player accepts/rejects
// 6. Frontend updates localStorage
// 7. Frontend re-syncs final state
```

---

## Real-time Combat Tracker

### Socket.io Events

#### Connection & Rooms

```typescript
// Client connects
socket.connect();

// Join encounter room
socket.emit('join_encounter', { encounterId: 'uuid' });

// Leave encounter room
socket.emit('leave_encounter', { encounterId: 'uuid' });
```

#### Combat Events

```typescript
// Server → Clients
'encounter:state_updated'      // Full encounter state refresh
'encounter:participant_added'  // New participant joined
'encounter:participant_updated' // HP, conditions, etc. changed
'encounter:participant_removed' // Participant removed
'encounter:initiative_rolled'  // Initiative rolled, order updated
'encounter:turn_advanced'      // Next turn
'encounter:round_completed'    // Round incremented
'encounter:status_changed'     // planning → active → completed

// Client → Server
'update_hp'                    // { participantId, newHp }
'add_condition'                // { participantId, condition }
'remove_condition'             // { participantId, condition }
'roll_initiative'              // { participantId, result }
'advance_turn'                 // Move to next participant
'add_participant'              // Add new PC/NPC/monster
'remove_participant'           // Remove participant
'start_encounter'              // planning → active
'end_encounter'                // active → completed
```

### Real-time Flow Example: Damage Dealt

```
DM Browser                  Backend                    Player Browser
    │                          │                             │
    │  update_hp               │                             │
    │  { id: 'pc1',            │                             │
    │    newHp: 40 }           │                             │
    ├─────────────────────────>│                             │
    │                          │                             │
    │                          │ UPDATE encounter_participants
    │                          │ SET stats.hp.current = 40   │
    │                          │                             │
    │                          │  emit('encounter:participant_updated')
    │                          ├─────────────────────────────>│
    │<─────────────────────────┤                             │
    │                          │                             │
    │  UI updates: HP 40/60    │         UI updates: HP 40/60│
    │                          │                             │
```

### State Management

**Backend**: Source of truth stored in PostgreSQL
**Frontend**: Local state synced via Socket.io

```typescript
// encounterStore.ts (Zustand)
interface EncounterState {
  currentEncounter: Encounter | null;
  participants: Participant[];

  // Socket.io event handlers
  setupSocketListeners: () => void;

  // Actions
  updateParticipantHp: (id: string, newHp: number) => void;
  addCondition: (id: string, condition: string) => void;
  advanceTurn: () => void;
}

// Socket listener setup
socket.on('encounter:participant_updated', (data) => {
  encounterStore.getState().updateParticipantFromServer(data);
});
```

---

## API Design

### REST Endpoints

#### **Authentication**
```
POST   /api/auth/signup          # Create account (proxies to Supabase)
POST   /api/auth/login           # Login (proxies to Supabase)
POST   /api/auth/logout          # Logout
GET    /api/auth/me              # Get current user
```

#### **User Profiles**
```
GET    /api/users/profile        # Get own profile
PUT    /api/users/profile        # Update own profile
GET    /api/users/:id            # Get user by ID (public info only)
```

#### **Campaigns**
```
GET    /api/campaigns                      # List user's campaigns (as DM or player)
POST   /api/campaigns                      # Create campaign (DM only)
GET    /api/campaigns/:id                  # Get campaign details
PUT    /api/campaigns/:id                  # Update campaign (DM only)
DELETE /api/campaigns/:id                  # Delete campaign (DM only)

GET    /api/campaigns/:id/members          # List campaign members
POST   /api/campaigns/:id/invite           # Invite player (DM only)
POST   /api/campaigns/:id/join             # Join campaign (player, via invite)
DELETE /api/campaigns/:id/members/:userId  # Remove member (DM only)
POST   /api/campaigns/:id/leave            # Leave campaign (player)
```

#### **Character References**
```
GET    /api/campaigns/:id/characters                # List characters in campaign
POST   /api/campaigns/:id/characters/sync           # Sync character snapshot
GET    /api/campaigns/:id/characters/:characterId   # Get character snapshot
DELETE /api/campaigns/:id/characters/:characterId   # Remove character from campaign

POST   /api/campaigns/:id/characters/:characterId/give-item    # DM gives item
POST   /api/campaigns/:id/characters/:characterId/adjust-xp    # DM adjusts XP
GET    /api/campaigns/:id/characters/:characterId/pending      # Get pending changes
POST   /api/campaigns/:id/characters/:characterId/accept-changes # Accept pending changes
```

#### **Encounters**
```
GET    /api/campaigns/:id/encounters          # List encounters in campaign
POST   /api/campaigns/:id/encounters          # Create encounter (DM only)
GET    /api/encounters/:id                    # Get encounter details
PUT    /api/encounters/:id                    # Update encounter (DM only)
DELETE /api/encounters/:id                    # Delete encounter (DM only)

POST   /api/encounters/:id/start              # Start encounter (planning → active)
POST   /api/encounters/:id/end                # End encounter (active → completed)

GET    /api/encounters/:id/participants       # List participants
POST   /api/encounters/:id/participants       # Add participant
PUT    /api/encounters/:id/participants/:pid  # Update participant
DELETE /api/encounters/:id/participants/:pid  # Remove participant

POST   /api/encounters/:id/roll-initiative    # Roll initiative for all participants
POST   /api/encounters/:id/advance-turn       # Advance to next turn
```

### Response Format

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: 'UNAUTHORIZED',
    message: 'You do not have permission to access this campaign'
  }
}

// Validation Error
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details: [
      { field: 'name', message: 'Name is required' }
    ]
  }
}
```

---

## Frontend Integration

### New Stores

#### **campaignStore.ts**
```typescript
interface CampaignStore {
  campaigns: Campaign[];
  activeCampaign: Campaign | null;

  // API calls
  fetchCampaigns: () => Promise<void>;
  createCampaign: (data: CreateCampaignData) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;

  // Members
  invitePlayer: (campaignId: string, email: string) => Promise<void>;
  removeMember: (campaignId: string, userId: string) => Promise<void>;

  // Character sync
  syncCharacter: (campaignId: string, characterId: string) => Promise<void>;
}
```

#### **encounterStore.ts**
```typescript
interface EncounterStore {
  currentEncounter: Encounter | null;
  participants: Participant[];

  // Socket.io
  socket: Socket | null;
  isConnected: boolean;

  // Setup
  connectToEncounter: (encounterId: string) => void;
  disconnectFromEncounter: () => void;

  // Actions (emit to server)
  updateParticipantHp: (participantId: string, newHp: number) => void;
  addCondition: (participantId: string, condition: string) => void;
  rollInitiative: (participantId: string, result: number) => void;
  advanceTurn: () => void;
  addParticipant: (data: AddParticipantData) => void;
  removeParticipant: (participantId: string) => void;

  // Internal state updates (from socket events)
  updateFromServer: (data: any) => void;
}
```

### New Pages/Routes

```
/dm                               # DM Dashboard
/dm/campaigns                     # Campaign list
/dm/campaigns/new                 # Create campaign
/dm/campaigns/[id]                # Campaign details
/dm/campaigns/[id]/characters     # Character management
/dm/campaigns/[id]/encounters     # Encounter list
/dm/campaigns/[id]/encounters/new # Create encounter
/dm/campaigns/[id]/encounters/[encounterId] # Combat tracker

/player/campaigns                 # Player's campaign list
/player/campaigns/[id]            # Player view of campaign
/player/campaigns/join/[token]    # Join campaign via invite link
```

### API Client

```typescript
// src/lib/api/client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

class ApiClient {
  private async fetch(endpoint: string, options?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers
      }
    });

    return response.json();
  }

  campaigns = {
    list: () => this.fetch('/api/campaigns'),
    create: (data) => this.fetch('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    // ... etc
  };
}

export const api = new ApiClient();
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup
**Goal**: Backend + Database + Auth

- [ ] Set up backend project structure (`/backend`)
- [ ] Configure Supabase connection (PostgreSQL direct connection)
- [ ] Implement Supabase Auth integration
- [ ] Create database schema (run migrations)
- [ ] Set up Express server with CORS
- [ ] Implement auth middleware (JWT validation)
- [ ] Basic health check endpoint (`GET /health`)
- [ ] Environment variable configuration
- [ ] Test database connection and auth flow

**Deliverable**: Working backend that connects to Supabase and validates JWTs

---

### Phase 2: Campaign Management
**Goal**: Create, view, manage campaigns

**Backend:**
- [ ] Campaign CRUD endpoints
- [ ] Campaign member management endpoints
- [ ] Invitation system (generate invite links)
- [ ] Authorization checks (DM-only actions)

**Frontend:**
- [ ] Auth UI (login/signup with Supabase)
- [ ] Create `campaignStore.ts`
- [ ] Create API client (`/lib/api/client.ts`)
- [ ] DM dashboard (`/dm`)
- [ ] Campaign list page (`/dm/campaigns`)
- [ ] Create campaign form
- [ ] Campaign detail page
- [ ] Invite players UI
- [ ] Player campaign list (`/player/campaigns`)
- [ ] Join campaign flow

**Deliverable**: DMs can create campaigns and invite players

---

### Phase 3: Character Sync System
**Goal**: Players can share characters with campaigns

**Backend:**
- [ ] Character reference endpoints
- [ ] Character snapshot storage
- [ ] Sync endpoint (upsert snapshot)
- [ ] Pending changes system (for DM → Player updates)

**Frontend:**
- [ ] "Share with Campaign" button on character sheet
- [ ] Character sync UI in campaign view
- [ ] Display character list in DM campaign view
- [ ] Character snapshot viewer (read-only for DM)
- [ ] Re-sync button for players
- [ ] Pending changes notification/modal

**Deliverable**: Players can share characters, DMs can view character data

---

### Phase 4: Real-time Combat Tracker (Part 1 - Backend)
**Goal**: Backend supports combat encounters with Socket.io

**Backend:**
- [ ] Set up Socket.io server
- [ ] Encounter CRUD endpoints
- [ ] Encounter participant endpoints
- [ ] Socket.io event handlers:
  - [ ] Join/leave encounter rooms
  - [ ] Update HP
  - [ ] Add/remove conditions
  - [ ] Roll initiative
  - [ ] Advance turn
  - [ ] Add/remove participants
- [ ] Broadcast encounter state to all connected clients
- [ ] Handle disconnections gracefully

**Deliverable**: Backend API for combat tracker with real-time sync

---

### Phase 5: Real-time Combat Tracker (Part 2 - Frontend)
**Goal**: UI for combat tracker with live updates

**Frontend:**
- [ ] Create `encounterStore.ts` with Socket.io client
- [ ] Socket.io connection management
- [ ] Combat tracker UI (`/dm/campaigns/[id]/encounters/[encounterId]`)
  - [ ] Initiative list (sorted)
  - [ ] HP bars with quick adjust
  - [ ] Condition tags
  - [ ] Add participant modal (PC, NPC, Monster)
  - [ ] Roll initiative button
  - [ ] Advance turn / Next round buttons
  - [ ] Round counter
  - [ ] Turn indicator
- [ ] Player view of encounter (read-only)
- [ ] Monster search/import from bestiary
- [ ] Real-time updates (optimistic UI)

**UI Options to Decide:**
- List-based vs. Canvas-based layout
- Mobile-friendly design
- Drag-and-drop initiative reordering

**Deliverable**: Functional combat tracker with real-time sync

---

### Phase 6: DM Character Interaction
**Goal**: DM can give items, adjust XP, manage character resources

**Backend:**
- [ ] Give item endpoint (adds to pending changes)
- [ ] Adjust XP endpoint
- [ ] Adjust resources endpoint (gold, spell slots, etc.)
- [ ] Apply condition endpoint

**Frontend:**
- [ ] DM character detail view (enhanced read-only sheet)
- [ ] "Give Item" modal
- [ ] "Adjust XP" modal
- [ ] Resource adjustment controls
- [ ] Player notification system (pending changes)
- [ ] Accept/reject changes flow

**Deliverable**: DMs can interact with player character state

---

### Phase 7: Polish & Testing
**Goal**: Production-ready DM features

- [ ] Error handling (network failures, auth errors)
- [ ] Loading states and skeletons
- [ ] Optimistic UI updates
- [ ] Offline detection
- [ ] Socket.io reconnection logic
- [ ] Data validation (Zod schemas)
- [ ] Security audit (SQL injection, XSS, auth bypass)
- [ ] Performance testing (Socket.io load)
- [ ] E2E testing (Playwright)
- [ ] Documentation (API docs, user guides)

**Deliverable**: Stable, tested DM features ready for production

---

### Phase 8: Future Enhancements
**Nice-to-haves for later:**

- [ ] Session notes and logging
- [ ] Combat log (damage history, actions taken)
- [ ] Loot distribution system
- [ ] Initiative auto-roller (dice roller integration)
- [ ] Monster stat block importer
- [ ] Map/grid integration (battle map)
- [ ] Voice/video chat integration
- [ ] Shared campaign calendar
- [ ] Quest tracking
- [ ] NPC relationship tracker
- [ ] Homebrew content sharing

---

## Open Questions

### Technical Decisions

1. **Combat Tracker UI**
   - Option A: List-based (simpler, mobile-friendly)
   - Option B: Canvas-based with ReactFlow (visual, drag-and-drop)
   - Option C: Hybrid (list with optional map overlay)
   - **Decision**: TBD

2. **Initiative Rolling**
   - Auto-roll on encounter start?
   - Manual entry only?
   - Integration with 3D dice roller?
   - **Decision**: TBD

3. **Character Snapshot Frequency**
   - Manual sync only?
   - Auto-sync on long rest?
   - Auto-sync on level up?
   - Auto-sync every N minutes?
   - **Decision**: TBD

4. **Backend Deployment**
   - Same server as Next.js (monorepo)?
   - Separate deployment (Railway, Render)?
   - Docker container?
   - **Decision**: TBD

5. **Socket.io Scaling**
   - Single server sufficient initially?
   - Redis adapter for multi-server (future)?
   - **Decision**: Start with single server

6. **Migration Strategy**
   - Use migration tool (node-pg-migrate)?
   - Manual SQL files in `/backend/migrations`?
   - Supabase dashboard only?
   - **Decision**: TBD

### Feature Scope

1. **Character Privacy**
   - Can players mark sections of character sheet as "private" (hidden from DM)?
   - **Decision**: TBD (default: DM sees all shared data)

2. **Co-DM Support**
   - Phase 1 or later?
   - What permissions do co-DMs have?
   - **Decision**: Add to Phase 2 (simple role flag)

3. **Player-to-Player Sharing**
   - Can players share items with each other?
   - **Decision**: Future enhancement (Phase 8+)

4. **Offline Combat Tracking**
   - Can DM run combat offline and sync later?
   - **Decision**: No (combat requires real-time, online only)

5. **Character Approval**
   - Does DM need to "approve" character builds?
   - **Decision**: No (trust-based, DM can view and discuss)

### UI/UX Decisions

1. **DM vs Player Role Switching**
   - Separate routes (`/dm` vs `/player`)?
   - Single interface with role toggle?
   - **Decision**: Separate routes (clearer separation)

2. **Campaign Invitation Method**
   - Email invites (requires email service)?
   - Shareable link only?
   - Both?
   - **Decision**: Shareable link (Phase 2), email later

3. **Mobile Support**
   - Full mobile UI for combat tracker?
   - Desktop-only for DM features?
   - **Decision**: Desktop-first, mobile-friendly (responsive)

4. **Notifications**
   - In-app only?
   - Email notifications for invites?
   - Push notifications?
   - **Decision**: In-app initially, email future

---

## Success Metrics

### Phase 2 Success Criteria
- [ ] DM can create campaign
- [ ] DM can invite player via link
- [ ] Player can join campaign
- [ ] Campaign member list displays correctly

### Phase 3 Success Criteria
- [ ] Player can sync character to campaign
- [ ] DM sees character snapshot in campaign
- [ ] Character data updates when player re-syncs

### Phase 5 Success Criteria
- [ ] DM can create encounter
- [ ] DM can add 5+ participants (PCs + monsters)
- [ ] Initiative tracker updates in real-time for all connected users
- [ ] HP changes sync instantly between DM and players
- [ ] No race conditions or duplicate updates

---

## Notes

- All timestamps in UTC
- Use UUIDs for all primary keys
- Database uses `snake_case`, TypeScript uses `camelCase`
- API responses always include `success` boolean
- Socket.io events prefixed by entity type (e.g., `encounter:`, `campaign:`)
- Character snapshots are deep clones, not references
- Pending changes have expiration (7 days default)

---

**End of Technical Specification**
