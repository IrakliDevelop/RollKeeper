---
name: rollkeeper-manual-browser
description: Perform RollKeeper's final interactive PR acceptance check with Claude Code's Chrome integration (Claude in Chrome), isolated local *.localhost origins, deterministic synthetic character and DM-family seed data, storage evidence, and failure-path verification. Use after automated checks for PRs that change browser-visible UI, navigation, authentication, local persistence, IndexedDB, offline behavior, downloads, network failure handling, or cloud-sync controls. Also use when a PR explicitly requires manual browser verification; do not use standalone Playwright, Storybook tests, or headless Chromium as a substitute.
argument-hint: "[PR number or branch] [optional: feature flags]"
---

# RollKeeper manual browser acceptance for Claude Code

Run a genuine interactive acceptance pass after automated gates are green.
Read `${CLAUDE_PROJECT_DIR}/.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`
and select the sections affected by the diff. The `.agents/...` SKILL.md and
`AGENTS.md` are Codex-only (Codex desktop in-app Browser); reuse only the
checklist and the seed script from that folder.

## Establish Claude's browser gate

1. Use only Claude Code's official Chrome integration. Start Claude Code with
   `claude --chrome`, or run `/chrome` in an existing session and enable it.
2. Confirm `/chrome` reports `Status: Enabled` and `Extension: Installed`. If
   more than one browser is connected, select the intended one in `/chrome`.
3. Prerequisites the user must satisfy (ask, then continue once done):
   - Claude in Chrome extension (v1.0.36+) installed and enabled in Chrome,
     Edge, Brave, Arc, Vivaldi, or Opera; the browser is running.
   - Session authenticated with `/login` on an Anthropic plan. API-key /
     long-lived-token auth, Bedrock/Vertex/Foundry, and WSL are unsupported.
   - Interactive session. `claude -p`, background jobs, cron/routines, and
     cloud/headless sessions cannot run this gate.
4. If detection fails: verify the browser is running, update Claude Code, use
   `/chrome` → `Reconnect extension`, then restart Claude Code and the browser.
5. If Chrome integration remains unavailable, report the gate as **blocked**
   with the reason and stop. Never replace it with standalone Playwright, a
   Playwright/Puppeteer MCP server, Storybook/Vitest runs, `curl`, headless
   Chromium, or unobserved HTTP requests and call that manual verification.

## Protect the user's browser state

Claude's Chrome integration shares the connected browser's login state,
tabs, cookies, and storage. Do not inspect or use existing tabs, cookies,
profiles, credentials, storage, or accounts.

- Open new tabs for the acceptance run (tab management tools with
  create-if-empty). Never act in tabs the user already had open.
- Start an ephemeral local RollKeeper server on an unused port from Bash,
  e.g. `PORT=<port> npm run dev` (or `npm run build && npx next start -p <port>`
  when production behavior matters). Keep it in the background and stop it at
  the end.
- Use new host-isolated origins such as `http://rk-pr-seed.localhost:<port>`,
  `http://rk-pr-a.localhost:<port>`, and `http://rk-pr-b.localhost:<port>`.
  Chromium resolves `*.localhost` to loopback without hosts-file changes.
  Distinct hostnames isolate cookies, localStorage, IndexedDB, caches, and
  service workers from ordinary `localhost` and from each other.
- If `/chrome` site permissions prompt for these origins, allow only the
  synthetic `*.localhost` origins for this run.
- Use only fake names, identifiers, campaigns, and payloads. Never enter real
  emails, OTPs, tokens, connector URLs, project identifiers, or user data.
- Do not enable feature flags in a deployed environment. Pass them only to the
  ephemeral local server when the PR requires them.
- Clear or delete storage only for the synthetic origins created for this run
  (from page JavaScript scoped to that origin). Never clear the user's normal
  browser profile, a broad hostname, or `localhost` itself.

## Build identical synthetic profiles

1. Run from Bash:

   `node .agents/skills/rollkeeper-manual-browser/scripts/generate-fake-seed.mjs`

   (`--summary` prints manifest metadata only; use it in reports.)
2. Open the seed origin and create the emitted `characterDraft` through the
   visible `/player/characters/new` UI so the app produces the current
   persisted character schema.
3. Add the emitted `localStorageEntries` only to the seed origin. Capture the
   exact raw pairs for the complete character family and the synthetic
   unrelated entries.
4. Record UTF-8 byte counts and SHA-256 hashes without printing raw payloads in
   commentary, logs, PR text, or the final report.
5. Copy the exact raw pairs into each required test origin before loading the
   app. Confirm identical key counts, bytes, and hashes before testing.

For a single-profile PR, use `rk-pr-a.localhost`. For authority, migration,
auth, offline, or cross-profile work, use at least two isolated origins: one
untouched/control profile and one explicitly participating profile.

## Which Chrome tools to use for what

- Visible behavior: `navigate`, `find`, clicks, typing, form filling, and
  `read_page` / `get_page_text` for what the user would see. Prefer these
  over page evaluation for every primary interaction.
- Seeding, evidence, deterministic fault injection, and proving durable state
  the UI cannot expose (localStorage/IndexedDB contents, hashes): page
  JavaScript evaluation on the synthetic origin only.
- Console evidence: read console messages filtered for errors/warnings; do
  not paste payloads or secrets from them.
- Network evidence: read network requests for the changed interaction; report
  method, path, and status only — never headers or bodies.
- Visual evidence: screenshots (light and dark theme, narrow and desktop
  viewport) and a GIF recording of the primary flow when it helps review.
- Multi-tab checks: open a second tab on the same synthetic origin.
- Note: `alert`/`confirm`/`prompt` dialogs block browser events; if the app
  raises one, dismiss it visibly and record it.
- Batch read-only steps to keep context small; keep state-changing actions
  individually observable.

## Execute the acceptance pass

- Derive scenarios from the user-visible contract and changed code, not merely
  from automated tests.
- Exercise primary behavior through visible browser actions. Use page
  evaluation only for seeding, evidence, deterministic fault injection, or
  proving durable state that the UI cannot expose.
- Verify initial load, the changed interaction, acknowledged persistence,
  reload, navigation away/back, and a second tab when state is shared.
- Exercise applicable offline, denied, stale, retry, cancellation, and recovery
  paths without contacting production services. Simulate offline for the
  synthetic tab only (for example by stopping the ephemeral server or
  injecting deterministic fetch failures on that origin), never by changing
  the user's system or browser-wide network state.
- Compare final unrelated-entry hashes with the starting vector.
- Independently inspect downloads (Bash: parse the JSON, recompute SHA-256)
  and validate format/version, byte counts, per-entry hashes, and manifest or
  bundle hashes where present.
- Treat a success message as valid only after proving the acknowledged state is
  durable in the authoritative store or supported journal.

If a defect appears, capture the smallest visible reproduction, write the
smallest focused failing automated test, observe the red phase, implement the
minimum correction, rerun proportional automated gates, and repeat the
affected Chrome actions.

## Report and clean up

Report the branch and commit, local-only flags, port and synthetic origin
labels, seed version/counts/bytes/abbreviated hashes, visible actions and
outcomes, applicable failure paths, artifact validation, automation separately
from manual evidence, defects, limitations, and an explicit
**passed / failed / blocked** verdict. Fill the "Verification" and
"Manual acceptance evidence" sections of `.github/pull_request_template.md`
from this report.

Never pass the gate when Chrome integration was unavailable or a required
scenario was skipped. Stop the ephemeral server and close only the new tabs
this run opened. Do not delete downloaded evidence unless the user asks.
