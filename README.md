# RollKeeper

A comprehensive web-based D&D 5e companion application for players and Dungeon Masters. Built with Next.js, featuring full character sheet management, real-time campaign synchronization, encounter tracking, NPC management, interactive maps, and searchable game reference compendiums.

## Features

### Player Tools

**Character Management**
- Create and manage multiple characters with a full roster system
- Tabbed character sheet with auto-calculating stats, modifiers, and proficiency bonuses
- Auto-save with debounce, manual save (Ctrl+S), and save-on-tab-switch
- Character import/export (JSON) with bulk import support
- Character duplication and archiving
- S3-backed avatar uploads

**Actions & Combat**
- Quick-cast spells with integrated damage and saving throw rolls
- Attack rolls with advantage/disadvantage, critical hits, and fumble detection
- 3D animated dice rolling (d4, d6, d8, d10, d12, d20) via `@3d-dice/dice-box`
- Spell attack bonus and spell save DC auto-calculation
- Reaction tracking (used/reset per turn)
- Initiative calculation from Dexterity with manual overrides

**Spellcasting**
- Full spell slot tracking (levels 1-9) with inline slot indicators per spell level
- Spell casting modal with level selection, concentration warnings, and ritual casting
- Free casts: at-will spells and innate spells with limited daily uses
- Warlock Pact Magic with separate slot tracking and short rest recovery
- Concentration tracking (only one spell at a time, with warnings)
- Spell search, filtering, and preparation management
- Drag-and-drop spell reordering
- Favorite spells for quick access

**Inventory & Equipment**
- Five sub-tabs: Weapons, Magic Items, Armor, Items, Currency
- Equipped weapons with damage types, properties, and proficiency tracking
- Magic items with rarity, attunement status, and charges
- Armor with AC contribution and shield bonus toggling
- Currency tracking (GP/SP/CP) with total value calculation
- Weight tracking and encumbrance calculation
- Import items from the compendium database
- Receive item transfers from the DM

**Character Progression**
- XP tracking with level-up notifications
- Multiclass management (add/remove classes, per-class leveling)
- Extended features with usage tracking (short rest / long rest recovery)
- Tool proficiencies, languages, senses, and weapon proficiencies
- Saving throw proficiencies with custom modifiers
- All 18 D&D 5e skills with proficiency, expertise, and Jack of All Trades support

**Combat & Health**
- Hit Point Manager with current, max, and temporary HP
- Death saving throws with success/failure tracking and stabilization
- Hit dice tracker (per die type) with short rest recovery
- Conditions and diseases tracking with duration, stacking, and source
- Temporary buffs/debuffs with ability score, AC, and damage bonuses
- Damage resistances, immunities, vulnerabilities, and condition immunities

**Summons & Familiars**
- Create and track summoned creatures and familiars
- Reusable creature templates saved across summon cycles
- Summon HP/AC synchronization with encounter tracker
- Concentration requirement tracking and duration management

**Roleplaying & Notes**
- Rich text session notes (TipTap editor with formatting, lists, tables)
- Character background editor (backstory, personality, ideals, bonds, flaws)
- Character traits and features organization by source (class, race, feat, background)

**Campaign Integration**
- Join DM campaigns via campaign code
- Real-time HP and stat syncing to the DM dashboard
- Party HP sidebar — view other party members' health at a glance with opt-out privacy
- Receive DM messages, conditions, item transfers, and custom counter updates
- In-game calendar view with moon phases, seasons, and events
- Location map view (player-safe, DM-only annotations hidden)

### Dungeon Master Tools

**Campaign Management**
- Create campaigns with auto-generated join codes
- Campaign banner image upload
- Player monitoring dashboard with character summaries and last-sync timestamps
- Send rich text messages to individual players or broadcast to all
- Custom per-player counters (e.g., "Desperation Points", "Exhaustion")
- Player color assignment for visual organization

**NPC Management**
- Create NPCs manually or import from the bestiary
- Full NPC stat blocks with ability scores, HP, AC, speed, proficiency bonus
- NPC organization with groups/tags, drag-and-drop reordering, and search filtering
- Collapsible groups with persistent state
- Per-NPC features:
  - **Stat Block** — Full monster stat block display with traits, actions, reactions, legendary actions, lair actions
  - **Spells** — Spell slot tracking, free casts (at-will/innate), concentration tracking, spell casting with level selection
  - **Inventory** — Equipment and items with rarity, weight, value; send items to players
  - **Lore** — Rich text NPC backstory and notes
- NPC stat block export (copy as image, download PNG)
- NPC HP, death saves, and hit dice persistence across sessions

**Encounter & Combat Tracker**
- Create and manage multiple encounters per campaign
- Add players (synced from campaign), NPCs, or monsters from the bestiary
- Initiative tracking with roll-all, manual entry, and auto-sort
- Turn order management (next turn, previous turn) with round counter
- Per-entity combat actions:
  - Damage and healing
  - Add/remove conditions (DM-applied conditions sync to player sheets)
  - Ability usage tracking with recharge mechanics
  - Legendary action economy (use/reset per round)
  - Lair action tracking
  - Concentration spell tracking
  - Long rest / short rest for NPCs
- Hide/show player HP toggle for screen sharing
- View NPC spell details and cast spells directly from the encounter
- Player summon entities auto-sync into encounters

**Location Maps**
- Create location maps with image uploads
- Canvas-based annotation via TlDraw
- Configurable grid overlay (square or hex, cell size, color, opacity)
- DM-only elements that are hidden from player view
- Render player-safe PNG snapshots
- Real-time sync to player location view

**Battle Maps**
- Dedicated battle map system separate from location maps
- Link battle maps to encounters
- Canvas annotation with grid overlay
- DM-only fog of war and annotations
- Player-safe state sharing

**Campaign Calendar**
- Fully customizable calendar system:
  - Custom weekday and month names with configurable lengths
  - Seasons with sunrise/sunset times
  - Multiple moons with phase tracking
  - Named years and eras with year offsets
  - Clock configuration (hours/minutes/seconds per day)
- Add events to the timeline
- Set long/short rest durations and round duration
- Calendar state syncs to players (with DM-only elements hidden)

### Reference Compendiums

**Bestiary** (`/bestiary`)
- Complete D&D 5e monster database with full stat blocks
- Filter by CR, type, size, alignment, and source
- Search with autocomplete
- Stat blocks include traits, actions, reactions, legendary/lair actions, and spellcasting

**Spellbook** (`/spellbook`)
- Full spell database with detailed descriptions
- Filter by class, level, school, casting time, concentration, ritual, range, and components
- Higher-level scaling information
- Source book and page references

**Classes** (`/classes`)
- All D&D 5e classes with hit dice, proficiencies, and spellcasting info
- Class features by level with progression tables
- Subclass options
- Filter by spellcasting type

**Feats** (`/feats`)
- Complete feat list with descriptions, prerequisites, and benefits
- Search and filter by prerequisite or benefit type

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **State** | Zustand 5 (with localStorage persistence) |
| **UI Components** | Radix UI (Dialog, Tabs, Checkbox, Radio, Select, Tooltip) |
| **Rich Text** | TipTap 3 |
| **Forms** | React Hook Form 7 + Zod 4 |
| **Dice** | @3d-dice/dice-box |
| **Canvas/Maps** | TlDraw 4 |
| **Icons** | Lucide React |
| **Animations** | Framer Motion |
| **Sync** | Upstash Redis (serverless HTTP) |
| **File Storage** | AWS S3 |
| **Testing** | Vitest + Storybook + Playwright |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Docker (for local Redis — required for campaign sync features)

### Installation

```bash
# Clone the repository
git clone https://github.com/AbandonedLand/RollKeeper.git
cd rollkeeper

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
```

### Local Redis Setup

Campaign sync (DM-player communication) requires Redis. The included Docker Compose file sets up Redis and a serverless HTTP wrapper:

```bash
# Start Redis + serverless-redis-http
docker-compose up -d
```

This starts:
- **Redis** on port 6379
- **Serverless Redis HTTP** on port 8079 (proxies REST calls to Redis)

The default `.env.example` values work with this setup — no changes needed.

### Environment Variables

| Variable | Required | Default (local) | Purpose |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Yes (for sync) | `http://localhost:8079` | Redis HTTP proxy URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (for sync) | `local_dev_token` | Redis auth token |
| `AWS_ACCESS_KEY_ID` | No | — | S3 avatar/banner uploads |
| `AWS_SECRET_ACCESS_KEY` | No | — | S3 avatar/banner uploads |
| `AWS_S3_REGION` | No | `eu-central-1` | S3 bucket region |
| `AWS_S3_BUCKET_NAME` | No | `rollkeeper-images` | S3 bucket name |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` | No | — | TlDraw license for maps |

> **Note:** The app works without AWS credentials — avatar and banner uploads will be disabled. Redis is only needed for campaign sync features; character sheets work fully offline with localStorage.

### Run the App

```bash
# Development server (with Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

```bash
npm run dev          # Development server (Turbopack)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier + ESLint fix
npm run type-check   # TypeScript type checking
npm run test         # Run tests (Vitest + Playwright)
npm run storybook    # Storybook dev server (port 6006)
```

## Architecture

### Data Flow

- **Character data** is stored in the browser's localStorage via Zustand persist middleware. No server-side database is needed for single-player use.
- **Campaign sync** uses Upstash Redis via Next.js API routes. Players push character snapshots; the DM dashboard polls on a 10–15 second interval.
- **Game reference data** (monsters, spells, items, classes) lives in `/json` as static JSON files, served and filtered through API routes under `/api`.

### Project Structure

```
src/
  app/                    # Next.js App Router pages & API routes
    player/               # Player views (roster, character sheet)
    dm/                   # DM views (dashboard, campaigns, encounters, maps)
    bestiary/             # Monster reference compendium
    spellbook/            # Spell reference compendium
    classes/              # Class reference compendium
    feats/                # Feat reference compendium
    api/                  # API routes (data serving & campaign sync)
  components/
    ui/                   # Design system (forms, layout, feedback, game UI)
    shared/               # Shared domain components (character, combat, spells)
  store/                  # Zustand stores (all localStorage-persisted)
  hooks/                  # Custom React hooks (data fetching, sync, theme)
  types/                  # TypeScript interfaces
  utils/                  # Pure helpers (D&D math, data conversion)
json/                     # Static game data (monsters, spells, items, etc.)
```

## License

MIT
