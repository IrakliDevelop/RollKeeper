# Slice 10B evidence — optional campaign membership cutover

## Baseline and dependency verification

- Verified GitHub PR #258 was merged and that `origin/master` contained merge
  commit `b85f865295157348fab5000f4fd01e8e760a47a7`.
- Fast-forwarded local `master` and recorded that commit as the exact Slice 10B
  baseline before creating `feat/slice-10b-membership-cutover`.
- `SLICE_5_AUTH_PREREQUISITES.md` remained untracked and untouched.
- No production campaign, remote migration, cohort, or feature flag was changed.

## Red/green TDD evidence

- Wrote migration, RLS, privilege, replay, concurrency, authority-router, HTTP,
  service, route, UI, and coverage-contract tests before or alongside each
  implementation increment.
- Focused Slice 10B coverage: 8 files, 41 tests; 97.36% statements, 96.58%
  branches, 100% functions, and 97.14% lines.
- Manual acceptance found four defects that were converted into focused red
  tests before correction:
  - accepted membership was not restored after reload;
  - guest-subject shadow rows lacked explicit classification controls;
  - campaign PUT/DELETE needed post-cutover account authority and Origin/CSRF;
  - duplicate invitations for one account used unstable React row keys.
- Added fail-closed coverage for a managed campaign whose membership authority
  record is missing and for rollback using only the recorded verified server
  generation, never a client-supplied copy.

## Database and remote-development verification

- Clean local reset applied all migrations through
  `20260820000000_create_campaign_membership_cutover.sql`.
- pgTAP: 6 files, 186 assertions, all passing.
- Database lint: no warnings or schema errors.
- Generated public TypeScript types match the reset local schema.
- Deterministic two-reset replay: 2 tests passed.
- Real database integration passed concurrent invitation acceptance,
  response-loss replay, exhaustion, readiness races, join/remove freeze,
  atomic cutover, removal without character deletion, guest revocation, and
  verified epoch rollback.
- Real HTTP integration passed authenticated session-cookie, Origin/CSRF,
  hash-only issuance, replay, account isolation, and revocation behavior.
- Auth, guest HTTP, and general database integration suites all passed.
- No remote connector was available in this task, so no migration was applied
  to a development or production project. No remote project identifier, key,
  token, or private row evidence is recorded here.

## Automated regression evidence

- Full unit suite: 369 files passed, 1 skipped; 4,632 tests passed, 2 skipped.
- ESLint and Prettier quality ratchets passed; TypeScript passed.
- Production Next.js build passed.
- Relay: 8 files and 53 tests passed; relay TypeScript build passed.
- Disposable real Redis CAS integration passed.
- Storybook production build passed; visual suite: 29 files and 206 tests.
- Standard Chromium E2E: 15 passed.
- Authenticated Chromium E2E: 2 passed.
- IndexedDB migration E2E: 3 passed.
- Automatic-sync gating E2E: 1 passed.

## Codex desktop Browser evidence

The mandatory desktop in-app Browser gate used isolated `.localhost` origins,
local Supabase fake auth, Mailpit, a disposable local Redis/HTTP bridge, and
deterministic synthetic data only.

- Default-off origin: no membership UI, no membership request, no cookie, and
  the exact 13-entry local profile remained byte-identical.
- Untouched control profile retained legacy `MANUAL` campaign behavior and the
  original local payload.
- A synthetic authenticated owner explicitly issued an account-bound
  invitation; a separate synthetic player explicitly accepted it.
- Acceptance restored after reload and produced no local-character upload,
  claim, hide, transfer, or link. A cloud character already owned by the player
  was linked only after explicit confirmation.
- Other-account, revoked, exhausted/replayed, fabricated, wrong-account,
  stale-manifest, and Origin/CSRF attempts were visibly denied. Cross-campaign,
  expiry, changed-input replay, rate-limit, and concurrent-use durability are
  additionally proven by the real HTTP/database suites.
- The readiness view displayed legacy roster/shadow entries, guest subjects,
  invitations, accepted members, character links, classifications,
  removals/tombstones, and blockers. One unexplained participant blocked
  cutover. Abandoned/duplicate classifications did not delete source rows.
- A concurrent invitation invalidated the displayed manifest and blocked exact
  confirmation before commit; hybrid guest redemption and legacy play remained
  usable.
- Successful confirmation atomically changed only membership authority to
  Postgres epoch 1. Stale Redis membership, guest possession, campaign code,
  exposed identifiers, and request-body IDs could not authorize membership.
- Anonymous and guest campaign reads failed after cutover. Owner/player reads
  returned only the explicit safe campaign DTO fields.
- With the local database unavailable after commit, the route returned an
  unavailable response and never fell back to legacy membership.
- Verified rollback succeeded through the real HTTP/session path at epoch 2
  using the recorded server generation. Redis/legacy sources remained intact.
- The synthetic DM-held paper character, local character payload, durable DM
  families, Redis roster/runtime, relay, combat, presence, initiative, and HP
  fixtures were unchanged. Owner, player, other-account, and guest profiles all
  retained the exact original 13 local-storage entries.
- Reload, navigation, a second tab, account switching, keyboard-driven form
  entry, labels, focusable controls, and cloud-failure behavior were exercised.
- The Browser security policy rejected the final device-metrics emulation
  action. It was not bypassed. Narrow/light/dark behavior is therefore supported
  by the passing standard Chromium and visual suites rather than claimed as a
  completed manual device-emulation check.
- All in-app Browser tabs were finalized after the gate.

## Non-applicable checklist sections

- Downloads and recovery restore: Slice 10B adds neither; existing recovery
  regression suites passed.
- IndexedDB migration/cutover: Slice 10B does not alter character persistence;
  the existing IndexedDB E2E gate passed and manual storage stayed identical.
- Broad guest-to-account character migration and DM durable-family projection:
  explicitly outside Slice 10B and not exercised or implemented.
- Production cohort activation, real campaign enrollment, Slice 11, and remote
  migration: not performed.

## Cleanup and final verdict

- Final local database reset removed synthetic database rows.
- Disposable Redis and HTTP bridge containers were stopped and removed.
- Browser tabs were finalized; only isolated synthetic origins were used.
- All feature gates remain default-off. Existing and hybrid campaigns retain
  legacy membership and guest play until an owner completes a verified cutover.
- During early manual setup, a server inherited an existing nonlocal Redis
  endpoint before an explicit local-only override was supplied. Observed calls
  were read-only synthetic-key lookups and no cutover, write, or rollout was
  performed. The credential value appeared in local tool output and must be
  rotated before deployment. No credential value is present in tracked files or
  this evidence document.
- Code and tests are ready for review. Deployment/rollout remains blocked on the
  operational credential rotation and explicit future approval; this PR must
  not be merged or used to cut over a real campaign without that approval.
