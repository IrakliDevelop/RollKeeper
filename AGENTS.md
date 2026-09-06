# RollKeeper agent instructions

This is the primary instruction file for this repository, following the
[AGENTS.md](https://agents.md) open standard (Agentic AI Foundation, Linux
Foundation). It is tool-agnostic and read natively by most AI coding agents
(Codex, Cursor, GitHub Copilot, Windsurf, Gemini CLI, Devin, and others).
Claude Code imports it via `@AGENTS.md` from `CLAUDE.md`, which adds a small
set of Claude-specific instructions below that import — if you're Claude
Code, read `CLAUDE.md`, not this file directly, so you get both.

For deep architecture detail beyond what fits here (state management, the
storage migration, live sync, cloud backend, fog of war/VTT, testing, etc.),
see the [project wiki](docs/wiki/README.md) — this file stays a concise
orientation; the wiki has the depth.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Pull request writing

Keep PR titles, bodies, and verification notes concise. Include only the
outcome, essential design changes, checks run, and unresolved risks or
blockers. Omit implementation diaries, task-by-task chronology, raw logs,
repeated rationale, and generated-session links. Prefer short bullets and link
to existing documentation or tests instead of restating them. Expand only when
the user asks or a material risk needs explanation.

## Commands

```bash
npm run dev          # Development server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier + ESLint fix
npm run type-check   # TypeScript checking (no emit)
npm run test         # Unit/component tests (Vitest, jsdom — no browser)
npm run test:visual  # Storybook Component Tests (Vitest, real Chromium)
npm run storybook    # Storybook dev server on port 6006
```

There are also large Playwright e2e and Node integration test families for
specific subsystems (fog of war, IndexedDB migration, auth, cloud sync) — see
[docs/wiki/10-testing.md](docs/wiki/10-testing.md) before assuming `npm run test`
covers them; it doesn't.

For campaign sync during local development, start Redis first:
```bash
docker-compose up -d   # Starts Redis + serverless-redis-http on port 8079
```

For the Supabase-backed cloud features, start the local Supabase stack:
```bash
npm run db:start
```

Copy `.env.example` to `.env.local` — the defaults work with `docker-compose`
for local Redis and the Supabase CLI for local Supabase.

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
- `src/store/` — Zustand stores (persisted, most now migrating from localStorage to IndexedDB — see [docs/wiki/02-state-management.md](docs/wiki/02-state-management.md) and [docs/wiki/03-persistence-and-storage-migration.md](docs/wiki/03-persistence-and-storage-migration.md))
- `src/hooks/` — Custom hooks; data-fetching hooks (`useSpellsData`, `useWeaponsDbData`, etc.) call the `/api` routes; `use*Sync` hooks handle live campaign sync
- `src/lib/` — Non-React logic: sync engines, IndexedDB migration, Supabase gateways, fog of war/battle-map auth — the largest and least obvious part of the codebase, see the wiki before editing here
- `src/types/` — TypeScript interfaces; `character.ts` is the central type file
- `src/utils/` — Pure helpers: `calculations.ts` (D&D math), `hpCalculations.ts`, `constants.ts`, `*DataLoader.ts` (parse raw JSON game data), `*Conversion.ts` (map raw data to internal types)
- `json/` — Static game data (monsters, spells, items, classes, etc.) loaded via API routes

### State & data flow

Character editing flows through `characterStore`, which is loaded when a player opens a character. `playerStore` holds the roster and writes the updated `characterData` blob back when `saveCharacter()` is called. Auto-save is handled by `useAutoSave` with a debounce.

Campaign sync (DM ↔ players) uses Upstash Redis via Next.js API routes for live session state, and Supabase for durable cross-device storage — these are two distinct systems with different guarantees; see [docs/wiki/04-campaign-sync-redis.md](docs/wiki/04-campaign-sync-redis.md) and [docs/wiki/05-cloud-backend-supabase.md](docs/wiki/05-cloud-backend-supabase.md) before assuming which one a change touches.

Game reference data (spells, monsters, items, etc.) lives in `/json` as large JSON files. API routes in `src/app/api/` serve and filter this data; client hooks (`src/hooks/use*Data.ts`) fetch from those routes and return typed results.

### Path alias

`@/*` maps to `src/*` — use it for all internal imports.

### Environment variables

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Redis HTTP proxy URL (use `http://localhost:8079` locally) |
| `UPSTASH_REDIS_REST_TOKEN` | Auth token (`local_dev_token` locally) |
| Supabase env vars | See `.env.example`; local dev uses the Supabase CLI (`npm run db:start`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 avatar uploads (optional) |
| `AWS_REGION` / `S3_BUCKET_NAME` | S3 config (optional) |

### Testing

Three separate test runners are in play — see
[docs/wiki/10-testing.md](docs/wiki/10-testing.md) for the full breakdown:
Vitest (`unit` project = jsdom, no browser; `storybook` project = real
Chromium via Storybook Component Tests), Playwright (general e2e plus several
purpose-specific configs), and Node's built-in test runner for Supabase/DB
integration tests. `npm run test` only runs the jsdom `unit` project.

## Manual browser acceptance gate

For PRs that affect browser-visible UI, navigation, authentication, local
persistence, IndexedDB, offline behavior, downloads, network failures, or
cloud-sync controls, run a manual browser acceptance check with your agent's
browser automation capability after automated checks pass and before calling
the PR complete or ready to merge. This repo ships a concrete implementation
of that gate per agent:

- **Claude Code** — `/rollkeeper-manual-browser`
  (`.claude/skills/rollkeeper-manual-browser/SKILL.md`), via Claude's Chrome
  extension integration.
- **Codex** — `.agents/skills/rollkeeper-manual-browser/SKILL.md`, via
  Codex desktop's in-app Browser.

Both use the same isolated `*.localhost` origins and deterministic synthetic
seed data — never the user's real browser sessions, accounts, cookies, or
storage. If your agent/tool has no equivalent browser-automation capability,
report the gate as **blocked** with the reason — never as passed or skipped.
Never substitute Storybook/Vitest, standalone Playwright, a Playwright/Puppeteer
MCP server, `curl`, or headless Chromium and call it manual verification;
those are supplemental evidence only. A server-only or documentation-only PR
may mark this gate not applicable, but the final report must state why.

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

// Feedback / overlays
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogTrigger } from '@/components/ui/feedback/dialog';

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
- The legacy `Modal` component — use `Dialog` from `@/components/ui/feedback/dialog`
