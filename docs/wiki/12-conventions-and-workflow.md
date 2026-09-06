# Conventions & Workflow

## Naming (full rules in `CLAUDE.md`)

Components PascalCase, hooks `use` prefix, utils camelCase, constants
SCREAMING_SNAKE_CASE, types/interfaces PascalCase, event handler
implementations `handle*`/props `on*`. Components stay under ~150 lines;
complex ones use the folder pattern
(`ComponentName/index.tsx` + `.hooks.ts` + `.types.ts` + `.utils.ts`).

## Commits

Squash-merged, conventional-commit-ish style with the PR number suffixed:

```
feat(fog): fog preset library UI and custom material projection (#301)
fix: wait for live IndexedDB generation in Nightly rollback drill (#285)
chore(relay): bump @fieldnotes/sync-server to 0.13.0 (#293)
```

Not strictly enforced — some commits omit the `type:` prefix entirely
(`Improve fog material editor (#302)`). Match the surrounding style but don't
treat a missing prefix as an error.

## Branches / PRs

`gh` is available and used for PR management. No separate `CONTRIBUTING.md`.
PR bodies should stay concise — outcome, essential design changes, checks run,
unresolved risks; skip implementation diaries and raw logs (see `CLAUDE.md`
"Pull request writing" for the exact rule).

## Only commit/branch when asked

Don't auto-commit or auto-push without an explicit request in the current
conversation — this applies to every agent working in this repo, not just a
specific provider's default behavior.

## AGENTS.md is the source of truth; CLAUDE.md imports it

`AGENTS.md` is the tool-agnostic instruction file — the
[open standard](https://agents.md) read natively by most AI coding agents
(Codex, Cursor, GitHub Copilot, Windsurf, Gemini CLI, Devin, and others).
`CLAUDE.md` is a one-line `@AGENTS.md` import followed by a small
Claude-Code-only section (currently just the Claude-specific rules for the
manual browser gate). Don't duplicate tool-agnostic content back into
`CLAUDE.md` — add it to `AGENTS.md` once, and Claude Code picks it up through
the import. This mirrors the pattern this Next.js version's own scaffolding
generator (`node_modules/next/dist/server/lib/generate-agent-files.js`)
already assumes for fresh projects.

If you add instructions for a different agent/tool (a new `.cursor/rules/`
file, `.github/copilot-instructions.md`, etc.), apply the same rule: keep only
what that tool's format can uniquely express (e.g. glob-scoped rules), and
point everything else back at `AGENTS.md` rather than re-stating it.

## Per-provider skill duplication

Agent-facing *skills* (as opposed to the root instruction files above) are
still duplicated per provider directory: `.claude/skills/<name>/SKILL.md` and
`.agents/skills/<name>/SKILL.md` hold the same skill for different agent
providers (Claude Code vs. Codex). No portable cross-tool skill format has
been adopted yet (as of this writing, "Agent Plugins 1.0" is too new/unproven
to migrate to), so this duplication is intentional, not an oversight. If
you're adding or editing agent-facing instructions for a workflow both
providers use, update both locations — don't assume one covers the other. The
manual-browser-gate pair reference the same shared checklist/seed script but
each has provider-specific browser-automation setup steps that must not be
swapped.

## Docker / local services

`docker-compose up -d` starts Redis + serverless-redis-http (port 8079) for
campaign sync. `npm run db:start` starts the local Supabase stack separately.
Both may be needed depending on which subsystem you're working on — see
[04](04-campaign-sync-redis.md) and [05](05-cloud-backend-supabase.md).
