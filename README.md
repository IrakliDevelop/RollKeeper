# RollKeeper - Complete D&D Companion App

A comprehensive, web-based Dungeons & Dragons companion application built with Next.js, featuring character management, combat tracking, campaign tools, and an intuitive interface designed for both players and Dungeon Masters.

## 🎲 What is RollKeeper?

RollKeeper is your all-in-one digital companion for Dungeons & Dragons. Whether you're a player managing multiple characters or a DM running campaigns, RollKeeper provides the tools you need to enhance your tabletop experience.

### ✨ Key Features

- **🎭 Character Management**: Create and manage multiple D&D characters with auto-calculating sheets
- **⚔️ Combat Tracking**: Visual initiative tracker with drag-and-drop functionality
- **📚 Campaign Tools**: Comprehensive DM toolset for session management and notes
- **🐉 Monster Bestiary**: Access to creature database and stat blocks
- **📖 Spell Management**: Complete spell tracking and quick-cast system
- **🎲 Integrated Dice Rolling**: 3D dice with advantage/disadvantage support
- **💾 Auto-Save**: Automatic character data persistence with visual feedback
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## 🚀 Tech Stack

- **Framework**: Next.js 15.4.1 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI (accessible, unstyled components)
- **State Management**: Zustand
- **Form Handling**: React Hook Form with Zod validation
- **Rich Text**: TipTap editor for notes and descriptions
- **3D Dice**: @3d-dice/dice-box for immersive rolling
- **Animations**: Framer Motion for smooth interactions
- **Icons**: Lucide React

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Landing page
│   ├── player/            # Player tools and character management
│   ├── dm/                # DM tools and campaign management
│   ├── bestiary/          # Monster database
│   ├── spellbook/         # Spell management
│   ├── classes/           # Character class information
│   └── api/               # API routes
├── components/             # Reusable React components
│   ├── character/         # Character sheet components
│   ├── ui/                # Base UI components
│   ├── layout/            # Layout and navigation
│   └── dice/              # Dice rolling components
├── hooks/                  # Custom React hooks
├── store/                  # Zustand state management
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions and calculations
└── styles/                 # Global styles and themes
```

## 🎯 Current Features

### ✅ Implemented

- **Landing Page**: Beautiful, responsive homepage with feature overview
- **Character Management**: Full character creation and editing system
- **Auto-Calculations**: Automatic stat calculations, modifiers, and proficiency bonuses
- **Combat Tracking**: Visual initiative tracker with drag-and-drop
- **Spell Management**: Complete spell system with damage rolling
- **Monster Bestiary**: Creature database with search and filtering
- **Rich Text Editor**: Notes, features, and traits with formatting
- **3D Dice Rolling**: Immersive dice rolling with advantage/disadvantage
- **Responsive Design**: Mobile-first design that works on all devices
- **Auto-Save**: Automatic character data persistence
- **Export/Import**: JSON-based character data portability
- **User Authentication**: Secure account system with JWT tokens
- **Cloud Sync**: Real-time character synchronization across devices
- **Real-Time Multiplayer**: Server-Sent Events for live campaign updates
- **Enhanced Battle Tracker**: Compact DM view with real-time player monitoring

### 🚧 In Development

- **Campaign Management**: Session tracking and story progression
- **Advanced Combat**: Initiative order management and turn tracking
- **Spell Components**: Material and somatic component tracking
- **Inventory System**: Equipment and item management
- **Mobile Apps**: Native iOS/Android applications

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rollkeeper.git
   cd rollkeeper
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## 🎮 How to Use

### For Players

1. **Access Player Dashboard**: Click "Player Dashboard" from the main page
2. **Create Characters**: Build new characters with the intuitive character builder
3. **Manage Sheets**: Edit character details, stats, and abilities
4. **Track Resources**: Monitor spells, hit points, and character progression
5. **Roll Dice**: Use the integrated 3D dice system for all your rolls

### For Dungeon Masters

1. **Access DM Toolset**: Click "DM Toolset" from the main page
2. **Create Account**: Sign up to enable campaign management and real-time features
3. **Manage Campaigns**: Create campaigns and invite players
4. **Track Combat**: Use the enhanced battle tracker with real-time player monitoring
5. **Access Bestiary**: Search and reference monster stat blocks
6. **Monitor Players**: See live HP, spell slots, and condition updates

### Authentication & Cloud Features

1. **Create Account**: Sign up at `/auth` to unlock cloud features
2. **Cloud Sync**: Characters automatically sync across all devices
3. **Real-Time Campaigns**: Join DM campaigns for live multiplayer sessions
4. **Offline Support**: Continue playing without internet, sync when reconnected
5. **Data Security**: All data encrypted and securely stored

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Optional: Database connection (for future features)
DATABASE_URL=your_database_url_here

# Optional: Authentication (for future features)
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### Tailwind CSS

The project uses Tailwind CSS 4 with custom configurations. Styles are automatically processed and optimized.

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+