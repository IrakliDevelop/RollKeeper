# RollKeeper agent instructions

## Final PR browser gate

After automated checks pass, use
`.agents/skills/rollkeeper-manual-browser/SKILL.md` for every PR that changes
browser-visible UI, navigation, authentication, local persistence, IndexedDB,
offline behavior, downloads, network failure handling, or cloud-sync controls.
Perform the gate before calling the PR complete or ready to merge.

The gate must use the Codex desktop in-app Browser. If the task is not running
in the desktop app, ask the user to switch to the desktop app and reopen the
task. If Browser access is disabled, ask the user to enable it and reopen or
restart as required. Never describe standalone Playwright or another automated
browser suite as manual verification.

Use only isolated local origins and the skill's deterministic fake seed data.
Never inspect or reuse the user's normal browser sessions, accounts, cookies,
credentials, or storage. A server-only or documentation-only PR may mark this
gate not applicable, but the final report must state why.
