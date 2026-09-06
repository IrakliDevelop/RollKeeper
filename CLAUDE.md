@AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) specifically. The
import above (`AGENTS.md`) is the tool-agnostic source of truth — commands,
architecture, conventions, PR style — shared with every other agent working in
this repo. Everything below is Claude-Code-only.

## Final manual browser acceptance gate — Claude-specific rules

`AGENTS.md` describes the manual browser acceptance gate in general terms. For
Claude Code specifically:

- The gate runs only through Claude Code's official Chrome integration
  (`claude --chrome` or `/chrome`, with the Claude in Chrome extension). It
  needs an interactive session authenticated with `/login`; it is unavailable
  with API-key auth, third-party providers, WSL, `claude -p`, or background /
  headless jobs. In those cases report the gate as **blocked** with the reason —
  never as passed or skipped.
- Never substitute Storybook/Vitest, standalone Playwright, a Playwright/Puppeteer
  MCP server, `curl`, or headless Chromium and call it manual verification. Those
  are supplemental evidence only.
- Chrome shares the user's signed-in browser state. Work only in new tabs on the
  skill's isolated `*.localhost` origins with its synthetic seed data; never read,
  reuse, or clear the user's real tabs, cookies, storage, or accounts.
- `.agents/skills/rollkeeper-manual-browser/SKILL.md` is Codex's version of
  this gate (Codex desktop in-app Browser). Do not follow its browser setup
  steps; only reuse the shared checklist and seed script it points to.
- Server-only and documentation-only PRs may mark the gate not applicable, but
  the final report and the PR template must state why.

Run this gate (`/rollkeeper-manual-browser`,
`.claude/skills/rollkeeper-manual-browser/SKILL.md`) after automated checks
pass and before calling the PR complete or ready to merge.
