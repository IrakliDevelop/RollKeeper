# Agent Guidance

Practical checklist for an AI agent (any provider) about to make a change in
this repo.

## Read these first, don't duplicate them

- `/AGENTS.md` — the tool-agnostic source of truth: commands, architecture,
  conventions, PR writing, character-sheet layout rules, frontend guidelines
  (dark mode, design system, naming), the Next.js-version warning, and the
  generic manual-browser-gate rule. Read natively by most non-Claude agents
  (Codex, Cursor, Copilot, Windsurf, Gemini CLI, Devin, ...).
- `/CLAUDE.md` — a one-line `@AGENTS.md` import plus a short Claude-specific
  addendum (currently just the Claude-only rules for the manual browser gate,
  e.g. the Chrome-extension requirement). If you're Claude Code, read this
  file — it pulls in `AGENTS.md` for you.
- `.claude/skills/rollkeeper-manual-browser/SKILL.md` and
  `.agents/skills/rollkeeper-manual-browser/SKILL.md` — the concrete
  per-provider implementations of the browser gate (Claude Chrome extension
  vs. Codex desktop Browser). **Do not follow the other provider's browser
  setup steps** — only the shared checklist/seed script they both point to is
  common (see [12](12-conventions-and-workflow.md)).

This wiki (`docs/wiki/`) exists to cover what those files don't: the
sync/storage architecture (files 03–06), the fog-of-war/VTT subsystem (07),
and a map of the wider directory structure (01, 02, 08–11).

## Before touching sync or storage code

1. Identify which system you're actually in — Redis live-session sync
   ([04](04-campaign-sync-redis.md)), Supabase durable-DM family
   ([05](05-cloud-backend-supabase.md)), player backup wizard
   ([06](06-player-backup-wizard.md)), or the IndexedDB cutover machinery
   ([03](03-persistence-and-storage-migration.md)). These four are easy to
   conflate but have different consistency/durability guarantees.
2. Check the relevant feature flag before asserting current behavior
   ([13](13-feature-flags-and-gated-work.md)).
3. Follow the existing per-domain pattern (authority/repository/migration
   trio, or family/awareStorage/httpGateway/syncService trio) rather than
   inventing a new shape — six domains already share these patterns
   consistently.

## Manual browser acceptance gate

For PRs affecting browser-visible UI, navigation, auth, local persistence,
IndexedDB, offline behavior, downloads, network failures, or cloud-sync
controls: run the project's manual browser skill after automated checks pass,
before calling the PR done. For Claude Code this is
`/rollkeeper-manual-browser`, requiring an interactive session with the Claude
in Chrome extension (`claude --chrome` or `/chrome`) — unavailable under
API-key auth, WSL, `claude -p`, or headless/background jobs. In those cases,
report the gate as **blocked with reason**, never as passed or skipped.
Storybook/Vitest, standalone Playwright, a Playwright/Puppeteer MCP server,
`curl`, or headless Chromium are supplemental evidence only, never a
substitute.

## Commit/branch discipline

Only commit or push when explicitly asked in the current conversation. Prefer
per-task commits on a dedicated branch when executing a multi-step plan.

## When this wiki and the code disagree

Trust the code. This wiki was written 2026-09-06 against a fast-moving
codebase (open PR #303 the same day, several untracked planning docs in
progress). Grep for the concrete symbol, flag, or file before relying on a
claim here for anything beyond orientation.
