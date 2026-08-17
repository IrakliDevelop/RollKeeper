---
name: rollkeeper-manual-browser
description: Perform RollKeeper's final interactive PR acceptance check with Claude Code's Chrome integration, isolated local origins, deterministic synthetic character and DM-family seed data, storage evidence, and failure-path verification. Use after automated checks for PRs that change browser-visible UI, navigation, authentication, local persistence, IndexedDB, offline behavior, downloads, network failure handling, or cloud-sync controls. Also use when a PR explicitly requires manual browser verification; do not use standalone Playwright as a substitute.
---

# RollKeeper manual browser acceptance for Claude Code

Run a genuine interactive acceptance pass after automated gates are green. Read
`.agents/skills/rollkeeper-manual-browser/references/acceptance-checklist.md`
and select the sections affected by the diff.

## Establish Claude's browser gate

1. Use Claude Code's official Chrome integration. Start Claude Code with
   `claude --chrome`, or run `/chrome` in an existing session.
2. Confirm `/chrome` reports `Status: Enabled` and `Extension: Installed`, and
   select the intended connected browser if more than one is available.
3. If the extension is missing, ask the user to install and enable the official
   Claude in Chrome extension, then continue with browser tools. If detection
   fails, verify Chrome is running, update Claude Code, use `/chrome` →
   `Reconnect extension`, and restart Claude Code and Chrome if necessary.
4. If Chrome integration remains unavailable, report the limitation and stop
   the manual gate. Never replace it with standalone Playwright, another
   automated browser suite, or unobserved HTTP requests and call that manual.

## Protect the user's browser state

Claude's Chrome integration shares the connected browser's login state. Do not
inspect or use existing tabs, cookies, profiles, credentials, storage, or
accounts.

- Let Claude open new tabs for the acceptance run.
- Start an ephemeral local RollKeeper server on an unused port.
- Use new host-isolated origins such as `rk-pr-seed.localhost`,
  `rk-pr-a.localhost`, and `rk-pr-b.localhost` on that port. Distinct origins
  isolate cookies, localStorage, IndexedDB, caches, and service workers from
  ordinary `localhost` and from each other.
- Use only fake names, identifiers, campaigns, and payloads. Never enter real
  emails, OTPs, tokens, connector URLs, project identifiers, or user data.
- Do not enable feature flags in a deployed environment. Pass them only to the
  ephemeral local server when the PR requires them.
- Clear or delete storage only for the synthetic origins created for this run.
  Never clear the user's normal browser profile or a broad hostname.

## Build identical synthetic profiles

1. Run:

   `node .agents/skills/rollkeeper-manual-browser/scripts/generate-fake-seed.mjs`

2. Open the dedicated seed origin and create the emitted `characterDraft`
   through the visible `/player/characters/new` UI so the app produces the
   current persisted character schema.
3. Add the emitted `localStorageEntries` only to the seed origin. Capture exact
   raw pairs for the complete character family and the synthetic unrelated
   entries.
4. Record UTF-8 byte counts and SHA-256 hashes without printing raw payloads in
   commentary, logs, PR text, or the final report.
5. Copy the exact raw pairs into each required test origin before loading the
   app. Confirm identical key counts, bytes, and hashes before testing.

For a single-profile PR, use `rk-pr-a.localhost`. For authority, migration,
auth, offline, or cross-profile work, use at least two isolated origins: one
untouched/control profile and one explicitly participating profile.

## Execute the acceptance pass

- Derive scenarios from the user-visible contract and changed code, not merely
  from automated tests.
- Exercise primary behavior through visible browser actions. Use direct page
  evaluation only for seeding, evidence, deterministic fault injection, or
  proving durable state that the UI cannot expose.
- Verify initial load, the changed interaction, acknowledged persistence,
  reload, navigation away/back, and a second tab when state is shared.
- Exercise applicable offline, denied, stale, retry, cancellation, and recovery
  paths without contacting production services.
- Compare final unrelated-entry hashes with the starting vector.
- Independently inspect downloads and validate format/version, byte counts,
  per-entry hashes, and manifest or bundle hashes where present.
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
from manual evidence, defects, limitations, and an explicit pass/fail/blocked
verdict.

Never pass the gate when Chrome integration was unavailable or a required
scenario was skipped. Stop the ephemeral server and close only the new test
tabs. Do not delete downloaded evidence unless the user asks.
