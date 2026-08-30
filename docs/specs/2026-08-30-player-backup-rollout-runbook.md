# Player backup rollout runbook

Operational runbook for flipping the player backup wizard from default-off to
default-on. Not a restatement of the design/roadmap — see
`SUPABASE_CLOUD_SYNC_PLAN.md` (Slice 14) and
`docs/specs/2026-08-26-player-backup-wizard-plan.md` for those.

## 1. Flags

Capability reducer: `src/lib/playerBackup/playerBackupFlags.ts`
(`derivePlayerBackupCapabilities`). Five flags feed it (W/A/M/C/S below); all
are `NEXT_PUBLIC_*` and therefore **build-time** — a value change requires a
redeploy, not just an env var edit.

| Flag | Env var | Gates | Current production value |
|---|---|---|---|
| W | `NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE` | Whether the wizard surface renders at all (`isPlayerBackupWizardVisible`). `false` &rarr; `surfaceOwner: 'legacy'`, all calls disabled. | `false` (unset) |
| A | `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED` (+ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | `authConfigured` — Supabase auth client construction (`isAuthEnabled`/`getPublicAuthConfig`). `false` &rarr; `setup: 'unavailable'`. | `false` (unset) |
| M | `NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED` | `manual` — manual ("Back up now") one-time backup/restore calls. | `false` (unset) |
| C | `NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED` | `cutover` — local IndexedDB as the authoritative store (prerequisite for automatic sync). | `false` (unset) |
| S | `NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED` | `automatic` — ongoing background sync. Combined with C via `integrated = cutover && automatic`. | `false` (unset) |

Current production posture: all five unset/false &rarr; `surfaceOwner: 'legacy'`,
`setup: 'legacy'`. Nobody sees the wizard.

Reducer outcomes worth knowing before flipping flags (from
`playerBackupFlags.ts`):

- `W=false`: legacy surface, no wizard calls at all.
- `W=true, A=false`: wizard visible, `setup: 'unavailable'` (no auth backend).
- `W=true, A=true`, no lock available: `setup: 'read-only'`.
- `M=true`, not integrated (`C && S` false): `setup: 'degraded-manual'`,
  one-time mode only.
- `C=true, S=true`, `M=false`: `setup: 'integrated-ongoing'`, ongoing mode
  only.
- `M=true`, `C=true`, `S=true`: `setup: 'full'`, both modes.

## 2. Stages

All env var changes are made in the Vercel dashboard (Project &rarr;
Settings &rarr; Environment Variables) and require a redeploy to take effect
(`NEXT_PUBLIC_*` vars are inlined at build time).

**Stage 0 — today.** Deployed, default-off. All five flags unset/false in
every Vercel environment.

**Stage 1 — internal soak (Preview only).** Set all five flags to `true` on a
Vercel **Preview** deployment, scoped to owner accounts only. Duration: 1
week. Watch the observability list in section 4 continuously. Do not touch
Production env vars in this stage.

**Stage 2 — small cohort (Production).** Set all five flags to `true` in
Production. Announce to a handful of named users (not a public rollout).
Keep watching the observability list. Gate on Stage 1 completing clean.

**Stage 3 — default-on for everyone.** Same flag values as Stage 2, but no
longer cohort-gated by communication — every production user now sees the
wizard. Gate on Stage 2 completing clean and on the pre-flip checklist
(section 5) being fully closed.

## 3. Rollback

**Full rollback:** set `NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE=false` and
redeploy. The capability reducer's `!input.wizardVisible` branch immediately
reverts `surfaceOwner` to `'legacy'` and disables every wizard call
(`NO_WIZARD_CALLS`). Local IndexedDB authority and the localStorage mirror
are untouched by a flag rollback — flipping W back off does not delete or
migrate any local data, it only hides the surface. This exact path is
rehearsed nightly by the `rollback-drill` job in
`.github/workflows/nightly.yml` (that drill flips W, M, C, and S all off
together, a superset of this W-only path) — cite a green `rollback-drill`
run as proof the rollback is safe, not just theoretical.

**Partial rollbacks** (keep the wizard visible, narrow what it can do):

- Automatic-sync only off (`S=false`, leave `M`/`C` as-is): drops back to
  one-time backup mode only (`degraded-manual` if not integrated); ongoing
  sync stops, manual "Back up now" still works.
- Backup entirely off (`M=false, C=false, S=false`, `W`/`A` still true):
  wizard stays visible but capabilities collapse to read-only + recovery
  (`setup: 'read-only'` or `'unavailable'` depending on lock/auth state) —
  the account-read and recovery calls survive; no backup/restore mutation is
  possible.

## 4. Observability (metadata only)

Roadmap item (`SUPABASE_CLOUD_SYNC_PLAN.md` Slice 14 "Observe metadata
only" list) mapped to its current source. Never log payloads, emails, OTPs,
tokens, or SMTP credentials — metadata (counts, categories, ages, states)
only.

| Roadmap item | Current source | Gap? |
|---|---|---|
| Local persistence failures | **No telemetry today** — client-side only | Gap |
| Migration state | **No telemetry today** — client-side only | Gap |
| Quarantine count | **No telemetry today** — client-side only | Gap |
| Oldest outbox age/size | **No telemetry today** — client-side only | Gap |
| Sync error category | **No telemetry today** — client-side only | Gap |
| CAS conflicts | Supabase Postgres logs (dashboard or MCP `query_logs`) — conflict responses are server-observable, but no dedicated aggregate exists | Partial gap |
| Shadow mismatches | **No telemetry today** — client-side only | Gap |
| Authority + epoch | Supabase Postgres logs (rows carry authority/epoch columns, queryable via dashboard or MCP `query_logs`), but no standing dashboard/alert | Partial gap |
| Redis projection failures | Vercel function logs (API route console output) | Available, not aggregated |
| Resend delivery/bounce status | Resend dashboard (delivery/bounce events) | Available |

**Rule of thumb:** anything that only happens in the browser (local
persistence, migration state, quarantine, outbox, sync error category, shadow
mismatches) has no server-side visibility yet — those are explicit gaps to
close before Stage 3, not just Stage 1/2. Server-observable items (CAS
conflicts, authority/epoch, Redis projection failures, Resend delivery) exist
in raw logs today but lack a rollup or alert; treat that as "available but
manual" rather than "instrumented."

## 5. Pre-flip checklist

Before moving to Stage 3 (default-on for everyone), all of the following
must be true:

- [ ] Nightly workflow (`.github/workflows/nightly.yml`) green — all five
      jobs (`integration-families`, `reconnect-stress`,
      `checkpoint-matrix`, `backup-restore-drill`, `rollback-drill`) passing,
      including a clean `rollback-drill` run as the rollback proof cited in
      section 3.
- [ ] Design-fidelity review signed off —
      `docs/specs/2026-08-30-design-fidelity-review.md` verdict recorded as
      matched (or divergences fixed).
- [ ] `SLICE_5_AUTH_PREREQUISITES.md` item 16 ("Final prerequisite
      verification") fully closed, including shortening OTP expiry from the
      current 3600s default to 600s, and confirming no Auth users/cloud
      traffic were created during prerequisite setup.
- [ ] `BACKPORT_EVIDENCE.md` gate no longer PARTIAL.
- [ ] Production Site URL decision recorded: stays
      `https://roll-keeper.vercel.app` for now (per
      `SLICE_5_AUTH_PREREQUISITES.md` — do not point
      `playrollkeeper.com`/`www` at Vercel or change the Vercel production
      URL until user migration).
