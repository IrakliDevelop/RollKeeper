# RollKeeper

A web-based D&D companion application built with Next.js, featuring character management, combat tracking, and comprehensive reference tools for players and Dungeon Masters.

## Features

### Player Tools
- **Character Sheets** — Create and manage multiple D&D characters with auto-calculating stats, modifiers, and proficiency bonuses
- **Spell Management** — Track spells, spell slots, and quick-cast with damage rolling
- **Inventory & Equipment** — Manage weapons, armor, currency, and items
- **Conditions Tracking** — Monitor active conditions and their effects
- **3D Dice Rolling** — Integrated dice roller with advantage/disadvantage support

### Reference Compendiums
- **Bestiary** — Searchable monster database with stat blocks and filtering
- **Spellbook** — Complete spell reference with search and filters
- **Classes** — Class information and progression details

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **UI**: Radix UI, Framer Motion
- **Forms**: React Hook Form + Zod
- **Rich Text**: TipTap
- **Dice**: @3d-dice/dice-box

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/rollkeeper.git
cd rollkeeper

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

```bash
npm run dev        # Development server (Turbopack)
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint
npm run format     # Prettier + ESLint fix
npm run type-check # TypeScript checking
```

## Data

Game data (monsters, spells, classes, etc.) is stored in the `/json` directory and served via API routes.

## License

MIT
