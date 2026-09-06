# Architecture Overview

## Stack

- **Next.js App Router** — a newer major version than most training data covers.
  Before writing App Router code, read the docs bundled in
  `node_modules/next/dist/docs/` (resolved relative to the repo, since in some
  setups `next` isn't visible from the root) — conventions, file structure, and
  APIs may differ from what you remember. See `CLAUDE.md`'s "This is NOT the
  Next.js you know" section.
- **React 19**, **TypeScript 5**, **Tailwind 4**.
- **Zustand 5** for all client state (see [02](02-state-management.md)).
- **Upstash Redis** (`@upstash/redis`) for ephemeral live-session sync (see
  [04](04-campaign-sync-redis.md)).
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) for durable storage,
  auth, and the campaign-membership backend (see
  [05](05-cloud-backend-supabase.md)).
- **`@fieldnotes/core` / `@fieldnotes/react` / `@fieldnotes/sync`** — the
  battle-map canvas SDK. Authored by this project's maintainer, not a
  third-party dependency to treat as a black box — see
  [07](07-battlemap-fog-fieldnotes.md).
- **`@3d-dice/dice-box`** + `dice-ui` — 3D dice roller. **`@tiptap/*`** — rich
  text editor (background/notes). **`tldraw`** and **`reactflow`** — canvas
  primitives used in the VTT/map surfaces.

## Path alias

`@/*` maps to `src/*`. Use it for all internal imports.

## Top-level `src/` layout

| Dir | Purpose |
|---|---|
| `app/` | Pages and API routes (App Router) |
| `components/` | `shared/` (domain components) and `ui/` (design system) — see [09](09-design-system-ui.md) |
| `store/` | Zustand stores — see [02](02-state-management.md) |
| `hooks/` | Custom hooks: data-fetching (`use*Data`) and live-sync (`use*Sync`) |
| `lib/` | Non-React logic: sync engines, IndexedDB migration, Supabase gateways, fog of war, guest sessions, battle-map auth |
| `utils/` | Pure helpers: D&D math, data loaders, JSON→type conversion |
| `types/` | TypeScript interfaces; `character.ts` is the central type file |
| `contexts/` | React context providers |
| `test/` | Shared test setup (`setup.ts` for the vitest `unit` project) |
| `examples/`, `prototypes/`, `docs/` | Scratch/reference code not part of the shipped app — check before assuming something here is live |

## `src/app/` structure

- `player/` — character list (`/player`), new character (`/player/characters/new`),
  character sheet (`/player/characters/[characterId]`)
- `dm/` — campaign dashboard (`/dm`), campaign detail (`/dm/campaign/[code]`)
- `bestiary/`, `spellbook/`, `classes/` — read-only reference compendiums
- `api/` — see [08-api-routes.md](08-api-routes.md)

## Where the complexity actually lives

Reading only the page/component tree under-represents this codebase. The
biggest, least-obvious subsystems are all under `src/lib/`:

- `lib/indexeddb/` — localStorage→IndexedDB migration engine, per-domain
  authorities/repositories, cutover control ([03](03-persistence-and-storage-migration.md))
- `lib/durableDm/` — per-entity-type "family" sync to Supabase, flag-gated
  slice by slice ([05](05-cloud-backend-supabase.md))
- `lib/playerBackup/` — character cloud backup/restore wizard
  ([06](06-player-backup-wizard.md))
- `lib/supabase/` — server-side Supabase gateways/services
- Fog of war / battle-map sync/auth files directly under `lib/`
  ([07](07-battlemap-fog-fieldnotes.md))

`characterStore.ts` alone is ~5,500 lines because it's wired into nearly all of
the above simultaneously (game mechanics + IndexedDB cutover + cross-tab sync +
cloud backup hooks). Don't expect a single, small "the character store" — read
[02](02-state-management.md) and [03](03-persistence-and-storage-migration.md)
before making changes there.

## Environment variables

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Redis HTTP proxy (local: `http://localhost:8079` / `local_dev_token` via `docker-compose up -d`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME` | S3 avatar uploads (optional) |
| Supabase env vars | See `.env.example`; local dev uses the Supabase CLI (`npm run db:start`) |

Copy `.env.example` to `.env.local`.
