# RollKeeper Wiki

This wiki is written for AI coding agents (any provider) picking up work in this
repository. It explains what the project is, how it's structured, and where the
non-obvious complexity lives. It supplements — and deliberately does not repeat —
`/AGENTS.md` (the tool-agnostic source of truth: commands, conventions, design
system rules, PR style, read natively by most agents) and `/CLAUDE.md` (a thin
`@AGENTS.md` import plus a small Claude-Code-only addendum). Read those too; this
wiki fills the gaps they don't cover, mainly the sync/storage architecture, which
is the largest part of the codebase without a single source of truth.

**Read this first if you're new here.** Files are kept short and single-topic —
skim the table below and open only what you need.

## What RollKeeper is

A D&D 5e (2024 rules) character sheet and campaign management web app. Players
manage characters at `/player/characters/[characterId]`; DMs run live sessions
from `/dm/campaign/[code]` with an encounter tracker, initiative, battle maps with
fog of war, NPCs, and a shared calendar. Reference compendiums (bestiary,
spellbook, classes) are read-only lookups over static JSON game data.

Built on Next.js (App Router), React, Zustand, and Tailwind, with two backing
services: Upstash Redis (ephemeral live-session sync) and Supabase (durable
cloud storage, auth, backup/restore). Everything also works fully offline
against browser storage — the cloud/Redis layers are additive, not required for
single-player use.

## Map of the wiki

| # | File | Covers |
|---|------|--------|
| 01 | [Architecture Overview](01-architecture-overview.md) | Tech stack, top-level directory layout, path alias, where things live |
| 02 | [State Management](02-state-management.md) | Full Zustand store inventory — what each one owns |
| 03 | [Persistence & Storage Migration](03-persistence-and-storage-migration.md) | localStorage → IndexedDB cutover machinery (in-flight, easy to misread) |
| 04 | [Live Campaign Sync (Redis)](04-campaign-sync-redis.md) | DM ↔ player real-time sync over Upstash Redis |
| 05 | [Cloud Backend (Supabase)](05-cloud-backend-supabase.md) | Auth, guest sessions, campaign membership, the durable-DM "family" migration |
| 06 | [Player Backup Wizard](06-player-backup-wizard.md) | Character cloud backup/restore feature — distinct from #4 and #5 |
| 07 | [Battle Maps, Fog of War & Presence](07-battlemap-fog-fieldnotes.md) | VTT canvas, fog of war, live cursors, the `@fieldnotes/*` SDK |
| 08 | [API Routes](08-api-routes.md) | Inventory of every route under `src/app/api/` |
| 09 | [Design System & UI](09-design-system-ui.md) | Component library layout, dark mode tokens |
| 10 | [Testing](10-testing.md) | The (more than one) test runners and suites, and what each actually checks |
| 11 | [Game Data (`/json`)](11-game-data-json.md) | Static rules data and the loader/conversion pattern |
| 12 | [Conventions & Workflow](12-conventions-and-workflow.md) | Naming, commits, branches, PRs, the per-provider skill-duplication pattern |
| 13 | [Feature Flags & Gated Work](13-feature-flags-and-gated-work.md) | Why "is X shipped?" needs a flag check, not an assumption |
| 14 | [Agent Guidance](14-agent-guidance.md) | What to check before touching sync/storage code; where the real gates are |

## How to use this wiki safely

This codebase has several large subsystems mid-migration (see #03, #05, #13).
A file existing, or a feature reading as "done" in a commit message, does not
mean it's live for all users — check the relevant flags file before asserting
current behavior. When in doubt, grep for the concrete symbol/flag rather than
trusting a summary (including this one) — this wiki describes the repo as of
**2026-09-06** and the fast-moving parts of it (sync, storage, fog of war,
player backup) change weekly.
