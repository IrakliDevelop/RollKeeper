# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier + ESLint fix
npm run type-check   # TypeScript checking (no emit)
npm run test         # Run tests (Storybook/Vitest + Playwright/Chromium)
npm run storybook    # Storybook dev server on port 6006
```

For campaign sync during local development, start Redis first:
```bash
docker-compose up -d   # Starts Redis + serverless-redis-http on port 8079
```

Copy `.env.example` to `.env.local` — the defaults work with `docker-compose` for local Redis.

## Architecture

### Next.js App Router structure

- `src/app/` — Pages and API routes
  - `player/` — Player-facing views: character list (`/player`), new character (`/player/characters/new`), character sheet (`/player/characters/[characterId]`)
  - `dm/` — DM view: campaign dashboard (`/dm`), campaign detail (`/dm/campaign/[code]`)
  - `bestiary/`, `spellbook/`, `classes/` — Reference compendiums (read-only)
  - `api/` — API routes serving JSON game data and handling campaign sync
- `src/components/` — Reusable components
  - `shared/` — Domain components grouped by feature (character, combat, spells, conditions, stats)
  - `ui/` — Design system primitives (campaign, forms, game, layout, feedback, primitives)
- `src/store/` — Zustand stores (all use `persist` middleware with localStorage)
  - `characterStore.ts` — Active character state (single character at a time, all game mechanics)
  - `playerStore.ts` — Multi-character roster, player settings, avatar, campaign link per character
  - `dmStore.ts` — DM identity (auto-generated ID) and campaign list
- `src/hooks/` — Custom hooks; data-fetching hooks (`useSpellsData`, `useWeaponsDbData`, etc.) call the `/api` routes
- `src/types/` — TypeScript interfaces; `character.ts` is the central type file
- `src/utils/` — Pure helpers: `calculations.ts` (D&D math), `hpCalculations.ts`, `constants.ts`, `*DataLoader.ts` (parse raw JSON game data), `*Conversion.ts` (map raw data to internal types)
- `json/` — Static game data (monsters, spells, items, classes, etc.) loaded via API routes

### State & data flow

Character editing flows through `characterStore`, which is loaded when a player opens a character. `playerStore` holds the roster and writes the updated `characterData` blob back when `saveCharacter()` is called. Auto-save is handled by `useAutoSave` with a debounce.

Campaign sync (DM ↔ players) uses Upstash Redis via Next.js API routes. Players push their character snapshot; the DM dashboard polls `useCampaignSync` on a 10-second interval.

Game reference data (spells, monsters, items, etc.) lives in `/json` as large JSON files. API routes in `src/app/api/` serve and filter this data; client hooks (`src/hooks/use*Data.ts`) fetch from those routes and return typed results.

### Path alias

`@/*` maps to `src/*` — use it for all internal imports.

### Environment variables

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Redis HTTP proxy URL (use `http://localhost:8079` locally) |
| `UPSTASH_REDIS_REST_TOKEN` | Auth token (`local_dev_token` locally) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 avatar uploads (optional) |
| `AWS_REGION` / `S3_BUCKET_NAME` | S3 config (optional) |

### Testing

Tests are Storybook component tests run via Vitest + Playwright in headless Chromium. There is no separate Jest config for unit tests despite the `"test": "jest"` script — the actual test runner is `vitest`.

## Character sheet layout

The character page (`/player/characters/[characterId]`) uses `TabbedCharacterSheet` → `BookmarkTabs` (persisted via `localStorage` key `tabbed-layout-active-tab`). The tab structure lives in `src/components/ui/character/tabbedSheetConfig.tsx`.

**Top-level tabs:**
| Tab | Key content |
|---|---|
| Actions | Weapon/spell attacks, compact spell slot tracker |
| Stats | Basic info, ability scores, saving throws, skills, XP |
| Combat | AC, initiative, speed, HP manager, hit dice, conditions |
| Spells | Spellcasting stats, spell slots, spell list (hidden for non-casters) |
| Inventory | Sub-tabs: Weapons · Magic Items · Armor · Items · Currency |
| Features | Sub-tabs: Abilities (extended features) · Inspiration · Proficiencies |
| Character | Features/traits editors, character background, session notes |

**UX principles to follow when adding or changing content in this page:**
- Keep each tab focused — don't pile unrelated sections into an existing tab; add a new tab instead
- Prefer sub-tabs (like Inventory and Features do) over long vertical scrolling within a tab
- The `CharacterHUD` at the top always shows HP, AC, and key vitals — don't duplicate those stats inline in tabs
- Use `lg:grid-cols-2` two-column layouts for dense-but-related pairs (e.g., Abilities + Skills); full-width for detail-heavy content (e.g., spells, notes)

## Frontend Guidelines

### Dark mode

The app supports light and dark themes via a `data-theme="dark"` attribute on `<html>`, set before hydration from `localStorage` key `rollkeeper-theme`. Theme is toggled via `useTheme` hook.

**Always use semantic CSS custom-property tokens — never raw Tailwind color classes like `bg-gray-800` or `text-white`.** The tokens automatically resolve to the correct value for each theme:

```
Backgrounds:  bg-surface, bg-surface-raised, bg-surface-secondary, bg-surface-elevated
Text:         text-heading, text-body, text-muted, text-faint
Borders:      border-divider
Accents:      text-accent-{color}-text, bg-accent-{color}-bg, border-accent-{color}-border
              (colors: red, blue, purple, amber, emerald, orange)
```

When building or reviewing UI, verify it looks correct in both themes. If hardcoded colors appear, replace them with the appropriate semantic token.

### Design system — always use existing components

Never create custom buttons, inputs, cards, or other UI primitives. Use the established design system:

```typescript
// Forms
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Switch } from '@/components/ui/forms/switch';
import { RadioGroupField, RadioGroupItem } from '@/components/ui/forms/radio-group';
import { Autocomplete } from '@/components/ui/forms/Autocomplete';

// Layout
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';

// Feedback / overlays — use dialog-new, NOT the legacy Modal
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogTrigger } from '@/components/ui/feedback/dialog-new';

// Design tokens
import { colors, spacing, fontSize, shadows, borderRadius } from '@/components/ui/primitives';
```

Use `Button` with `variant`: `primary | secondary | success | danger | warning | outline | ghost | link`.

### Naming conventions

- **Components**: PascalCase — `PlayerCard`, `DiceRoller`
- **Hooks**: `use` prefix — `usePlayerData`, `useDiceRoll`
- **Utils**: camelCase — `formatDate`, `calculateModifier`
- **Constants**: SCREAMING_SNAKE_CASE — `MAX_LEVEL`, `DEFAULT_HP`
- **Types/Interfaces**: PascalCase — `PlayerProps`, `GameState`
- **Event handlers**: `handle` prefix on implementations (`handleClick`), `on` prefix on props (`onClick`)

### Component structure

- Keep components under ~150 lines; extract logic into custom hooks when a component handles too much
- For complex components use the folder pattern:
  ```
  ComponentName/index.tsx
  ComponentName/ComponentName.hooks.ts
  ComponentName/ComponentName.types.ts
  ComponentName/ComponentName.utils.ts
  ```
- Prefer early returns for loading/error states over deeply nested conditionals

### Import order

1. React and Next.js
2. Third-party libraries
3. Design system (`@/components/ui/...`)
4. Local components
5. Hooks
6. Utils/helpers
7. Types
8. Styles/constants

### Anti-patterns to avoid

- `any` type — define proper TypeScript types
- Index as key for dynamic lists
- Inline object/array creation in render (causes needless re-renders)
- Direct state mutation — always use immutable updates
- `useEffect` data fetching without cleanup
- Hardcoded colors/spacing — use design tokens
- The legacy `Modal` component — use `Dialog` from `dialog-new`
