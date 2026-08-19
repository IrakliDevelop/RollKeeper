# Slice 10A.2 acceptance evidence

## Scope and environment

- Branch: `feat/slice-10a2-hybrid-guest-sessions`
- Baseline: `4cb649f9395d6c14e6feca664c3ebc9b095cb537`
- Dependency: Slice 10A.1 PR #256 was merged and the baseline contains it.
- Server feature flag: `SUPABASE_HYBRID_GUEST_ENABLED`; absent/false by
  default.
- Client visibility flag: `NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED`;
  absent/false by default and independently checked.
- Manual enabled run: local Supabase/Auth/Mailpit, dedicated Redis/HTTP bridge,
  and isolated `.localhost` origins on port 3112.
- Manual disabled run: identical local app with both guest flags absent.
- Remote schema target: the connector-verified RollKeeper development project;
  no deployed guest feature flag was enabled.

This slice adds an alternative, owner-issued guest capability only. Campaign
membership and every durable family remain legacy-authoritative; Redis/relay
remain live-authoritative. It does not enroll players, link accounts or
characters, migrate namespaces, upload local data, cut over a durable family,
or begin Slice 10B/11.

## Red/green evidence

The focused tests and pgTAP assertions were written before implementation.
They initially failed for the absent private tables/RPCs, guest service,
authority adapter, explicit player projection, route authorization, cookies,
and UI. Later manual acceptance found two defects and each was corrected with a
failing regression first:

1. asynchronously loaded workspaces did not update the guest-issuance selector;
2. query-string invitations appeared in the local Next request log. Invitation
   links now use a URL fragment, which browsers do not send in HTTP requests,
   and the client scrubs the fragment before redemption.

Final focused result:

- 9 files, 43 tests
- 99.42% statements, 95.27% branches, 100% functions, 99.38% lines
- Includes owner/cross-account checks, entropy and hashing, expiry/revocation,
  maximum and concurrent use, response-loss and changed-input replay,
  rotation, scope/campaign/player binding, fabricated-authority denial,
  CSRF/origin checks, rate limits, safe projections, default-off routing,
  rollback, races, account isolation, stale epochs, and unrelated families.
- Dedicated guest UI tests additionally prove fragment-only redemption,
  immediate URL scrubbing, no browser-storage token, async workspace adoption,
  safe-player rendering, visible rotation, and generic replay/revocation errors.

## Database and remote review

- Clean local reset applied all three Slice 10A.2 migrations successfully.
- pgTAP: 5 files, 112 tests passed, including all hybrid guest privilege/RLS
  assertions.
- Database lint: no schema warnings.
- Generated types match the reset local schema.
- Database integration: 3 tests passed, including concurrent redemption and
  rotation serialization against the real local database.
- Real HTTP integration: redemption used an opaque rotating cookie, excluded
  invitation/session secrets from response bodies and cookies, invalidated the
  old cookie, cleaned rejected cookies, enforced Origin/CSRF, and emitted the
  reviewed 60-day cookie lifetime on redemption and rotation.
- Auth integration: 2 tests passed.
- Reset/replay: 2 tests passed; two clean resets produced deterministic schema
  fingerprints and migration lists.
- Private invitation/session tables have RLS enabled and no direct `anon` or
  `authenticated` table grants. Default function execution is revoked; the
  service role has only the reviewed RPC grants.
- Security-definer functions use fixed safe search paths, fully qualified
  objects, explicit actor checks, and transactional mutation receipts.
- The exact remote project and reviewed migration list were verified before
  applying the migrations. The follow-up lifetime migration replaced only the
  two reviewed private redemption/rotation functions, changing their maximum
  fixed session expiry from 24 hours to 60 days. Post-apply guest tables were
  empty, both function definitions had the 60-day cap, RLS remained enabled,
  browser-role grants remained zero, generated types matched local review, and
  security/performance advisors were rechecked.
- The remote review also surfaced two pre-existing Slice 10A.1 private tables
  without RLS. They are not guest authority storage, have no browser grants,
  and were recorded without expanding this gated PR's scope.

## Automated regression gates

- Unit suite: 359 files passed, 1 skipped; 4,586 tests passed, 2 skipped.
- Production Next.js build passed.
- Type check passed.
- ESLint ratchet: 68 warnings within the allowance of 69.
- Prettier ratchet: 255 deviations within the allowance of 273.
- Storybook interactions: 29 files, 206 tests passed.
- Storybook production build passed after updating the existing design-token
  docs to Storybook 10's supported `@storybook/addon-docs/blocks` entry point.
- Standard Chromium E2E: 15 passed.
- IndexedDB Chromium E2E: 3 passed.
- Auth Chromium E2E: 2 passed.
- Automatic-sync gating E2E: 1 passed.
- Relay tests: 53 passed; relay build passed.
- Real Redis equal-revision CAS integration: 1 passed against a disposable
  Redis 8.10 container, which was then removed.

## Desktop in-app Browser evidence

### Synthetic seed and isolation

- Seed format version: 1.
- Generator entries: 9, 882 UTF-8 bytes, manifest `00fabc6abe39…`.
- The complete character-plus-sentinel profile contained 13 RollKeeper entries
  and the visible character `Mira Vale — Synthetic Acceptance`.
- Participating and untouched-control profiles began with identical raw pairs.
- Final exact comparison reported all 13 expected entries present with zero
  mismatches on both profiles.
- Only isolated local fake-auth accounts, Mailpit messages, local Supabase
  rows, dedicated Redis/HTTP containers, and synthetic `.localhost` origins
  were used. No normal browser account, cookie, credential, or storage was
  inspected.

### Visible actions and outcomes

1. With the feature disabled, `/dm` and `/guest` showed no guest UI and made no
   guest request, cookie, IndexedDB, or database change. The untouched control
   stayed on byte-identical legacy behavior.
2. A locally authenticated DM visibly created an owner workspace. Before the
   synthetic campaign was deliberately seeded for play, the dedicated Redis
   campaign key did not exist, proving workspace creation changed no Redis
   authority.
3. The DM selected the loaded workspace, bound `guest-player-001`, and issued a
   narrow invitation through the visible controls.
4. A separate guest origin redeemed it, reached `/guest` with the invitation
   removed, received an HttpOnly cookie invisible to `document.cookie`, and had
   no token in localStorage or IndexedDB.
5. The guest visibly joined the legacy campaign with the bound synthetic
   character, opened the player area, and read the explicit safe projection
   `Mira Vale — Synthetic Acceptance · revision 0`.
6. The guest visibly rotated the session. Real HTTP coverage proved the prior
   cookie immediately failed while the replacement succeeded.
7. Reload/navigation retained the cookie authority and ordinary local
   character data. A second same-origin status request succeeded with the same
   HttpOnly session contract.
8. Narrow 390x844 and desktop layouts were checked. Light/dark surfaces,
   labels, native control roles, focus, and keyboard navigation were acceptable.

### Failure, isolation, and authority outcomes

- Active-cookie probes denied player-ID override, wrong player, wrong campaign,
  wrong scope, `dmId`, guest invitation issuance, display-key minting, DM relay
  token minting, and player relay-authority minting. The bound player ID always
  came from the server session, never the request body.
- Replayed, fabricated, campaign-code-as-token, expired, and revoked
  invitations were scrubbed from the URL and visibly returned the same durable
  denial. Failed validation and issue/redeem/rotate limits are additionally
  covered by focused and real integration tests.
- Missing-CSRF mutation failed with 403. Cross-origin and wrong-Origin cases
  are covered by the real HTTP cookie test.
- With an active guest cookie, `/dm` showed no campaigns, no workspace creation,
  no guest controls, and no private DM documents. Direct private-table grants
  for browser roles were zero.
- Owner revocation visibly changed the session to revoked; the guest's next
  safe-player read failed. The owner campaign row and dedicated Redis campaign
  key remained present, proving revocation deleted no owner/legacy data.
- Read-only SQL for the synthetic campaign showed legacy membership at epoch 0,
  all eight durable families at `legacy` epoch 0, live runtime at
  `redis_relay` epoch 0, and workspace authority at `authenticated_owner` epoch
  1. Guest issuance changed none of those axes.
- The dedicated Redis scan contained only synthetic campaign/player records and
  no display-key or relay-authority record.
- The Browser gate exposed the query-string logging defect described above.
  After the fragment correction, a final isolated Browser run opened a
  fabricated fragment invitation. The UI visibly denied it, the resulting URL
  was exactly `/guest`, `location.search` and `location.hash` were empty,
  `document.cookie` and localStorage were empty, and the only IndexedDB name
  was Next's debug channel. The server log contained `GET /guest` and the
  redemption POST but no fragment/token. Unit tests additionally prove the raw
  token is obtained only from `location.hash`, `/guest` replaces the URL before
  `fetch`, and the API returns fragment-only redemption paths.
- The desktop Browser security policy refused network emulation and later
  console-log collection on the isolated local tab. Offline/failed-cloud
  preservation is therefore evidenced by the standard, IndexedDB, auth, and
  automatic-sync E2E gates plus the already-visible local character continuity;
  it was not represented as a successful Browser network-emulation step.

### Sixty-day session follow-up

- After extending the fixed guest-session lifetime, a proportional desktop
  Browser recheck redeemed a fresh deterministic invitation on a new isolated
  `.localhost` origin. The visible expiry was 60 days from redemption, the URL
  was scrubbed to `/guest`, `document.cookie` and localStorage were empty, and
  IndexedDB contained only Next's debug channel.
- Visible rotation produced another expiry 60 days from rotation and reported
  that the prior cookie was invalid. The real HTTP integration test separately
  proves `Max-Age=5184000`, immediate old-cookie rejection, and replacement-
  cookie success.
- The isolated tab was finalized, the local acceptance server was stopped, and
  a clean local database reset removed the synthetic follow-up rows while
  replaying all three guest migrations successfully.

Downloads, recovery-bundle formats, migration selection/cancellation,
guest-namespace activation/rollback, character-to-account linking, membership
cutover, durable-family projection, and automatic upload are not applicable:
Slice 10A.2 adds none of those flows. Their existing data and behavior remain
untouched and their regression gates passed.

## Cleanup and verdict

The isolated Browser tabs were finalized, the acceptance server was stopped,
the database replay reset removed synthetic rows, and disposable Redis
containers were removed. Cleanup targeted only synthetic local resources.

Verdict: **PASS** for Slice 10A.2. The PR is ready for review after GitHub and
Vercel checks complete; it must not be merged without explicit approval.
