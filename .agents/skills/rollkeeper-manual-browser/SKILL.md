---
name: rollkeeper-manual-browser
description: Perform RollKeeper's final interactive PR acceptance check with the Codex desktop in-app Browser, isolated local origins, deterministic synthetic character and DM-family seed data, storage evidence, and failure-path verification. Use after automated checks for PRs that change browser-visible UI, navigation, authentication, local persistence, IndexedDB, offline behavior, downloads, network failure handling, or cloud-sync controls. Also use when a PR explicitly requires manual browser verification; do not use standalone Playwright as a substitute.
---

# RollKeeper manual browser acceptance

Run a genuine interactive acceptance pass after the PR's automated gates are
green. Read [references/acceptance-checklist.md](references/acceptance-checklist.md)
and select the sections affected by the diff.

## Establish the browser gate

1. Read the installed `control-in-app-browser` skill completely and follow its
   setup, troubleshooting, interaction, and cleanup rules.
2. Use only the Codex desktop in-app Browser. If the task is running in the CLI
   or web app, ask the user to switch to the Codex desktop app and reopen the
   same task. Do not start manual verification yet.
3. If the in-app Browser is disabled, ask the user to enable the Browser or
   Computer-use capability in Codex settings, restart or reopen the app if it
   requests that, and tell the agent when ready.
4. If connection or browser discovery still fails, follow the Browser skill's
   documented bootstrap troubleshooting. Report the limitation and stop the
   manual gate if no in-app Browser instance becomes available.
5. Never replace this gate with standalone Playwright, another browser, or an
   automated suite. Those are supplemental evidence only.

## Protect the user's browser state

The in-app Browser can have existing signed-in sessions. Do not inspect or use
existing tabs, cookies, profiles, credentials, storage, or accounts.

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

2. Open the dedicated seed origin and create the seed character through the
   visible `/player/characters/new` UI using the emitted `characterDraft`.
   Creating the character through the app keeps the persisted schema current.
3. Add the emitted `localStorageEntries` only to the seed origin. These are
   deterministic fake DM, encounter, NPC, calendar, location, battle-map,
   combat-log, magic-item, and unrelated sentinel values.
4. Capture the exact raw pairs for the complete character family plus the
   emitted unrelated entries. Record UTF-8 byte counts and SHA-256 hashes, but
   do not print raw payloads in commentary, logs, PR text, or the final report.
5. Copy those exact raw pairs into each required test origin before loading the
   app. Confirm identical key counts, bytes, and hashes before testing.

For a single-profile PR, use `rk-pr-a.localhost`. For authority, migration,
auth, offline, or cross-profile work, use at least two isolated origins: one
untouched/control profile and one explicitly participating profile.

## Execute the acceptance pass

- Derive the manual scenarios from the user-visible contract and changed code,
  not merely from existing automated tests.
- Exercise primary behavior through visible UI actions. Use page evaluation
  only for seeding, evidence collection, deterministic fault injection, or
  proving durable state that the UI cannot expose.
- Verify initial load, the changed interaction, acknowledged persistence,
  reload, navigation away/back, and a second tab when state is shared.
- Exercise applicable offline, denied, stale, retry, cancellation, and recovery
  paths without contacting production services.
- Compare final unrelated-entry hashes with the starting vector.
- Inspect downloads independently: validate format/version, byte counts,
  per-entry hashes, and manifest or bundle hashes where present.
- Treat a visible success message as valid only after proving the acknowledged
  state is already durable in the authoritative store or supported journal.

If a defect appears, capture the smallest reproducible action sequence, write
the smallest focused failing automated test, observe the red phase, implement
the minimum correction, rerun proportional automated gates, and repeat the
affected in-app-browser actions. Do not weaken the manual contract.

## Report and clean up

Report:

- branch, commit, local-only flags, port, and isolated origin labels;
- synthetic seed version, entry counts, byte counts, and abbreviated hashes;
- exact visible actions and outcomes;
- reload, multi-tab, offline/failure, recovery, and download outcomes that
  applied;
- automated commands separately from manual-browser evidence;
- defects and corrective PRs;
- remaining limitations and an explicit pass, fail, or blocked verdict.

Never call the gate passed when the in-app Browser was unavailable or when a
required scenario was skipped. Stop the ephemeral server and finalize the
temporary in-app-browser tabs when finished. Do not delete downloaded evidence
unless the user asks.
